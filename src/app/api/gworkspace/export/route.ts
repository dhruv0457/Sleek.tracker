import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo, canExportWorkspace } from "@/lib/tier";
import { getGWorkspaceToken } from "@/lib/gworkspace";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "gworkspace-export" });
  if (!rl.ok) return NextResponse.json({ error: "Too many exports" }, { status: 429 });

  const user = await getUserInfo(session.userId);
  if (!user || !canExportWorkspace(user)) {
    return NextResponse.json({ error: "Workspace export requires Ultra Pro ($4) or active trial." }, { status: 403 });
  }

  const token = await getGWorkspaceToken(session.userId);
  if (!token?.access) {
    return NextResponse.json({ error: "Connect your Google account first." }, { status: 401 });
  }
  const accessToken: string = token.access;

  const body = await req.json().catch(() => ({}));
  const formArg = String(body.format || "sheets");
  const format = ["sheets", "docs", "drive"].includes(formArg) ? formArg : "sheets";
  // Validate daysBack defensively — Number("abc") == NaN, which would silently
  // poison the date math below and return garbage to the user.
  const parsedDays = Number(body.daysBack);
  const daysBack = Number.isFinite(parsedDays) ? Math.min(365, Math.max(7, Math.floor(parsedDays))) : 30;

  const since = new Date(); since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().slice(0, 10);

  const habits = await prisma.habit.findMany({
    where: { userId: session.userId },
    include: { checkins: { where: { date: { gte: sinceStr } }, orderBy: { date: "asc" } } }
  });

  // Build CSV-ish rows (date | habit_name | completed | intensity | multitask | minutes | status)
  const rows: string[][] = [];
  rows.push(["date", "habit", "completed", "intensity", "multitask", "minutes", "status"]);
  for (const h of habits) {
    for (const c of h.checkins) {
      rows.push([c.date, h.name, String(c.completed), String(c.intensity), String(c.multitasking), String(c.minutes), c.status]);
    }
  }

  try {
    if (format === "sheets") {
      // Create spreadsheet then update cells
      const createRes = await fetch("https://sheets.googleapis.com/v4/sheets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { title: `sleek-export-${new Date().toISOString().slice(0, 10)}` } })
      });
      if (!createRes.ok) return NextResponse.json({ error: "Sheets create failed" }, { status: 502 });
      const created = await createRes.json();
      const spreadsheetId = created.spreadsheetId;
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=RAW`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows })
      });
      if (!updateRes.ok) return NextResponse.json({ error: "Sheets write failed" }, { status: 502 });
      return NextResponse.json({ ok: true, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
    }
    if (format === "docs") {
      const docsRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: `sleek-report-${new Date().toISOString().slice(0, 10)}` })
      });
      if (!docsRes.ok) return NextResponse.json({ error: "Docs create failed" }, { status: 502 });
      const doc = await docsRes.json();
      const docId = doc.documentId;
      // Batch update with textual content
      const text = rows.map((r) => r.join("  ")).join("\n");
      const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text } }] })
      });
      if (!updateRes.ok) return NextResponse.json({ error: "Docs write failed" }, { status: 502 });
      return NextResponse.json({ ok: true, url: `https://docs.google.com/document/d/${docId}/edit` });
    }
    if (format === "drive") {
      // Upload a plain-text CSV to Drive (multipart)
      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
      const boundary = "sleekboundary";
      const metadata = { name: `sleek-export-${new Date().toISOString().slice(0, 10)}.csv`, mimeType: "text/csv" };
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--`;
      const driveRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=webViewLink", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipart
      });
      if (!driveRes.ok) return NextResponse.json({ error: "Drive upload failed" }, { status: 502 });
      const file = await driveRes.json();
      return NextResponse.json({ ok: true, url: file.webViewLink });
    }
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  } catch (e: any) {
    console.error("Workspace export threw", e?.message ?? "unknown");
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

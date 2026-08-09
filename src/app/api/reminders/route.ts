import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";
import { rateLimit } from "@/lib/rateLimit";
import { getUserInfo } from "@/lib/tier";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = await prisma.reminder.findMany({
    where: { userId: session.userId },
    orderBy: { time: "asc" }
  });
  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const rl = rateLimit(req, { max: 20, windowMs: 60_000, keyPrefix: "reminders-post" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserInfo(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const time = String(body.time || "");
  if (!TIME_RE.test(time)) return NextResponse.json({ error: "Time must be HH:MM (24h)" }, { status: 400 });

  const label = String(body.label || "Reminder").replace(/[\r\n]/g, " ").trim().slice(0, 120) || "Reminder";
  const message = typeof body.message === "string"
    ? body.message.replace(/[<>]/g, "").slice(0, 2000)
    : "";
  const habitId = typeof body.habitId === "string" ? body.habitId : null;
  // Ownership check on the FK: don't let a user attach their reminder to
  // another user's habit (would create a dangling/cross-user reference).
  if (habitId) {
    const owned = await prisma.habit.findUnique({ where: { id: habitId }, select: { userId: true } });
    if (!owned || owned.userId !== session.userId) {
      return NextResponse.json({ error: "Invalid habit reference" }, { status: 400 });
    }
  }

  const count = await prisma.reminder.count({ where: { userId: session.userId } });

  const limit = user.tier === "basic_pro" || user.tier === "ultra_pro" ? 50 : 10;
  if (count >= limit) {
    return NextResponse.json({
      error: `Max ${limit} reminders on your plan. Upgrade to Basic Pro for unlimited.`
    }, { status: 400 });
  }

  const reminder = await prisma.reminder.create({
    data: { userId: session.userId, habitId, time, label, message, enabled: true }
  });
  return NextResponse.json({ reminder });
}

export async function PATCH(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.label === "string") data.label = body.label.replace(/[\r\n]/g, " ").trim().slice(0, 120);
  if (typeof body.message === "string") data.message = body.message.replace(/[<>]/g, "").slice(0, 2000);
  if (typeof body.time === "string" && TIME_RE.test(body.time)) data.time = body.time;

  const updated = await prisma.reminder.update({ where: { id }, data });
  return NextResponse.json({ reminder: updated });
}

export async function DELETE(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.reminder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
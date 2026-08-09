import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteGWorkspaceToken } from "@/lib/gworkspace";
import { checkCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  session.userId = undefined;
  session.email = undefined;
  session.destroy();
  try { await deleteGWorkspaceToken(); } catch { /* best effort */ }
  return NextResponse.json({ ok: true });
}

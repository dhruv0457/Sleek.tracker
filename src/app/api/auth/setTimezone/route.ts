import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tz = String(body.timezone || "").trim();
  if (!tz) return NextResponse.json({ error: "Missing timezone" }, { status: 400 });

  // Validate it's a real IANA zone that Intl can resolve (throws otherwise).
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  // Only set if missing — never silently overwrite a user's explicit choice.
  const existing = await prisma.userSettings.findUnique({ where: { userId: session.userId } });
  if (!existing?.timezone) {
    await prisma.userSettings.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, timezone: tz },
      update: { timezone: tz }
    });
  }
  return NextResponse.json({ ok: true, timezone: existing?.timezone ?? tz });
}

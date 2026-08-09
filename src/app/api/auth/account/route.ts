import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

const MAX_AVATAR_LEN = 350_000; // ~256 KB after base64 decode
export async function PATCH(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, avatar, bio, locality } = body;

  let avatarValue: string | null | undefined = undefined;
  if (avatar === null) avatarValue = null;
  else if (typeof avatar === "string") {
    if (avatar.length > MAX_AVATAR_LEN) {
      return NextResponse.json({ error: "Avatar too large (max 256 KB)" }, { status: 400 });
    }
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(avatar) && !/^https:\/\/\S+$/i.test(avatar)) {
      return NextResponse.json({ error: "Avatar must be an image file or an https URL" }, { status: 400 });
    }
    avatarValue = avatar;
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: typeof name === "string" ? name.slice(0, 80) : undefined,
      avatar: avatarValue,
      bio: typeof bio === "string" ? bio.slice(0, 280) : undefined,
      locality: typeof locality === "string" ? locality.slice(0, 120) : undefined
    },
    select: { id: true, name: true, avatar: true, bio: true, email: true, locality: true }
  });
  return NextResponse.json({ user: updated });
}

// Settings update (multitasking default, email prefs, auto-skip, week start)
export async function PUT(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fields = ["multitaskingDefault", "emailsMorning", "emailsEvening", "pushEnabled", "autoSkipOn", "weekStartMon", "weeklyMondayReminder"];
  const data: Record<string, boolean | string | null> = {};
  for (const k of fields) {
    if (typeof body[k] === "boolean") data[k] = body[k];
  }
  // Theme is a string ("light" | "dark") — validated against allow-list.
  if (typeof body.theme === "string" && ["light", "dark"].includes(body.theme)) {
    data.theme = body.theme;
  }
  // Timezone — store/overwrite the IANA string; null clears it (falls back to server clock).
  if (body.timezone === null) data.timezone = null;
  else if (typeof body.timezone === "string") {
    try { Intl.DateTimeFormat(undefined, { timeZone: body.timezone }); data.timezone = body.timezone; }
    catch { /* invalid tz — ignore */ }
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...data },
    update: data
  });
  return NextResponse.json({ settings });
}

/**
 * DELETE /api/auth/account
 *
 * Body: { nameConfirm: string }
 *
 * Verifies the typed name matches the user's account name (case-insensitive,
 * trimmed) — no password required. Before deleting the live User row, a
 * lightweight summary is archived into a `PastUser` row (reference-only;
 * re-registration creates a clean slate with no data restored).
 */
export async function DELETE(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nameConfirm = String(body.nameConfirm || "").trim();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      settings: true,
      habits: { include: { checkins: true } },
      badges: true,
      trophies: true,
      reminders: true,
      focusSessions: true,
      achievements: true,
      aiMessages: true,
      aiVerifications: true,
      logs: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const accountName = (user.name || user.email?.split("@")[0] || "").trim();
  if (!nameConfirm || nameConfirm.toLowerCase() !== accountName.toLowerCase()) {
    return NextResponse.json({ error: "The name you entered doesn't match your account name." }, { status: 400 });
  }

  // Minimal archive — just counts so we know what the user had, no data
  // is ever restored into a new account. Format: "H:5 C:142 B:3 T:1 ..."
  const summary = `Tier:${user.tier} Trial:${user.trialEndAt?.toISOString().slice(0,10)??"none"} Habits:${user.habits.length} Checkins:${user.habits.reduce((s,h)=>s+h.checkins.length,0)} Badges:${user.badges.length} Trophies:${user.trophies.length} Reminders:${user.reminders.length} Sessions:${user.focusSessions.length} AI:${user.aiMessages.length}`;

  const snapshot = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    joined: user.createdAt?.toISOString().slice(0, 10) ?? null,
    deletedAt: new Date().toISOString(),
    summary,
  });

  await prisma.pastUser.upsert({
    where: { email: user.email },
    create: {
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      snapshot,
    },
    update: {
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      snapshot,
      deletedAt: new Date(),
    },
  });

  await prisma.user.delete({ where: { id: session.userId } });
  session.destroy();
  return NextResponse.json({ ok: true });
}

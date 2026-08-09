/* POST /api/reminders/deliver?tz=...
   Called by the client every 30-60 seconds. For each user reminder whose
   time = current HH:MM (in the user's timezone) AND enabled AND hasn't
   been delivered in the last 90 seconds: returns the reminder object so
   the client can fire a browser Notification, AND queues an email if
   the user opted in.
   Body-less invocation — authed by session cookie. */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendMail, reminderEmail } from "@/lib/mailer";
import { isHabitScheduledOnDate } from "@/lib/schedule";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

interface Deliverable {
  id: string;
  label: string;
  time: string;
  habitName?: string | null;
  viaEmail?: boolean;
}

// In-memory "last delivered" memo so we don't re-fire inside the same minute.
// Keyed by `${userId}:${reminderId}:${HH:MM}:${YYYY-MM-DD}`.
const deliveredRecently = new Map<string, number>();

// Monday-morning task digest — fires once on Mondays around 08:00 local time
// when the user has opted in (settings.weeklyMondayReminder). The digest sums
// the user's habits scheduled for that Monday and emails them an agenda.
async function maybeMondayDigest(userId: string, user: any, dateStr: string, hh: string): Promise<Deliverable | null> {
  const wantMonday = user?.settings?.weeklyMondayReminder === true;
  if (!wantMonday) return null;
  const now = new Date(dateStr + "T00:00:00");
  const isMonday = now.getDay() === 1; // 0=Sun..6=Sat
  if (!isMonday) return null;
  // Fire once in the 08:00 local window.
  if (hh !== "08") return null;
  const key = `${userId}:monday-digest:${dateStr}`;
  if (deliveredRecently.has(key)) return null;
  deliveredRecently.set(key, Date.now());

  const habits = await prisma.habit.findMany({
    where: { userId },
    select: { id: true, name: true, schedule: true, createdAt: true },
  });
  const todays = habits.filter((h: any) => isHabitScheduledOnDate(h.schedule, dateStr, h.createdAt));
  if (todays.length === 0) return null;

  const lines = todays.map((h: any, i: number) => `${i + 1}. ${h.name}`).join("\n");
  const label = `Morning agenda — ${todays.length} task${todays.length === 1 ? "" : "s"} for Monday`;

  if (user.email) {
    const { subject, text } = reminderEmail(
      user.name || "friend",
      label,
      `${label}\n\nHere's your Monday plan:\n${lines}\n\nLight up the night. — sleek`
    );
    sendMail(user.email, subject, text).catch(() => {});
  }

  return { id: "monday-digest", label, time: "08:00", habitName: todays[0]?.name ?? null, viaEmail: true };
}

export async function POST(req: NextRequest) {
  // This route sends real emails as a side effect of a POST, so we must guard
  // against CSRF (a cross-site <form> can silently trigger mail spam on a
  // logged-in victim's behalf) and rate-limit to bound abuse.
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const rl = rateLimit(req, { max: 30, windowMs: 60_000, keyPrefix: "reminders-deliver" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  let tz = url.searchParams.get("tz") || undefined;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { settings: true }
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.settings?.timezone) tz = user.settings.timezone;
  const now = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const curTime = `${hh}:${mm}`;
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id, enabled: true, time: curTime },
    include: { habit: { select: { name: true } } }
  });

  const settings = user.settings;
  const emailOn = settings?.pushEnabled !== false; // default true unless explicitly off
  const out: Deliverable[] = [];

  for (const r of reminders) {
    const key = `${user.id}:${r.id}:${curTime}:${dateStr}`;
    if (deliveredRecently.has(key)) continue;
    deliveredRecently.set(key, Date.now());
    // Trim memory occasionally
    if (deliveredRecently.size > 1000) {
      const cutoff = Date.now() - 5 * 60 * 1000;
      for (const [k, ts] of deliveredRecently) if (ts < cutoff) deliveredRecently.delete(k);
    }

    const d: Deliverable = { id: r.id, label: r.label, time: r.time, habitName: r.habit?.name ?? null };

    // Email: send if user opted in (use settings.pushEnabled as the opt-in flag,
    // since the spec uses "Both" for reminders infra).
    if (emailOn) {
      const { subject, text } = reminderEmail(user.name || "friend", r.label, r.time);
      sendMail(user.email, subject, text).catch(() => {});
      d.viaEmail = true;
    }
    out.push(d);
  }

  // Bonus: weekly Monday-morning task digest (opt-in via settings).
  const digest = await maybeMondayDigest(user.id, user, dateStr, hh).catch(() => null);
  if (digest) out.push(digest);

  return NextResponse.json({ now: curTime, date: dateStr, due: out });
}


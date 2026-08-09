import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo, canUseAutoEmail } from "@/lib/tier";
import { sendMail, morningAgendaEmail, eveningSummaryEmail, reminderEmail } from "@/lib/mailer";
import { userTodayStr, userNowHHMM, userNowHour } from "@/lib/now";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
// Vercel Cron can run for up to 60s on the free Hobby plan when called by
// Vercel's scheduler — keep maxDuration capped so the function marks itself
// as timeout-safe.
export const maxDuration = 60;

// Track "sent today" markers using DailyLog.summary JSON string
async function isSent(userId: string, date: string, marker: string): Promise<boolean> {
  const log = await prisma.dailyLog.findUnique({ where: { userId_date: { userId, date } } });
  if (!log) return false;
  try {
    const obj = JSON.parse(log.summary || "{}");
    const markers = obj.sentMarkers;
    if (Array.isArray(markers)) return markers.includes(marker);
    return false;
  } catch {
    return false;
  }
}

async function markSent(userId: string, date: string, marker: string): Promise<void> {
  const log = await prisma.dailyLog.findUnique({ where: { userId_date: { userId, date } } });
  let obj: any = {};
  try { obj = JSON.parse(log?.summary || "{}"); } catch {}
  obj.sentMarkers = obj.sentMarkers || [];
  if (!obj.sentMarkers.includes(marker)) obj.sentMarkers.push(marker);
  await prisma.dailyLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, summary: JSON.stringify(obj), intensityAvg: 0 },
    update: { summary: JSON.stringify(obj) }
  });
}

/**
 * Run the morning/evening/reminder cycle for a single user. Returns the
 * number of emails actually sent this pass.
 */
async function runTickForUser(userId: string): Promise<number> {
  const user = await getUserInfo(userId);
  if (!user) return 0;
  if (!canUseAutoEmail(user)) {
    console.log(`[cron/tick] skipping ${user.email} (tier=${user.tier}, trialDaysLeft=0, no auto-email access)`);
    return 0;
  }

  const [today, nowHHMM, localHour] = await Promise.all([
    userTodayStr(userId),
    userNowHHMM(userId),
    userNowHour(userId)
  ]);
  let sent = 0;

  const habits = await prisma.habit.findMany({ where: { userId }, include: { checkins: true } });
  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  // 1. Morning agenda (one-time per day at/around 06:00 local)
  if (settings?.emailsMorning && localHour >= 6 && localHour < 8) {
    if (!(await isSent(userId, today, "morning"))) {
      const list = habits.map((h: typeof habits[number]) => `${h.name}${h.requiresCamera ? " (verify with camera)" : ""}`);
      const { subject, text } = morningAgendaEmail(user.name || "", list);
      if (await sendMail(user.email, subject, text)) {
        await markSent(userId, today, "morning");
        sent++;
      }
    }
  }

  // 2. Evening summary (one-time per day at/around 22:00 local)
  if (settings?.emailsEvening && localHour >= 22) {
    if (!(await isSent(userId, today, "evening"))) {
      const done: string[] = []; const miss: string[] = [];
      for (const h of habits) {
        const c = h.checkins.find((x: typeof h.checkins[number]) => x.date === today);
        if (c?.completed) done.push(h.name);
        else miss.push(h.name);
      }
      const { subject, text } = eveningSummaryEmail(user.name || "", done, miss);
      if (await sendMail(user.email, subject, text)) {
        await markSent(userId, today, "evening");
        sent++;
      }
    }
  }

  // 4. Midnight auto-skip: for every camera-required habit that was not
  //    completed today and the local time is past 23:59, auto-skip it.
  //    We run this at hour 23 so the day doesn't flip before we process.
  if (localHour >= 23) {
    const cameraHabits = habits.filter((h: typeof habits[number]) => h.requiresCamera);
    for (const h of cameraHabits) {
      const c = h.checkins.find((x: typeof h.checkins[number]) => x.date === today);
      if (!c || (!c.completed && c.status !== "skipped")) {
        const marker = `autoskip-camera:${h.id}:${today}`;
        if (await isSent(userId, today, marker)) continue;
        try {
          await prisma.checkIn.create({
            data: {
              habitId: h.id,
              date: today,
              completed: false,
              status: "skipped",
              locked: true,
              note: "Auto-skipped — camera verification required but not completed.",
              minutes: 0,
              intensity: 0,
            }
          });
          await markSent(userId, today, marker);
          console.log(`[cron/tick] auto-skipped camera habit ${h.id} for user ${userId}`);
        } catch (_) {
          // if checkin already exists (race), skip silently
        }
      }
    }
  }

  // 3. Custom reminders — match the USER's local HH:MM, not the server clock.
  const reminders = await prisma.reminder.findMany({
    where: { userId, enabled: true, time: nowHHMM },
    include: { habit: true }
  });
  for (const r of reminders) {
    const marker = `reminder:${r.id}:${today}`;
    if (await isSent(userId, today, marker)) continue;
    const { subject, text } = reminderEmail(user.name || "", r.label || r.habit?.name || "your task", r.time);
    console.log(`[cron/tick] sending reminder to ${user.email}: label=${r.label}, time=${r.time}, localTime=${nowHHMM}`);
    if (await sendMail(user.email, subject, text)) {
      await markSent(userId, today, marker);
      sent++;
    }
  }

  return sent;
}

/**
 * GET /api/cron/tick
 *
 * Two calling patterns:
 *
 *  1. Client-side poll while the dashboard is open (the existing pattern).
 *     Authed by the user's session cookie. Sends emails for THAT user only.
 *
 *  2. Vercel Cron / external scheduler. Unauthed, but must carry the
 *     `Authorization: Bearer <CRON_SECRET>` header. Iterates every user with
 *     auto-email enabled and runs the morning/evening/reminder cycle in their
 *     own timezone. Without CRON_SECRET configured, this codepath 401s.
 */
export async function GET(req: NextRequest) {
  // ── Path 2: Server-side cron (no session, CRON_SECRET header) ──────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) {
      // Find users who have user settings with auto-email on.
      // Use a reasonable cap so a runaway loop can't OOM the lambda.
      const BATCH = Number(process.env.CRON_USER_BATCH || 200);
      const users = await prisma.user.findMany({
        where: { settings: { isNot: null } },
        select: { id: true },
        take: BATCH,
      });
      let total = 0;
      for (const u of users) {
        try {
          total += await runTickForUser(u.id);
        } catch {
          // single-user failures must not abort the whole batch
        }
      }
      return NextResponse.json({ ok: true, mode: "cron", users: users.length, sent: total });
    }
  }

  // ── Path 1: Client poll (existing session-based behaviour) ────────────────
  const rl = rateLimit(req, { max: 30, windowMs: 60_000, keyPrefix: "cron-tick" });
  if (!rl.ok) return NextResponse.json({ ok: true, sent: 0, throttled: true }, { status: 429 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ ok: true, sent: 0 });

  const sent = await runTickForUser(session.userId).catch(() => 0);
  return NextResponse.json({ ok: true, mode: "client", sent });
}

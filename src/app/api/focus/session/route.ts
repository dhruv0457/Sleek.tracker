/* POST /api/focus/session — record a completed focus session.
   Used from the /focus page; updates the Trophy count AND returns the
   per-session trophy accrual so the UI can flash how much was earned. */

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";
import { computeTotalTrophies, focusTrophies, computeFocusBadges } from "@/lib/trophies";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "focus.new" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { durationSec, completed } = (await req.json().catch(() => ({}))) as {
    durationSec?: number;
    completed?: boolean;
  };

  if (!durationSec || typeof durationSec !== "number" || durationSec < 60 || durationSec > 28800) {
    return NextResponse.json({ error: "durationSec required, must be 60–28800" }, { status: 400 });
  }

  const minutes = Math.floor(durationSec / 60);
  const earned = focusTrophies(minutes);

  await prisma.focusSession.create({
    data: {
      userId: session.userId,
      durationSec,
      completed: completed ?? true
    }
  });

  // ─── Recalculate trophies via the same lib ───
  const [habitsRaw, aiV, focusSessions] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId, passed: true } }),
    prisma.focusSession.findMany({ where: { userId: session.userId, completed: true } })
  ]);

  type HR = typeof habitsRaw[number];
  type CR = HR["checkins"][number];

  const completedCheckins =
    habitsRaw.flatMap((h: HR) => h.checkins).filter((c: CR) => c.completed);
  const perfectDays = computePerfectDayCount(habitsRaw as any);
  const totalFocusMinutes = focusSessions.reduce((s: number, f: typeof focusSessions[number]) => s + Math.floor(f.durationSec / 60), 0);

  const count = computeTotalTrophies({
    totalCheckins: completedCheckins.length,
    totalFocusMinutes,
    aiVerifiedCount: aiV.length,
    perfectDays
  });

  await prisma.trophy.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, count },
    update: { count }
  }).catch(() => null);

  const completedSessionCount = focusSessions.length + 1; // +1 because we just created one not in focusSessions snapshot
  const focusBadges = computeFocusBadges(completedSessionCount);

  return NextResponse.json({
    trophies: count,
    earnedTrophies: earned,
    completedSessionCount,
    focusBadges
  });
}

/* Light perfect-day counter borrowed from badges route logic (same pattern). */
function computePerfectDayCount(
  habits: { schedule?: string; createdAt?: Date | string; checkins: { date: string; completed: boolean }[] }[]
): number {
  const dateMap: Record<string, { done: number; sched: number }> = {};
  const DOF: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

  const scheduledOn = (h: typeof habits[number], dateStr: string) => {
    const s = h.schedule || "daily";
    if (s === "daily") return true;
    if (s.startsWith("weekly:")) {
      return s.slice(7).split(",").includes(DOF[new Date(dateStr + "T00:00:00").getDay()]);
    }
    return true;
  };
  const createdBefore = (ca: Date | string | undefined, dateStr: string) => {
    if (!ca) return true;
    return new Date(dateStr + "T00:00:00").getTime() >= (typeof ca === "string" ? new Date(ca).getTime() : (ca as Date).getTime()) - 86_400_000;
  };

  for (const h of habits) {
    for (const c of h.checkins) {
      if (!dateMap[c.date]) dateMap[c.date] = { done: 0, sched: 0 };
      if (c.completed && scheduledOn(h, c.date) && createdBefore(h.createdAt, c.date)) dateMap[c.date].done++;
    }
  }
  for (const d of Object.keys(dateMap)) {
    let sched = 0;
    for (const h of habits) {
      if (createdBefore(h.createdAt, d) && scheduledOn(h, d)) sched++;
    }
    dateMap[d].sched = sched;
  }
  return Object.values(dateMap).filter(v => v.sched > 0 && v.done >= v.sched).length;
}
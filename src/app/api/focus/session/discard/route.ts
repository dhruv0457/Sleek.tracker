/* POST /api/focus/session/discard — log a discarded focus session.
   Records the session as completed=false AND deducts focus minutes from
   the trophy total so the user sees their trophy count drop (visible
   penalty for breaking the promise). Returns the explicit trophy
   deduction amount and the updated total. */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";
import { computeTotalTrophies, deductFocusTrophies } from "@/lib/trophies";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "focus.discard" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const durationSec = typeof body.durationSec === "number" && body.durationSec >= 60 && body.durationSec <= 28800
    ? body.durationSec
    : null;

  const minutes = durationSec ? Math.floor(durationSec / 60) : 0;
  const deducted = deductFocusTrophies(minutes);

  // Store discarded session (completed=false) so it appears in history
  await prisma.focusSession.create({
    data: {
      userId: session.userId,
      durationSec: durationSec || 0,
      completed: false,
    },
  });

  // Recalculate trophies — only COMPLETED focus minutes count,
  // so the discard effectively removes these minutes from the total
  // (the prior session hadn't been saved yet, but just in case).
  const [habitsRaw, aiV, focusSessions] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId, passed: true } }),
    prisma.focusSession.findMany({ where: { userId: session.userId, completed: true } }),
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
    perfectDays,
  });

  await prisma.trophy.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, count },
    update: { count },
  }).catch(() => null);

  return NextResponse.json({ trophies: count, deducted, deductedTrophies: deducted });
}

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
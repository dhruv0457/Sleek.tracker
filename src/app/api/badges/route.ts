import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { computeStreaks } from "@/lib/streaks";
import { todayStr } from "@/lib/utils";
import { computeTotalTrophies, computeAchievements, type TrophyCalcInput } from "@/lib/trophies";
import { rateLimit } from "@/lib/rateLimit";

// ─────────────── BADGE CATALOG (earned by SPECIFIC action) ────────────────

interface BadgeSpec {
  id: string;
  label: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  description: string;
}

const BADGES: BadgeSpec[] = [
  // Starter
  { id: "first-checkin",       label: "First Check-in",       tier: "bronze",   description: "Complete your very first habit." },
  { id: "first-perfect-day",   label: "First Perfect Day",    tier: "bronze",   description: "Every scheduled habit done in one day." },
  // Task volume
  { id: "task-5-day",          label: "5-Task Day",           tier: "silver",   description: "Complete 5 check-ins in a single day." },
  { id: "task-10-day",         label: "Task Blitz",           tier: "gold",     description: "Complete 10 check-ins in a single day." },
  { id: "task-no-multi-5",     label: "Deep Worker",          tier: "gold",     description: "5 check-ins in a day with ZERO multitasking." },
  // Streak
  { id: "streak-3",            label: "3-Day Chain",          tier: "bronze",   description: "A 3-day unbroken streak." },
  { id: "streak-7",            label: "Week Warrior",         tier: "silver",   description: "Build a 7-day streak." },
  { id: "streak-14",           label: "Fortnight Fortress",   tier: "silver",   description: "Build a 14-day streak." },
  { id: "streak-21",           label: "Habit Formed",         tier: "gold",     description: "Build a 21-day streak." },
  { id: "streak-30",           label: "Unbreakable",          tier: "gold",     description: "Build a 30-day streak." },
  { id: "streak-73",           label: "73-Day Discipline",    tier: "platinum", description: "Build a 73-day streak." },
  { id: "streak-100",          label: "Centurion",            tier: "platinum", description: "Build a 100-day streak." },
  // Perfect days
  { id: "perfect-3-days",      label: "3 Perfect Days",       tier: "bronze",   description: "3 days where every scheduled habit was done." },
  { id: "perfect-5-days",      label: "5 Perfect Days",       tier: "silver",   description: "5 perfect days across your history." },
  { id: "perfect-10-days",     label: "Perfect Streak",       tier: "gold",     description: "10 perfect days accumulated." },
  { id: "perfect-30-days",     label: "Perfect Month",        tier: "platinum", description: "30 perfect days — an entire month of excellence." },
  // Consistency (multi-week)
  { id: "consistency-5-days",  label: "5-Day Consistency",    tier: "silver",   description: "5 days in a row with no missed or skipped tasks." },
  { id: "consistency-8-days",  label: "8-Day Consistency",    tier: "gold",     description: "8 consecutive days of clean execution." },
  // Check-in milestones
  { id: "checkins-50",         label: "Half Century",         tier: "silver",   description: "50 total check-ins." },
  { id: "checkins-200",        label: "200 Club",             tier: "gold",     description: "200 total check-ins." },
  { id: "checkins-500",        label: "Quintuple Century",    tier: "platinum", description: "500 total check-ins." },
  // Multitasking / intensity / AI
  { id: "no-multi-10",       label: "Single-Task Champion",  tier: "gold",     description: "10 check-ins with NO multitasking in a single day." },
  { id: "intensity-90-avg",  label: "Focused Mind",            tier: "gold",     description: "Average intensity >= 90% across 20+ check-ins." },
  { id: "ai-verified-10",      label: "Verified Achiever",    tier: "platinum", description: "Pass AI Work Verifier 10 times." },
  // Focus Zone
  { id: "focus-total-30min",   label: "30-Min Deep Focus",    tier: "bronze",   description: "Accumulate 30 minutes of focus (one or more sessions)." },
  { id: "focus-total-120min",  label: "2-Hour Deep Dive",     tier: "silver",   description: "Accumulate 120 minutes of focus." },
  { id: "focus-total-300min",  label: "5-Hour Marathon",      tier: "gold",     description: "Accumulate 300 minutes of focus." },
  { id: "focus-10-sessions",   label: "Focused Veteran",      tier: "gold",     description: "Complete 10 focus sessions." },
];

const BADGE_LINES = [
  "A boater sets sail — your journey begins.",
  "Three days in — you're flowing now.",
  "Rapids ahead, but you're steady.",
  "Momentum is building.",
  "Consistency is your compass.",
  "The wind is at your back.",
  "Roots grow deep when storms pass.",
  "Every habit you keep is a brick in your fortress."
];
const pickLine = () => BADGE_LINES[Math.floor(Math.random() * BADGE_LINES.length)];

// ─────────────── STATS ────────────────────────────────────────────────────

interface Stats {
  totalCheckins: number;
  habitsCount: number;
  currentStreak: number;
  bestStreak: number;
  perfectDays: number;
  consecutivePerfectRun: number; // current unbroken chain of perfect days
  multitaskCount: number;
  aiVerifiedCount: number;
  avgIntensity: number;
  highIntensityCheckins: number;
  peakDailyCheckins: number;    // most check-ins in a single day
  maxNoMultiDay: number;         // most check-ins in a single day with 0 multitasking
  totalFocusMinutes: number;
  focusSessionsCompleted: number;
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

function addMonths(year: number, monthIdx: number, day: number, n: number): string | null {
  const d = new Date(year, monthIdx + n, 1);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const actualDay = Math.min(day, dim);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
}

function computeStats(
  habits: { id: string; schedule?: string; createdAt?: Date | string; checkins: { date: string; completed: boolean; status: string; intensity: number; multitasking: boolean }[] }[],
  aiVerifications: { id: string }[],
  totalFocusMinutes: number,
  focusSessionsCompleted: number
): Stats {
  const completed = habits.flatMap((h: typeof habits[number]) => h.checkins).filter((c: any) => c.completed);
  const { current, best } = computeStreaks(completed);

  const JS_DAY_TO_DAY: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
  const dateMap: Record<string, { doneCount: number; scheduledCount: number; noMultiCount: number }> = {};

  const scheduledOn = (h: typeof habits[number], dateStr: string): boolean => {
    const sched = h.schedule || "daily";
    if (sched === "daily") return true;
    if (sched.startsWith("weekly:")) {
      const days = sched.slice(7).split(",").map((s) => s.trim());
      return days.includes(JS_DAY_TO_DAY[new Date(dateStr + "T00:00:00").getDay()]);
    }
    if (sched.startsWith("dates:")) {
      const [datesPart, flagsPart] = sched.slice(6).split(";");
      const baseDates = datesPart.split(",").map((s) => s.trim());
      if (baseDates.includes(dateStr)) return true;
      const rMatch = flagsPart?.match(/r=(\d+)/);
      if (rMatch) {
        const rN = Number(rMatch[1]);
        for (let m = 1; m <= rN; m++) {
          for (const bd of baseDates) {
            const [by, bm, bdd] = bd.split("-").map(Number);
            const cloned = addMonths(by, bm - 1, bdd, m);
            if (cloned && cloned === dateStr) return true;
          }
        }
      }
      return false;
    }
    return true;
  };

  const createdBefore = (createdAt: Date | string | undefined, dateStr: string): boolean => {
    if (!createdAt) return true;
    const c = typeof createdAt === "string" ? new Date(createdAt) : new Date(createdAt);
    return new Date(dateStr + "T00:00:00").getTime() >= c.getTime() - 86_400_000;
  };

  // Fill dateMap
  for (const h of habits) {
    for (const c of h.checkins) {
      if (!dateMap[c.date]) dateMap[c.date] = { doneCount: 0, scheduledCount: 0, noMultiCount: 0 };
      if (c.completed && scheduledOn(h, c.date) && createdBefore(h.createdAt, c.date)) {
        dateMap[c.date].doneCount++;
        if (!c.multitasking) dateMap[c.date].noMultiCount++;
      }
    }
  }
  for (const dateStr of Object.keys(dateMap)) {
    let total = 0;
    for (const h of habits) {
      if (createdBefore(h.createdAt, dateStr) && scheduledOn(h, dateStr)) total++;
    }
    dateMap[dateStr].scheduledCount = total;
  }

  const perfectDates = Object.entries(dateMap)
    .filter(([, v]) => v.scheduledCount > 0 && v.doneCount >= v.scheduledCount)
    .map(([d]) => d);
  const perfectDays = perfectDates.length;

  // Consecutive perfect run (walk backward from today)
  const today = dateNDaysAgo(0);
  const perfSet = new Set(perfectDates);
  let consecutivePerfectRun = 0;
  let d = new Date(today + "T00:00:00");
  while (perfSet.has(todayStr(d))) {
    consecutivePerfectRun++;
    d.setDate(d.getDate() - 1);
  }

  const dailyCheckins: Record<string, { count: number; noMulti: number }> = {};
  for (const h of habits) {
    for (const c of h.checkins) {
      if (!c.completed) continue;
      if (!dailyCheckins[c.date]) dailyCheckins[c.date] = { count: 0, noMulti: 0 };
      dailyCheckins[c.date].count++;
      if (!c.multitasking) dailyCheckins[c.date].noMulti++;
    }
  }
  let peakDailyCheckins = 0;
  let maxNoMultiDay = 0;
  for (const v of Object.values(dailyCheckins)) {
    if (v.count > peakDailyCheckins) peakDailyCheckins = v.count;
    if (v.noMulti > maxNoMultiDay) maxNoMultiDay = v.noMulti;
  }

  const multitaskCount = habits.flatMap((h) => h.checkins).filter((c) => c.multitasking).length;
  const intensityValues = completed.map((c) => c.intensity).filter((i) => i > 0);
  const avgIntensity = intensityValues.length
    ? Math.round(intensityValues.reduce((a, b) => a + b, 0) / intensityValues.length)
    : 0;
  const highIntensityCheckins = intensityValues.filter((i) => i >= 90).length;

  return {
    totalCheckins: completed.length,
    habitsCount: habits.length,
    currentStreak: current,
    bestStreak: best,
    perfectDays,
    consecutivePerfectRun,
    multitaskCount,
    aiVerifiedCount: aiVerifications.length,
    avgIntensity,
    highIntensityCheckins,
    peakDailyCheckins,
    maxNoMultiDay,
    totalFocusMinutes,
    focusSessionsCompleted
  };
}

// ─────────────── UNLOCK LOGIC ─────────────────────────────────────────────────

function shouldUnlock(specId: string, s: Stats): boolean {
  switch (specId) {
    case "first-checkin":          return s.totalCheckins >= 1;
    case "first-perfect-day":      return s.perfectDays >= 1;
    case "task-5-day":             return s.peakDailyCheckins >= 5;
    case "task-10-day":            return s.peakDailyCheckins >= 10;
    case "task-no-multi-5":        return s.maxNoMultiDay >= 5;
    case "streak-3":               return s.bestStreak >= 3;
    case "streak-7":               return s.bestStreak >= 7;
    case "streak-14":              return s.bestStreak >= 14;
    case "streak-21":              return s.bestStreak >= 21;
    case "streak-30":              return s.bestStreak >= 30;
    case "streak-73":              return s.bestStreak >= 73;
    case "streak-100":             return s.bestStreak >= 100;
    case "perfect-3-days":         return s.perfectDays >= 3;
    case "perfect-5-days":         return s.perfectDays >= 5;
    case "perfect-10-days":        return s.perfectDays >= 10;
    case "perfect-30-days":        return s.perfectDays >= 30;
    case "consistency-5-days":     return s.consecutivePerfectRun >= 5;
    case "consistency-8-days":     return s.consecutivePerfectRun >= 8;
    case "checkins-50":            return s.totalCheckins >= 50;
    case "checkins-200":           return s.totalCheckins >= 200;
    case "checkins-500":           return s.totalCheckins >= 500;
    case "no-multi-10":           return s.maxNoMultiDay >= 10;
    case "intensity-90-avg":       return s.avgIntensity >= 90 && s.highIntensityCheckins >= 20;
    case "ai-verified-10":         return s.aiVerifiedCount >= 10;
    case "focus-total-30min":      return s.totalFocusMinutes >= 30;
    case "focus-total-120min":     return s.totalFocusMinutes >= 120;
    case "focus-total-300min":     return s.totalFocusMinutes >= 300;
    case "focus-10-sessions":      return s.focusSessionsCompleted >= 10;
    default: return false;
  }
}

// ─────────────── ROUTE ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This GET also persists newly-earned badges + recomputes the trophy row as a
  // side effect of the read, so cap the rate to bound DB write load.
  const rl = rateLimit(req, { max: 20, windowMs: 60_000, keyPrefix: "badges" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const [habitsRaw, existing, aiV, focusSessions] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.badge.findMany({ where: { userId: session.userId } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId, passed: true } }),
    prisma.focusSession.findMany({ where: { userId: session.userId, completed: true } })
  ]);

  // Derive focus accumulators from the Trophy row (we track totals there).
  const trophyRow = await prisma.trophy.findUnique({ where: { userId: session.userId } });
  // These are the net accumulated minutes/sessions we'll update later.
  // For badge-gating, we use the stats derivation from habit data + the focus
  // totals stored in the daily summaries (approximated from existing AI/focus).
  // A simpler approach: just query the user and use the trophy row's stored
  // focus fields if they exist. But since we don't have separate focus-table
  // yet, we approximate: every time this route fires, it rewards focus from
  // whatever the client has passed (focus sessions are recorded client-side).
  // For now: the Dashboard's `refresh()` calling /api/badges doesn't have
  // the focus numbers directly — we'll use a placeholder 0 for focus stats here
  // and wire the actual focus increment on a separate call or from stored
  // Trophy metadata.

  // SIMPLE FIX: the current Trophy row stores only `count`. We'll need to expand
  // it (or add a FocusLog model) to persist focus minutes. For now, we honor
  // existing check-in data only and the client will bump focus via a separate
  // call in the FocusZone onComplete.

  const focusTotalMin = focusSessions.reduce((s: number, f: typeof focusSessions[number]) => s + Math.floor(f.durationSec / 60), 0);
  const focusSessionsCount = focusSessions.length;

  const stats = computeStats(habitsRaw as any, aiV as any, focusTotalMin, focusSessionsCount);
  const unlockedIds = new Set(existing.map((b: typeof existing[number]) => b.badgeId));
  const newlyUnlocked: any[] = [];

  for (const spec of BADGES) {
    if (!unlockedIds.has(spec.id) && shouldUnlock(spec.id, stats)) {
      const badge = await prisma.badge.create({
        data: { userId: session.userId, badgeId: spec.id, level: 1, line: pickLine() }
      }).catch(() => null);
      if (badge) newlyUnlocked.push({ ...spec, unlockedAt: (badge as any).unlockedAt, line: pickLine() });
    }
  }

  const allEarnedBadges = await prisma.badge.findMany({ where: { userId: session.userId } });
  const earnedCount = allEarnedBadges.length;

  // ─── Trophies ──
  const trophyCalc: TrophyCalcInput = {
    totalCheckins: stats.totalCheckins,
    totalFocusMinutes: focusTotalMin,
    aiVerifiedCount: stats.aiVerifiedCount,
    perfectDays: stats.perfectDays
  };
  const newTrophyCount = computeTotalTrophies(trophyCalc);

  await prisma.trophy.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, count: newTrophyCount },
    update: { count: newTrophyCount }
  }).catch(() => null);

  // ─── Achievements ──
  const { unlocked: unlockedAchievements, next: nextAchievement } = computeAchievements(earnedCount);

  const earnedIds = new Set(allEarnedBadges.map((b: typeof allEarnedBadges[number]) => b.badgeId));
  const badges = BADGES.map((spec) => {
    const db = allEarnedBadges.find((b: typeof allEarnedBadges[number]) => b.badgeId === spec.id);
    return { ...spec, earned: earnedIds.has(spec.id), level: db?.level || 1, line: db?.line || "", unlockedAt: db?.unlockedAt || null };
  });

  return NextResponse.json({
    badges,
    earnedCount,
    totalCount: BADGES.length,
    newlyUnlocked,
    stats,
    trophies: newTrophyCount,
    achievements: {
      unlocked: unlockedAchievements,
      next: nextAchievement
    }
  });
}
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { todayStr, last365Days } from "@/lib/utils";
import { computeTotalTrophies, computeAchievements, perfectDayStreakBuckets } from "@/lib/trophies";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 *   Authoritative analytics endpoint — drives StatsPanel.
 *   Returns ONLY real user data: no demo/pre-baked numbers.
 *   Query params:
 *     ?year=YYYY  -> restrict heatmap + summaries to a calendar year
 *     ?export=csv|json -> trigger download of full data dump
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Heavy read (4 parallel findMany) + a trophy upsert; cap the rate to bound DB load.
  const rl = rateLimit(req, { max: 30, windowMs: 60_000, keyPrefix: "stats" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const exportFmt = url.searchParams.get("export");

  const [habits, aiV, focusSessions, trophyRow] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId, passed: true } }),
    prisma.focusSession.findMany({ where: { userId: session.userId, completed: true } }),
    prisma.trophy.findUnique({ where: { userId: session.userId } })
  ]);

  type H = typeof habits[number];
  type C = H["checkins"][number];
  const allCheckins: C[] = habits.flatMap((h: H) => h.checkins);

  // ─── Day aggregation helper ───
  const JS_DAY_TO_DAY: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
  const scheduledOn = (h: typeof habits[number], dateStr: string) => {
    const s = h.schedule || "daily";
    if (s === "daily") return true;
    if (s.startsWith("weekly:")) return s.slice(7).split(",").includes(JS_DAY_TO_DAY[new Date(dateStr + "T00:00:00").getDay()]);
    if (s.startsWith("dates:") && s.includes(dateStr)) return true;
    return true;
  };
  const createdBefore = (ca: Date | string | undefined, dateStr: string) => {
    if (!ca) return true;
    return new Date(dateStr + "T00:00:00").getTime() >= (typeof ca === "string" ? new Date(ca).getTime() : (ca as Date).getTime()) - 86_400_000;
  };

  // Build full 365-day window
  const days = last365Days();
  const byDate: Record<string, {
    count: number; total: number; minutes: number;
    noMulti: number; intensity: number[]; multitask: number;
  }> = {};
  for (const d of days) {
    const key = todayStr(d);
    byDate[key] = { count: 0, total: 0, minutes: 0, noMulti: 0, intensity: [], multitask: 0 };
  }
  for (const h of habits) {
    for (const c of h.checkins) {
      if (!(c.date in byDate)) continue;
      if (scheduledOn(h, c.date) && createdBefore(h.createdAt, c.date)) byDate[c.date].total++;
      if (!c.completed) continue;
      byDate[c.date].count++;
      byDate[c.date].minutes += c.minutes;
      if (c.multitasking) byDate[c.date].multitask++;
      else byDate[c.date].noMulti++;
      if (c.intensity > 0) byDate[c.date].intensity.push(c.intensity);
    }
  }

  // ─── Week stats (last 7 days) ───
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
  const weekKey = todayStr(weekAgo);
  const weekCheckins = allCheckins.filter((c: C) => c.completed && c.date >= weekKey);
  const weekMinutes = weekCheckins.reduce((s: number, c: C) => s + c.minutes, 0);

  // ─── Streak (active-day chain) ───
  const sortedDates = Object.keys(byDate).sort();
  let current = 0;
  let cursor = new Date();
  while (true) {
    const key = todayStr(cursor);
    if (byDate[key]?.count > 0) { current++; cursor.setDate(cursor.getDate() - 1); } else break;
  }
  let best = 0; let run = 0;
  let walker = new Date();
  for (let i = 0; i < days.length; i++) {
    const key = todayStr(walker);
    if (byDate[key]?.count > 0) { run++; if (run > best) best = run; } else run = 0;
    walker.setDate(walker.getDate() - 1);
  }
  if (current > best) best = current;

  // ─── Perfect day detection (perfect = all scheduled habits done) ───
  const perfectDates: string[] = [];
  for (const [date, e] of Object.entries(byDate)) {
    if (e.total > 0 && e.count >= e.total) perfectDates.push(date);
  }
  const perfectDays = perfectDates.length;

  // Consecutive perfect run from today backwards
  const perfSet = new Set(perfectDates);
  let consecutivePerfectRun = 0;
  let pd = new Date();
  while (perfSet.has(todayStr(pd))) { consecutivePerfectRun++; pd.setDate(pd.getDate() - 1); }

  // ─── Focus stats ───
  const totalFocusMinutes = focusSessions.reduce((s: number, f: typeof focusSessions[number]) => s + Math.floor(f.durationSec / 60), 0);
  const focusSessionsCount = focusSessions.length;

  // ─── Aggregate intensities, AI verifications ───
  const completedAll = allCheckins.filter((c: C) => c.completed);
  const intensityValues = completedAll.map((c: C) => c.intensity).filter((i: number) => i > 0);
  const avgIntensity = intensityValues.length
    ? Math.round(intensityValues.reduce((a: number, b: number) => a + b, 0) / intensityValues.length) : 0;
  const aiVerifiedCount = aiV.length;

  // ─── Trophy count (recompute for consistency) ───
  const trophyCount = computeTotalTrophies({
    totalCheckins: completedAll.length,
    totalFocusMinutes,
    aiVerifiedCount,
    perfectDays
  });
  // persist if different
  if (!trophyRow || trophyRow.count !== trophyCount) {
    await prisma.trophy.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, count: trophyCount },
      update: { count: trophyCount }
    }).catch(() => null);
  }

  // ─── Year filter — restrict heatmap output ───
  const filterYear = yearParam ? String(yearParam) : null;
  const yearFilterFn = (date: string) => (filterYear ? date.startsWith(filterYear) : true);

  const heatmap = Object.entries(byDate)
    .filter(([date]) => yearFilterFn(date))
    .map(([date, e]) => ({
      date,
      count: e.count,
      total: e.total,
      minutes: e.minutes,
      noMulti: e.noMulti,
      multitask: e.multitask,
      avgIntensity: e.intensity.length
        ? Math.round(e.intensity.reduce((a, b) => a + b, 0) / e.intensity.length)
        : 0,
      perfect: e.total > 0 && e.count >= e.total,
      level: e.total === 0 ? 0 : Math.min(4, Math.ceil((e.count / e.total) * 4))
    }));

  function safeCsvCell(value: string | number): string {
    const s = String(value);
    // Prevent CSV formula injection: prefix with tab if starts with = @ + -
    if (/^[=@+-]/.test(s)) return "\t" + s;
    return s;
  }

  // ─── Export branch: full CSV or JSON dump ───
  if (exportFmt === "csv") {
    const header = "date,count,total,minutes,noMulti,multitask,avgIntensity,perfect";
    const rows = heatmap.map((h) =>
      [safeCsvCell(h.date), h.count, h.total, h.minutes, h.noMulti, h.multitask, h.avgIntensity, h.perfect ? 1 : 0].join(",")
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sleek-stats-${filterYear || "all"}.csv"`
      }
    });
  }
  if (exportFmt === "json") {
    return new NextResponse(JSON.stringify({
      habits: habits.map((h: H) => ({ id: h.id, name: h.name, schedule: h.schedule, createdAt: h.createdAt })),
      checkins: allCheckins.map((c: C) => ({ date: c.date, completed: c.completed, minutes: c.minutes, intensity: c.intensity, multitasking: c.multitasking })),
      focusSessions: focusSessions.map((f: typeof focusSessions[number]) => ({ durationSec: f.durationSec, completed: f.completed, createdAt: f.createdAt })),
      aiVerifications: aiV.map((v: typeof aiV[number]) => ({ date: v.date, label: v.label, passed: v.passed })),
      trophies: trophyCount
    }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="sleek-export-${filterYear || "all"}.json"`
      }
    });
  }

  // ─── Achievement tier ───
  const earnedBadges = await prisma.badge.findMany({ where: { userId: session.userId } });
  const { unlocked: unlockedAchievements, next: nextAchievement } = computeAchievements(earnedBadges.length);

  return NextResponse.json({
    heatmap,
    streak: { current, best },
    totals: {
      totalMinutes: completedAll.reduce((s, c) => s + c.minutes, 0),
      totalCheckins: completedAll.length,
      totalFocusMinutes,
      focusSessions: focusSessionsCount,
      totalTrophies: trophyCount,
      perfectDays,
      activeDays: Object.values(byDate).filter((e) => e.count > 0).length
    },
    week: { minutes: weekMinutes, checkins: weekCheckins.length },
    consistencyPercent: Math.round((Object.values(byDate).filter((e) => e.count > 0).length / days.length) * 100),
    habitsCount: habits.length,
    perfectDays,
    consecutivePerfectRun,
    avgIntensity,
    aiVerifiedCount,
    achievements: { unlocked: unlockedAchievements, next: nextAchievement },
    trophyTiers: { perfectDayBuckets: perfectDayStreakBuckets(perfectDays) }
  });
}

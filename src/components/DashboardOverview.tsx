"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import type { HabitData, MonthCell } from "@/components/types";
import { todayStr, pad, mondayIndex, MONTHS_LONG } from "@/lib/utils";
import { isHabitScheduledOnDate } from "@/lib/schedule";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Lightweight client overview rendered inside the (app) layout (which provides
 * the sidebar + shared top header via AppShell). Fetches its own data and keeps
 * a refresh timer so badges / streaks stay live without the legacy full-page
 * Dashboard wrapper.
 */
export function DashboardOverview() {
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [habitsForToday, setHabitsForToday] = useState<HabitData[]>([]);
  const [monthCells, setMonthCells] = useState<MonthCell[]>([]);
  const [monthName, setMonthName] = useState("");
  const [streak, setStreak] = useState<{ current: number; best: number }>({ current: 0, best: 0 });
  const [earnedTrophies, setEarnedTrophies] = useState(0);
  const [isMultitasking, setIsMultitasking] = useState(false);
  const [, setTick] = useState(0);
  const [userTier, setUserTier] = useState<string>("free");
  const [trialDays, setTrialDays] = useState(0);

  const refresh = useCallback(async () => {
    const [hbRes, badgeRes, meRes] = await Promise.all([
      fetch("/api/habits").then((r) => r.json()),
      fetch("/api/badges").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null })),
    ]);
    if (hbRes.error === "Unauthorized") {
      window.location.href = "/login";
      return;
    }
    const sorted: HabitData[] = (hbRes.habits || []).map((h: any) => ({
      id: h.id, name: h.name, description: h.description, color: h.color,
      targetMins: h.targetMins, intensityTarget: h.intensityTarget ?? 100,
      requiresCamera: !!h.requiresCamera, schedule: h.schedule,
      checkins: (h.checkins || []).map((c: any) => ({
        date: c.date, completed: c.completed, minutes: c.minutes, status: c.status,
        locked: c.locked, intensity: c.intensity ?? 0, multitasking: !!c.multitasking,
        note: c.note ?? null,
      })),
    }));
    setHabits(sorted);

    const today = todayStr();
    const todays = sorted.filter((h) => isHabitScheduledOnDate(h.schedule, today));
    setHabitsForToday(todays);
    setEarnedTrophies(badgeRes.earnedCount || 0);
    if (meRes.user) {
      setUserTier(meRes.user.tier || "free");
      setTrialDays(meRes.user.trialDaysLeft ?? 0);
    }

    // Build current-month calendar cells (Monday-first)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startWeekdayMon = mondayIndex(new Date(year, month, 1).getDay());

    // Flatten checkins by date for the calendar grid
    const checkinsByDate: Record<string, Record<string, { completed: boolean; minutes: number }>> = {};
    for (const h of sorted) {
      for (const c of h.checkins) {
        if (!checkinsByDate[c.date]) checkinsByDate[c.date] = {};
        checkinsByDate[c.date][h.id] = { completed: c.completed, minutes: c.minutes };
      }
    }

    const cells: MonthCell[] = [];
    for (let i = 0; i < startWeekdayMon; i++) {
      cells.push({ date: null, day: null, doneCount: 0, total: sorted.length, minutes: 0, intensityAvg: 0 });
    }
    for (let d = 1; d <= lastDay; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      const entry = checkinsByDate[key] || {};
      const done = Object.values(entry).filter((v) => v.completed);
      const minutes = done.reduce((s, v) => s + v.minutes, 0);
      cells.push({
        date: key, day: d,
        doneCount: done.length,
        total: sorted.length,
        minutes,
        intensityAvg: 0,
      });
    }
    setMonthCells(cells);
    setMonthName(`${MONTHS_LONG[month]} ${year}`);

    // Compute streak (current + best) from checkins data we already have
    let cur = 0;
    const cursor = new Date();
    while (true) {
      const k = todayStr(cursor);
      const e = checkinsByDate[k] || {};
      if (Object.values(e).some((v) => v.completed)) {
        cur += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    const allDates = Object.keys(checkinsByDate)
      .filter((d) => Object.values(checkinsByDate[d]).some((v) => v.completed))
      .sort();
    let bestRun = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const dStr of allDates) {
      const d = new Date(dStr + "T00:00:00");
      if (prev && d.getTime() - prev.getTime() === 86400000) run += 1;
      else run = 1;
      bestRun = Math.max(bestRun, run);
      prev = d;
    }
    setStreak({ current: cur, best: Math.max(bestRun, cur) });

    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const refreshId = setInterval(() => refresh().catch(() => {}), 60_000);
    return () => clearInterval(refreshId);
  }, [refresh]);

  const today = todayStr();
  const completedToday = habitsForToday.filter((h) =>
    h.checkins.some((c) => c.date === today && c.completed)
  ).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      {userTier === "free" && !trialDays && (
        <div className="mb-6 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-up"
          style={{ background: "linear-gradient(135deg, #eef2ff, #f0fdf4)", border: "1px solid #c7d2fe" }}>
          <div className="grid h-12 w-12 place-items-center rounded-xl shrink-0"
            style={{ background: "linear-gradient(135deg, #3b82f6, #10b981)", boxShadow: "0 8px 24px rgba(59,130,246,0.35)" }}>
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">Unlock premium features</div>
            <div className="text-xs meta mt-0.5 leading-relaxed">
              Camera verification, AI insights, auto-reminders, and more — starting at $2/mo.
            </div>
          </div>
          <Link href="/pricing"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 6px 20px rgba(99,102,241,0.4)" }}>
            View plans <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      <OverviewPanel
        habits={habitsForToday}
        monthCells={monthCells}
        monthName={monthName}
        streak={streak}
        completedToday={completedToday}
        earnedTrophies={earnedTrophies}
        totalTrophies={16}
        today={today}
        onChanged={refresh}
        multitasking={isMultitasking}
        onToggleMultitasking={() => setIsMultitasking((v) => !v)}
      />
    </div>
  );
}

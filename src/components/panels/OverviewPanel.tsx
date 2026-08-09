"use client";

import { Flame, Trophy as TrophyIcon, TrendingUp, Zap } from "lucide-react";
import type { HabitData, MonthCell } from "@/components/types";
import { WEEKDAYS_MIN_MON, pad, mondayIndex } from "@/lib/utils";
import { CheckInCard } from "./CheckInCard";

export function OverviewPanel({
  habits,
  monthCells,
  monthName,
  streak,
  completedToday,
  earnedTrophies,
  totalTrophies,
  today,
  onChanged,
  multitasking,
  onToggleMultitasking,
}: {
  habits: HabitData[];
  monthCells: MonthCell[];
  monthName: string;
  streak: { current: number; best: number };
  completedToday: number;
  earnedTrophies: number;
  totalTrophies: number;
  today: string;
  onChanged: () => void;
  multitasking: boolean;
  onToggleMultitasking?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 animate-fade-up">
      {/* Calendar + habit list */}
      <div className="space-y-6 xl:col-span-2">
        <MonthCalendarCard
          monthCells={monthCells}
          monthName={monthName}
          total={habits.length}
          today={today}
          habits={habits}
        />
        <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-ink">Today's tasks</h2>
            <div className="flex items-center gap-2">
              <span className="chip chip-green">{completedToday}/{habits.length} done</span>
              {/* Multitasking toggle — lives INLINE with the task list, not in the header.
                  When ON, the next check-ins record a 20% intensity reduction (server-side). */}
              {onToggleMultitasking && (
                <button
                  onClick={onToggleMultitasking}
                  aria-pressed={multitasking}
                  title="When ON, new check-ins are marked as multitasked (−20% intensity)."
                  className={
                    "multi-toggle inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " +
                    (multitasking
                      ? "bg-[var(--blue-600)] text-white border-transparent shadow-sm"
                      : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink hover:text-ink")
                  }
                >
                  <Zap className={"h-3.5 w-3.5 " + (multitasking ? "animate-pulse" : "")} />
                  Multitasking
                  <span className={"ml-1 inline-block h-3 w-3 rounded-full border " + (multitasking ? "bg-white border-white" : "bg-transparent border-ink-soft")} />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {habits.length === 0 ? (
              <p className="text-sm meta sm:col-span-2 pt-2">
                No tasks yet. Click the + button next to your profile to add your first one.
              </p>
            ) : (
              habits.map((h) => (
                <CheckInCard key={h.id} habit={h} date={today} onChanged={onChanged} multitasking={multitasking} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Side cards */}
      <div className="space-y-6">
        <StreakHeroCard current={streak.current} best={streak.best} />
        <TrophyMini earned={earnedTrophies} total={totalTrophies} />
        <RecentActivity habits={habits} today={today} />
      </div>
    </div>
  );
}

function MonthCalendarCard({
  monthCells, monthName, total, today, habits
}: {
  monthCells: MonthCell[]; monthName: string; total: number; today: string; habits: HabitData[];
}) {
  return (
    <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-xs">Calendar</div>
          <h2 className="text-xl font-bold text-ink mt-0.5">{monthName}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs meta">
          <span className="meta">{monthName}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS_MIN_MON.map((d, i) => (
          <div key={i} className="text-center text-[11px] meta font-semibold">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((cell, i) => {
          if (!cell.date || cell.day === null) {
            return <div key={i} className="aspect-square rounded-lg" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }} />;
          }

          const isToday = cell.date === today;
          const isFuture = cell.date > today;
          const fulfilled = total > 0 && cell.doneCount >= total;
          const partial = cell.doneCount > 0 && cell.doneCount < total;

          let bg = "var(--bg-2)";
          if (fulfilled) bg = "var(--green-700)";
          else if (partial) bg = "var(--green-300)";

          return (
            <div key={i} className="relative">
              <button
                disabled={isFuture}
                title={`${cell.date} — ${cell.doneCount}/${total} habits`}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: isFuture ? "var(--bg-2)" : bg,
                  border: "1px solid var(--line-soft)",
                  opacity: isFuture ? 0.3 : 1,
                  cursor: isFuture ? "default" : "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  padding: "2px 4px"
                }}
                className={"cal-cell rounded-lg " + (fulfilled ? "done-full" : partial ? "done-high" : "") + (isToday ? " today" : "")}
              >
                <span className="text-[10px] font-semibold" style={{ color: fulfilled ? "white" : "var(--ink-soft)" }}>
                  {cell.day}
                </span>
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* Calendar cells are now rounded (via .cal-cell rounding) for a softer
   everyday.app-style look. The inline style above intentionally keeps
   rounded corners minimal so the week still reads as a grid. */

function StreakHeroCard({ current, best }: { current: number; best: number }) {
  // Circular gauge: fire ring that fills as the streak grows.
  const maxR = Math.max(best, 7);
  const pct = Math.min(100, (current / maxR) * 100);
  const C = 2 * Math.PI * 26;
  const dash = C - (pct / 100) * C;

  return (
    <div className="p-5 rounded-[18px] overflow-hidden relative" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      {/* Gradient glow behind the card */}
      <div className="absolute -top-6 -left-6 h-32 w-32 rounded-full blur-2xl opacity-25" style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }} />

      <div className="relative flex items-center gap-5">
        {/* Circular gauge ring */}
        <div className="shrink-0">
          <svg width="62" height="62" viewBox="0 0 62 62" className="-rotate-90">
            <circle cx="31" cy="31" r="26" fill="none" stroke="var(--line-soft)" strokeWidth="5" />
            <circle
              cx="31" cy="31" r="26" fill="none" stroke="url(#streakGrad${current})" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)", filter: "drop-shadow(0 0 6px rgba(249,115,22,.5))" }}
            />
            <defs><linearGradient id={`streakGrad${current}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#ef4444"/></linearGradient></defs>
          </svg>
          <div className="absolute" style={{ marginLeft: 11, marginTop: -50 }}>
            <Flame className="h-8 w-8" style={{ color: "var(--flame-fg)" }} />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[.16em] font-bold meta">STREAK</div>
          <div className="text-3xl font-extrabold text-ink leading-none mt-1">
            {current}<span className="text-sm font-medium meta ml-1">days</span>
          </div>
          <div className="text-xs meta mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" style={{ color: "var(--green-600)" }} /> best {best}d
          </div>
        </div>
      </div>
    </div>
  );
}

function TrophyMini({ earned, total }: { earned: number; total: number }) {
  const pct = total === 0 ? 0 : (earned / total) * 100;
  const C = 2 * Math.PI * 22;
  const dash = C - (pct / 100) * C;

  return (
    <div className="p-5 rounded-[18px] overflow-hidden relative" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full blur-2xl opacity-25" style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }} />

      <div className="relative flex items-center gap-4">
        <div className="shrink-0">
          <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--line-soft)" strokeWidth="4.5" />
            <circle
              cx="26" cy="26" r="22" fill="none" stroke="url(#trophyGrad)" strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={pct > 0 ? dash : C}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)", filter: "drop-shadow(0 0 4px rgba(245,158,11,.5))" }}
            />
            <defs><linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient></defs>
          </svg>
          <div className="absolute" style={{ marginLeft: 14, marginTop: -44 }}>
            <TrophyIcon className="h-6 w-6" style={{ color: "var(--amber-600)" }} />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[.16em] font-bold meta">TROPHIES</div>
          <div className="text-2xl font-extrabold text-ink leading-tight">
            {earned}<span className="text-sm font-medium meta ml-1">/ {total}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#f59e0b,#22a558)", transition: "width .8s cubic-bezier(.16,1,.3,1)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ habits, today }: { habits: HabitData[]; today: string }) {
  const events: { habitName: string; date: string; status: string; color: string }[] = [];
  for (const h of habits) {
    for (const c of h.checkins) {
      if (c.date === today || c.completed || c.status === "skipped") {
        events.push({ habitName: h.name, date: c.date, status: c.status === "skipped" ? "Skipped" : "Done", color: h.color || "#22a558" });
      }
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  const recent = events.slice(0, 6);

  if (recent.length === 0) {
    return (
      <div className="p-5 rounded-[18px]" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="text-[10px] uppercase tracking-[.16em] font-bold meta mb-3">Recent activity</div>
        <p className="text-sm meta">No check-ins yet. Mark your first task today to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-[18px] overflow-hidden relative" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top right, rgba(59,130,246,.06), transparent 70%)" }} />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[.16em] font-bold meta mb-3">Recent activity</div>
        <div className="space-y-1.5">
          {recent.map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm px-3 py-2 rounded-[10px] hover:bg-[var(--bg-2)] transition-colors"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: e.status === "Done" ? e.color : "var(--line)",
                    boxShadow: e.status === "Done" ? `0 0 6px ${e.color}` : "none",
                  }}
                />
                <span className="text-ink font-medium truncate">{e.habitName}</span>
              </span>
              <span className="text-[11px] meta shrink-0 tabular-nums ml-2">{e.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HabitData } from "@/components/types";
import { pad, MONTHS_LONG, mondayIndex } from "@/lib/utils";

type CellStatus = "pending" | "done" | "partial" | "skipped" | "multitask";

interface Cell {
  date: string;
  status: CellStatus;
  locked: boolean;
}

const STATUS_LABEL: Record<CellStatus, string> = {
  pending: "Pending",
  done: "Completed",
  partial: "~80% done",
  skipped: "Skipped (locked)",
  multitask: "Multitasked"
};

function statusToClass(s: CellStatus): string {
  switch (s) {
    case "done":      return "done-full";
    case "partial":   return "done-high";
    case "multitask": return "blue-dark";
    case "skipped":   return "skipped";
    default:          return "pending";
  }
}

function statusToColor(s: CellStatus): string {
  switch (s) {
    case "done":      return "var(--c-done-full)";
    case "partial":   return "var(--c-done-high)";
    case "multitask": return "var(--c-blue-dark)";
    case "skipped":   return "var(--c-skipped)";
    default:          return "var(--bg-2)";
  }
}

export function BigCalendar({
  habits,
  today,
  cursor,
  onCursorChange,
  onToggle
}: {
  habits: HabitData[];
  today: string;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  onToggle: (habitId: string, date: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) dates.push(`${year}-${pad(month + 1)}-${pad(d)}`);

  const label = `${MONTHS_LONG[month]} ${year}`;
  const go = (delta: number) => onCursorChange(new Date(year, month + delta, 1));

  // Build cell matrix: dates (rows) x habits (columns)
  const rows = dates.map((date) => {
    const isFuture = date > today;
    return {
      date,
      isFuture,
      cells: habits.map((h) => {
        const existing = h.checkins.find((c) => c.date === date);
        if (existing?.status === "skipped") return { date, status: "skipped" as CellStatus, locked: true };
        if (existing?.status === "multitask") return { date, status: "multitask" as CellStatus, locked: false };
        if (existing?.completed) return { date, status: "done" as CellStatus, locked: false };
        return { date, status: "pending" as CellStatus, locked: false };
      })
    };
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const todayIdx = dates.indexOf(today);

  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0 && todayIdx < daysInMonth) {
      const rowH = 44;
      scrollRef.current.scrollTop = Math.max(0, todayIdx * rowH - 200);
    }
  }, [todayIdx, daysInMonth]);

  const weekdayHeader = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-xs">Your consistency grid</div>
          <h2 className="text-xl font-bold text-ink mt-0.5">{label}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} className="btn-ghost !p-2" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => onCursorChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="btn-ghost text-xs">Today</button>
          <button onClick={() => go(1)} className="btn-ghost !p-2" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-xs meta mb-4">
        Dates on the left, tasks across the top. Tap a cell to toggle done. Skipped cells are locked after 12:00 PM.
      </p>

      {habits.length === 0 ? (
        <div className="py-12 text-center text-sm meta">
          No tasks yet. Add one from the + button next to your profile.
        </div>
      ) : (
        <>
          {/* Header row: habit names */}
          <div className="flex border-b" style={{ borderColor: "var(--line)" }}>
            <div className="w-20 shrink-0 px-2 py-2 text-[10px] font-semibold meta uppercase tracking-wide border-r" style={{ borderColor: "var(--line)" }}>
              Date
            </div>
            <div className="flex-1 grid gap-0" style={{ gridTemplateColumns: `repeat(${habits.length}, minmax(0, 1fr))` }}>
              {habits.map((h) => (
                <div key={h.id} className="px-1 py-2 text-center text-[10px] font-semibold truncate border-r last:border-r-0"
                  style={{ borderColor: "var(--line-soft)", color: "var(--ink-soft)" }}
                  title={h.name}>
                  {h.name}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable date rows */}
          <div ref={scrollRef} className="overflow-y-auto max-h-[560px]" style={{ scrollbarWidth: "thin" }}>
            {rows.map((row, ri) => {
              const dt = new Date(row.date + "T00:00:00");
              const isToday = row.date === today;
              const isFuture = row.isFuture;

              return (
                <div key={row.date} className="flex border-b" style={{ borderColor: "var(--line-soft)" }}>
                  <div className="w-20 shrink-0 px-2 py-2.5 border-r flex flex-col justify-center"
                    style={{ borderColor: "var(--line)" }}>
                    <span className={"text-xs font-semibold " + (isToday ? "text-ink" : "meta")}>
                      {weekdayHeader[mondayIndex(dt.getDay())]} {dt.getDate()}/{dt.getMonth() + 1}
                    </span>
                    {isToday && <span className="text-[9px] font-bold text-[var(--green-700)] uppercase">today</span>}
                  </div>
                  <div className="flex-1 grid gap-0" style={{ gridTemplateColumns: `repeat(${habits.length}, minmax(0, 1fr))` }}>
                    {row.cells.map((cell, ci) => {
                      const habit = habits[ci];
                      const cls = statusToClass(cell.status);
                      const isLocked = cell.locked;
                      const isPending = cell.status === "pending";
                      return (
                        <DayCell
                          key={habit.id}
                          cell={cell}
                          habit={habit}
                          date={row.date}
                          cls={cls}
                          isToday={isToday}
                          isFuture={isFuture}
                          isLocked={isLocked}
                          isPending={isPending}
                          onToggle={() => onToggle(habit.id, row.date)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            <Legend swatch="var(--c-done-full)" label="Done" />
            <Legend swatch="var(--c-done-high)" label="~80% done" />
            <Legend swatch="var(--c-yellow-dark)" label="Moderate" />
            <Legend swatch="var(--c-yellow-light)" label="Low" />
            <Legend swatch="var(--c-blue-dark)" label="Multitask" />
            <Legend swatch="var(--c-blue-light)" label="Multitask partial" />
            <Legend swatch="white" border="1px solid var(--line)" label="Skipped" />
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ swatch, border, label }: { swatch: string; border?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-soft">
      <span className="h-3 w-3" style={{ background: swatch, border: border || "1px solid var(--line)" }} />
      {label}
    </span>
  );
}

function DayCell({
  cell, habit, date, cls, isToday, isFuture, isLocked, isPending, onToggle
}: {
  cell: Cell;
  habit: HabitData;
  date: string;
  cls: string;
  isToday: boolean;
  isFuture: boolean;
  isLocked: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  const fill = statusToColor(cell.status);

  return (
    <div className="relative border-r last:border-r-0" style={{ borderColor: "var(--line-soft)" }}>
      <button
        onClick={onToggle}
        disabled={isLocked || isFuture}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={
          "cal-cell " + cls +
          (isToday ? " today" : "") +
          (isLocked ? " locked" : "") +
          (isFuture ? " future" : "")
        }
        style={{
          width: "100%",
          height: "40px",
          background: isFuture ? "var(--bg-2)" : fill,
          border: "1px solid var(--line-soft)",
          opacity: isFuture ? 0.4 : isLocked ? 0.7 : 1,
          cursor: isLocked || isFuture ? "not-allowed" : "pointer"
        }}
        title={`${date} — ${habit.name} — ${STATUS_LABEL[cell.status]}`}
      />

      {/* Hover tooltip showing this date's all-habits status */}
      {hover && !isFuture && (
        <div className="absolute left-1/2 -translate-x-1/2 top-10 z-30 pointer-events-none w-max max-w-[280px]"
          style={{ background: "var(--ink)", color: "white", border: "none" }}>
          <div className="px-3 py-2 text-xs">
            <div className="font-bold mb-1">{date} · {habit.name}</div>
            <div style={{ opacity: 0.85 }}>{STATUS_LABEL[cell.status]}</div>
            {isLocked && <div style={{ opacity: 0.6, fontSize: 10 }}>Locked — auto-skipped at 12:00 PM</div>}
          </div>
        </div>
      )}
    </div>
  );
}

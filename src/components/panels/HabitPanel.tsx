"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import type { HabitData } from "@/components/types";
import { todayStr, MONTHS_LONG } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Weekday = (typeof WEEKDAYS)[number];

/**
 * Encode the user's scheduling choices into a single schedule string stored
 * in the database. Returns null if the selection is invalid.
 *
 *  Format schemes:
 *   - "daily"                                  -> every day
 *   - "weekly:Mon,Wed,Fri"                      -> specific weekdays (repeats forever)
 *   - "dates:2024-01-12,2024-01-15"             -> specific dates (one-off)
 *   - "dates:2024-01-12,2024-01-15;r=1"          -> specific dates + repeat next N months
 *
 *  `repeatNextMonth` only affects the "dates" schedule (it clones the same
 *  day-of-month forward into the next month(s)). For "daily"/"weekly" it is
 *  ignored (they already repeat forever).
 */
function encodeSchedule(
  kind: string,
  weeklyDays: string[],
  selectedDates: string[],
  repeatNextMonth: boolean
): string | null {
  if (kind === "daily") return "daily";
  if (kind === "weekly") {
    // Preserve Mon-first ordering regardless of picker order.
    const ordered = WEEKDAYS.filter((d) => weeklyDays.includes(d));
    if (ordered.length === 0) return null; // must pick at least one day
    return "weekly:" + ordered.join(",");
  }
  if (kind === "dates") {
    const dates = [...selectedDates].sort();
    if (dates.length === 0) return null; // must pick at least one date
    const base = "dates:" + dates.join(",");
    return repeatNextMonth ? `${base};r=1` : base;
  }
  return null;
}

export function HabitPanel({
  habits,
  onChanged
}: {
  habits: HabitData[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [repeatNextMonth, setRepeatNextMonth] = useState(false);
  // New tunables (Task #6): target minutes, intensity default, AI camera verify.
  const [targetMins, setTargetMins] = useState(30);
  const [intensityTarget, setIntensityTarget] = useState(100);
  const [requiresCamera, setRequiresCamera] = useState(false);

  function resetForm() {
    setName(""); setDesc(""); setSchedule("daily");
    setSelectedDates([]); setWeeklyDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setRepeatNextMonth(false); setCalMonth(new Date());
    setTargetMins(30); setIntensityTarget(100); setRequiresCamera(false);
  }

  async function addHabit() {
    if (!name.trim()) return;
    const sched = encodeSchedule(schedule, weeklyDays, selectedDates, repeatNextMonth);
    if (sched === null) return;
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: desc || null,
        schedule: sched,
        targetMins,
        intensityTarget,
        requiresCamera
      })
    });
    resetForm(); setAdding(false); onChanged();
  }

  async function deleteHabit(id: string) {
    if (!confirm("Delete this task and all its check-ins?")) return;
    await fetch(`/api/habits/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="animate-fade-up">
      <div className="p-5 space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">All tasks</h2>
          {!adding && (
            <button onClick={() => setAdding(true)} className="btn-primary">
              <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> New</span>
            </button>
          )}
        </div>

        {habits.length === 0 && !adding && (
          <p className="text-sm meta pt-1">No tasks yet. Click <b className="text-ink">New</b> to add your first task.</p>
        )}

        {/* API-key-style list: one row per habit, +/trash only.
            No edit buttons — the spec said update happens via delete+recreate. */}
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
          {habits.map((h) => {
            const completedToday = h.checkins.find((c) => c.date === todayStr())?.completed;
            const totalCheckins = h.checkins.filter((c) => c.completed).length;
            const best = computeBestStreak(h);
            return (
              <div key={h.id} className="py-3 flex items-start gap-3">
                {/* Color swatch */}
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: h.color }} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-ink truncate block">{h.name}</span>
                  {h.description && <p className="text-xs meta truncate mt-0.5">{h.description}</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
                    <span className="meta">{totalCheckins} check-ins</span>
                    {best > 0 && (
                      <span className="chip chip-amber text-[10px] py-0.5">
                        <Flame className="h-3 w-3" /> {best}d best
                      </span>
                    )}
                    <span className="meta">{formatSchedule(h.schedule)}</span>
                    {completedToday && <span className="chip chip-green text-[10px] py-0.5">Done today</span>}
                  </div>
                </div>
                {/* Trash action (the ONLY way to fix a mistake) */}
                <button
                  onClick={() => deleteHabit(h.id)}
                  className="p-2 hover:bg-[var(--coral-100)] transition shrink-0"
                  title="Delete task (irreversible)"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" style={{ color: "var(--coral-500)" }} />
                </button>
              </div>
            );
          })}
        </div>

        {adding && (
          <HabitForm
            name={name} setName={setName}
            desc={desc} setDesc={setDesc}
            schedule={schedule} setSchedule={(v) => { setSchedule(v); if (v !== "dates") setSelectedDates([]); if (v !== "weekly") setWeeklyDays([]); }}
            weeklyDays={weeklyDays} setWeeklyDays={setWeeklyDays}
            selectedDates={selectedDates} setSelectedDates={setSelectedDates}
            calMonth={calMonth} setCalMonth={setCalMonth}
            repeatNextMonth={repeatNextMonth} setRepeatNextMonth={setRepeatNextMonth}
            targetMins={targetMins} setTargetMins={setTargetMins}
            intensityTarget={intensityTarget} setIntensityTarget={setIntensityTarget}
            requiresCamera={requiresCamera} setRequiresCamera={setRequiresCamera}
            editing={false}
            onCancel={() => { setAdding(false); resetForm(); }}
            onSubmit={addHabit}
          />
        )}
      </div>
    </div>
  );
}

function HabitForm({
  name, setName, desc, setDesc, schedule, setSchedule,
  weeklyDays, setWeeklyDays,
  selectedDates, setSelectedDates,
  calMonth, setCalMonth,
  repeatNextMonth, setRepeatNextMonth,
  targetMins, setTargetMins,
  intensityTarget, setIntensityTarget,
  requiresCamera, setRequiresCamera,
  editing, onCancel, onSubmit
}: {
  name: string; setName: (v: string) => void;
  desc: string; setDesc: (v: string) => void;
  schedule: string; setSchedule: (v: string) => void;
  weeklyDays: string[]; setWeeklyDays: (v: string[]) => void;
  selectedDates: string[]; setSelectedDates: (v: string[]) => void;
  calMonth: Date; setCalMonth: (d: Date) => void;
  repeatNextMonth: boolean; setRepeatNextMonth: (v: boolean) => void;
  targetMins: number; setTargetMins: (v: number) => void;
  intensityTarget: number; setIntensityTarget: (v: number) => void;
  requiresCamera: boolean; setRequiresCamera: (v: boolean) => void;
  editing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = name.trim().length > 0 &&
    (schedule === "daily" ||
      (schedule === "weekly" && weeklyDays.length > 0) ||
      (schedule === "dates" && selectedDates.length > 0));

  return (
    <div className="p-4 space-y-3 animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between">
        <span className="label-xs">{editing ? "Edit task" : "New task"}</span>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name (e.g. Read, Gym, Meditate)"
        className="input w-full"
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)"
        className="input w-full"
      />

      {/* Target minutes + intensity + camera verify (Task #6) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label-xs">Target minutes/day</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              value={targetMins}
              onChange={(e) => setTargetMins(Math.max(1, Math.min(600, Number(e.target.value) || 30)))}
              className="input w-full"
            />
            <span className="text-xs meta shrink-0">min</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[10, 15, 30, 45, 60, 90].map((m) => (
              <button key={m} type="button"
                onClick={() => setTargetMins(m)}
                className={
                  "px-2 py-0.5 text-[11px] font-medium border transition " +
                  (targetMins === m
                    ? "bg-[var(--indigo-600)] text-white border-transparent"
                    : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink hover:text-ink")
                }
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label-xs">Intensity target</span>
          <div className="mt-1.5 flex gap-1.5">
            {[80, 90, 100].map((p) => (
              <button key={p} type="button"
                onClick={() => setIntensityTarget(p)}
                className={
                  "flex-1 py-1.5 text-xs font-semibold border transition " +
                  (intensityTarget === p
                    ? "bg-[var(--green-600)] text-white border-transparent"
                    : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink hover:text-ink")
                }
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] meta">
            Min effort to count as "done" for streak integrity.
          </p>
        </div>
      </div>

      {/* Camera-verify toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <button
          type="button"
          onClick={() => setRequiresCamera(!requiresCamera)}
          className="relative h-5 w-9 transition"
          style={{
            background: requiresCamera ? "var(--blue-600)" : "var(--bg-2)",
            border: "1px solid var(--line)"
          }}
        >
          <span
            className="absolute top-0.5 h-3.5 w-3.5 transition-all"
            style={{ left: requiresCamera ? "18px" : "2px", background: "white" }}
          />
        </button>
        <span className="text-xs ink-soft">
          Require AI camera verification (Premium — verifies work via photo)
        </span>
      </label>

      <div>
        <span className="label-xs">Schedule</span>
        <div className="mt-2 flex gap-2 flex-wrap">
          {[
            { v: "daily", label: "Every day" },
            { v: "weekly", label: "Weekly · pick days" },
            { v: "dates", label: "Specific dates" }
          ].map((opt) => (
            <button key={opt.v} type="button"
              onClick={() => setSchedule(opt.v)}
              className={"px-3 py-1.5 text-xs font-medium border transition " +
                (schedule === opt.v
                  ? "bg-ink text-white border-ink"
                  : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Weekly weekday picker — "which days in the week to do the task" */}
        {schedule === "weekly" && (
          <div className="mt-3">
            <span className="label-xs">Which days of the week</span>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d) => {
                const on = weeklyDays.includes(d);
                return (
                  <button key={d} type="button"
                    onClick={() => setWeeklyDays(on ? weeklyDays.filter((x) => x !== d) : [...weeklyDays, d])}
                    className={"px-2.5 py-1 text-xs font-medium border transition " +
                      (on ? "bg-[var(--green-600)] text-white border-[var(--green-700)]" : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {weeklyDays.length === 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--coral-500)" }}>Pick at least one day.</p>
            )}
          </div>
        )}

        {/* Specific dates multi-date calendar picker */}
        {schedule === "dates" && (
          <div className="mt-3">
            <span className="label-xs">Pick one or more dates on the calendar</span>
            <MultiDatePicker
              month={calMonth}
              onMonthChange={setCalMonth}
              selected={selectedDates}
              onToggle={(d) => setSelectedDates(
                selectedDates.includes(d)
                  ? selectedDates.filter((x) => x !== d)
                  : [...selectedDates, d]
              )}
              onClear={() => setSelectedDates([])}
            />
            {selectedDates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedDates.slice().sort().map((d) => (
                  <span key={d} className="chip chip-green text-[10px] py-0.5">{d}</span>
                ))}
              </div>
            )}
            {/* Repeat next month — clones the chosen dates forward 1 month */}
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setRepeatNextMonth(!repeatNextMonth)}
                className="relative h-5 w-9 transition"
                style={{
                  background: repeatNextMonth ? "var(--green-600)" : "var(--bg-2)",
                  border: "1px solid var(--line)"
                }}
              >
                <span
                  className="absolute top-0.5 h-3.5 w-3.5 transition-all"
                  style={{ left: repeatNextMonth ? "18px" : "2px", background: "white" }}
                />
              </button>
              <span className="text-xs ink-soft">Repeat these dates next month too</span>
            </label>
            {selectedDates.length === 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--coral-500)" }}>Pick at least one date on the calendar.</p>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost">
          <X className="h-4 w-4" />
        </button>
        <button onClick={onSubmit} disabled={!canSubmit} className="btn-green">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Save</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Multi-date calendar picker. Renders a month grid; clicking a cell toggles
 * whether that YYYY-MM-DD is in the `selected` list. Month nav arrows shift
 * the viewed month. Does NOT restrict to the current month — the user can
 * navigate to any month (forward or back) and pick dates freely.
 */
function MultiDatePicker({
  month,
  onMonthChange,
  selected,
  onToggle,
  onClear
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  selected: string[];
  onToggle: (dateStr: string) => void;
  onClear: () => void;
}) {
  const year = month.getFullYear();
  const monIdx = month.getMonth();
  const firstOfMonth = new Date(year, monIdx, 1);
  // Monday-first offset: 0=Mon..6=Sun -> JS getDay is 0=Sun..6=Sat
  const jsDay = firstOfMonth.getDay();
  const leadOffset = (jsDay + 6) % 7;
  const daysInMonth = new Date(year, monIdx + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < leadOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(monIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(ds);
  }
  // pad trailing to fill 6 rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => onMonthChange(new Date(year, monIdx - 1, 1))} className="btn-ghost !p-1.5" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink">{MONTHS_LONG[monIdx]} {year}</span>
        <button type="button" onClick={() => onMonthChange(new Date(year, monIdx + 1, 1))} className="btn-ghost !p-1.5" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] font-bold meta">{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const isSel = selected.includes(d);
          const isToday = d === todayStr();
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(d)}
              className={"aspect-square text-xs flex items-center justify-center border transition " +
                (isSel
                  ? "bg-[var(--green-600)] text-white border-[var(--green-700)] font-bold"
                  : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink") +
                (isToday && !isSel ? " ring-1 ring-ink" : "")}
              title={d}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button type="button" onClick={onClear} className="mt-2 text-[10px] meta hover:text-ink transition">
          Clear all ({selected.length})
        </button>
      )}
    </div>
  );
}

// ---- helpers ----

function computeBestStreak(h: HabitData): number {
  const dates = h.checkins.filter((c) => c.completed).map((c) => c.date).sort();
  let best = 0, run = 0;
  let prev: number | null = null;
  for (const dStr of dates) {
    const t = new Date(dStr + "T00:00:00").getTime();
    if (prev !== null && t - prev === 86400000) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function formatSchedule(s: string): string {
  if (s === "daily") return "Every day";
  if (s.startsWith("weekly:")) {
    const days = s.slice(7).split(",");
    return "Weekly · " + days.join(", ");
  }
  if (s.startsWith("dates:")) {
    const [datesPart, flagsPart] = s.slice(6).split(";");
    const dates = datesPart.split(",").filter(Boolean);
    const r = flagsPart?.match(/r=(\d+)/);
    const rpt = r ? ` (+${r[1]} mo)` : "";
    const count = dates.length;
    return `${count} date${count === 1 ? "" : "s"}${rpt}`;
  }
  return s;
}

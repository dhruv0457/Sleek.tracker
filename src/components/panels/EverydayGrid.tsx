"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { HabitData } from "@/components/types";
import {
    PALETTES,
    RING_COLORS,
    EMPTY_WHITE,
    SKIP_GRAY,
    MAX_LEVEL,
    computeShades,
    shadeColorFor,
    type ColorFamily,
    type EntryValue,
} from "@/lib/palettes";
import { pad, MONTHS_SHORT, WEEKDAYS_SHORT_MON } from "@/lib/utils";

interface GridRow {
    habit: HabitData;
    family: ColorFamily;
    shades: ReturnType<typeof computeShades>;
}

/**
 * Display-only everyday.app-style streak-intensity heatmap.
 *
 * Important: this grid is VIEW-ONLY. Tapping, dragging, or clicking cells
 * does NOT toggle any state. To actually check a habit in for today, use
 * the Today's habits cards on the Overview tab. Hovering a cell shows a
 * tooltip with that day's status across all your habits.
 *
 * Color routing (per the everyday.app spec):
 *   - Each habit has ONE base palette (green/blue/yellow/purple/red/teal/pink).
 *   - Each completed day within a streak is one shade darker (level 1..6).
 *   - Missed day (white) breaks the streak.
 *   - Skipped day (light gray) preserves the streak.
 *
 * Additionally, if a habit's *intensity* (self-reported % of work done) was
 * less than 100 on a given day, the cell is drawn from the YELLOW/AMBER family
 * even if the habit's palette is green — so you can spot "I did it but only
 * at 60% focus" at a glance. Full intensity completes with the habit's own
 * palette (green/blue/etc).
 */
export function EverydayGrid({
    habits,
    onAddHabit,
}: {
    habits: HabitData[];
    onAddHabit: () => void;
}) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [hover, setHover] = useState<{ date: string; x: number; y: number } | null>(null);

    const rows: GridRow[] = useMemo(() => {
        return habits.map((h, i) => {
            const family = pickFamilyFor(h, i);
            const entries: { date: string; value: EntryValue }[] = h.checkins.map((c) => ({
                date: c.date,
                value: c.completed ? "completed" : c.status === "skipped" ? "skipped" : c.status === "missed" ? "missed" : undefined,
            }));
            const shades = computeShades(entries);
            return { habit: h, family, shades };
        });
    }, [habits]);

    const { dateList, weekColumns } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dow = today.getDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const startDate = new Date(today);
        startDate.setDate(today.getDate() + mondayOffset + weekOffset * 7);
        startDate.setHours(0, 0, 0, 0);

        const dates: { date: string; day: number; weekday: number; jsDate: Date }[] = [];
        for (let w = 0; w < 2; w++) {
            for (let d = 0; d < 7; d++) {
                const js = new Date(startDate);
                js.setDate(startDate.getDate() + w * 7 + d);
                const y = js.getFullYear();
                const m = js.getMonth() + 1;
                const day = js.getDate();
                const dateStr = `${y}-${pad(m)}-${pad(day)}`;
                dates.push({ date: dateStr, day, weekday: js.getDay(), jsDate: js });
            }
        }
        return { dateList: dates, weekColumns: [] };
    }, [weekOffset]);

    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    })();

    // Per-column totals (completed habit count for each date).
    const columnTotals = dateList.map((d) =>
        rows.filter((r) => r.habit.checkins.find((c) => c.date === d.date)?.completed).length
    );

    // Build a per-date summary for the hover tooltip — shows every habit's
    // status + intensity for the hovered date.
    function tooltipData(dateStr: string) {
        return rows.map((r) => {
            const c = r.habit.checkins.find((ch) => ch.date === dateStr);
            return {
                name: r.habit.name,
                status: c?.completed ? "Done" : c?.status === "skipped" ? "Skipped" : c?.status === "missed" ? "Missed" : "Empty",
                intensity: c?.intensity || 0,
                multitask: !!c?.multitasking,
            };
        });
    }

    return (
        <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
            {/* Header — chevrons + month range */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="label-xs">Consistency Heatmap</div>
                    <h2 className="text-xl font-bold text-ink mt-0.5">
                        {dateList.length > 0
                            ? `${MONTHS_SHORT[dateList[0].jsDate.getMonth()]} ${dateList[0].jsDate.getFullYear()}`
                            : ""}
                        {dateList.length > 0 && dateList[0].jsDate.getMonth() !== dateList[dateList.length - 1].jsDate.getMonth()
                            ? ` – ${MONTHS_SHORT[dateList[dateList.length - 1].jsDate.getMonth()]}`
                            : ""}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setWeekOffset((w) => w - 1)} className="btn-ghost !p-2" aria-label="Previous week">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={() => setWeekOffset(0)} className="btn-ghost text-xs">Today</button>
                    <button onClick={() => setWeekOffset((w) => w + 1)} className="btn-ghost !p-2" aria-label="Next week">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="py-12 text-center text-sm meta">
                    No tasks yet. Click <button onClick={onAddHabit} className="font-semibold text-ink underline">+ New Task</button> to start your streak.
                </div>
            ) : (
                <div className="overflow-x-auto relative" style={{ scrollbarWidth: "thin" }}>
                    <div className="min-w-[760px]">
                        {/* Date header row */}
                        <div className="flex border-b" style={{ borderColor: "var(--line)" }}>
                            <div className="w-44 shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wide meta border-r" style={{ borderColor: "var(--line)" }}>
                                Habit
                            </div>
                            <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${dateList.length}, minmax(0, 1fr))` }}>
                                {dateList.map((d) => {
                                    const isToday = d.date === todayStr;
                                    return (
                                        <div
                                            key={d.date}
                                            className={"text-center py-2 " + (isToday ? "bg-[var(--bg-2)]" : "")}
                                            style={{ minWidth: 44 }}
                                        >
                                            <div className={"text-[11px] font-bold " + (isToday ? "text-ink" : "meta")}>{d.day}</div>
                                            <div className={"text-[9px] font-bold uppercase " + (isToday ? "text-[var(--green-700)]" : "meta")}>
                                                {WEEKDAYS_SHORT_MON[(d.weekday === 0 ? 6 : d.weekday - 1)] || ""}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="w-48 shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wide meta border-l text-right" style={{ borderColor: "var(--line)" }}>
                                Streak · Best · Count
                            </div>
                        </div>

                        {/* Habit rows — DISPLAY ONLY, no buttons */}
                        {rows.map((row) => {
                            const ring = RING_COLORS[row.family] || "#2d9c1b";
                            const showRing = row.shades.currentStreak > 0 && row.shades.currentStreak === row.shades.longestStreak;
                            return (
                                <div key={row.habit.id} className="flex border-b" style={{ borderColor: "var(--line-soft)" }}>
                                    <div className="w-44 shrink-0 px-3 py-2.5 border-r flex items-center" style={{ borderColor: "var(--line)" }}>
                                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTES[row.family][2] }} />
                                        <span className="ml-2 text-sm lowercase truncate" style={{ color: "var(--ink-soft)" }}>
                                            {row.habit.name.toLowerCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dateList.length}, minmax(0, 1fr))` }}>
                                        {dateList.map((d) => {
                                            const isFuture = d.date > todayStr;
                                            const checkin = row.habit.checkins.find((c) => c.date === d.date);
                                            // Color routing: full-intensity completed uses the habit's palette
                                            // (shade darkens per streak day). Partial-intensity completed (<100)
                                            // uses the YELLOW family so you can spot "did it but at low focus".
                                            const intensity = checkin?.intensity ?? 0;
                                            const isCompleted = !!row.shades.shadeByDate[d.date];
                                            const isPartial = isCompleted && intensity > 0 && intensity < 100;
                                            const familyForCell: ColorFamily = isPartial ? "yellow" : row.family;
                                            const bg = isFuture ? "transparent" : shadeColorFor(familyForCell, d.date, row.shades);
                                            const isMissed = row.shades.specialByDate[d.date] === "MISS_WHITE";
                                            const isSkipped = row.shades.specialByDate[d.date] === "SKIP_GRAY";
                                            return (
                                                <div
                                                    key={d.date}
                                                    onMouseEnter={() => setHover({ date: d.date, x: 0, y: 0 })}
                                                    onMouseLeave={() => setHover((h) => (h?.date === d.date ? null : h))}
                                                    className="aspect-square rounded-md m-0.5"
                                                    style={{
                                                        background: bg,
                                                        border: isMissed ? "1px solid var(--line)" : isSkipped ? "1px solid var(--line-soft)" : "none",
                                                        opacity: isFuture ? 0.15 : 1,
                                                        minHeight: 48,
                                                        cursor: "default",
                                                    }}
                                                    title={`${row.habit.name} · ${d.date} — ${
                                                        isCompleted ? `Done · streak day ${row.shades.shadeByDate[d.date]}/${MAX_LEVEL}${isPartial ? ` · ${intensity}% intensity` : ""}`
                                                            : isSkipped ? "Skipped"
                                                            : isMissed ? "Missed"
                                                            : "Empty"
                                                    }`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="w-48 shrink-0 px-3 py-2.5 border-l flex items-center justify-end gap-3 text-right" style={{ borderColor: "var(--line)" }}>
                                        <StatDiv value={row.shades.currentStreak} ringColor={showRing ? ring : undefined} />
                                        <StatDiv value={row.shades.longestStreak} ringColor={showRing ? ring : undefined} />
                                        <StatDiv value={row.shades.totalCount} />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Footer — + New Habit on the left, per-day totals on the right */}
                        <div className="flex">
                            <div className="w-44 shrink-0 px-3 py-3 border-r" style={{ borderColor: "var(--line)" }}>
                                <button onClick={onAddHabit} className="flex items-center gap-1 text-xs font-semibold text-ink hover:underline">
                                    <Plus className="h-3.5 w-3.5" /> New Task
                                </button>
                            </div>
                            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dateList.length}, minmax(0, 1fr))` }}>
                                {columnTotals.map((t, i) => (
                                    <div key={i} className="text-center py-1.5 text-[11px] font-semibold meta">
                                        {t > 0 ? t : ""}
                                    </div>
                                ))}
                            </div>
                            <div className="w-48 shrink-0 border-l" style={{ borderColor: "var(--line)" }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ------------------------------------------------------------
// SUB-COMPONENTS
// ------------------------------------------------------------

/** Streak/best/count stat box. When `ringColor` is supplied, the value is
 * wrapped in a colored ring (signifying current == best — your personal best). */
function StatDiv({ value, ringColor }: { value: number; ringColor?: string }) {
    return (
        <div className="text-right">
            <span
                className="inline-grid h-7 w-7 place-items-center text-sm font-bold"
                style={{
                    color: "var(--stat-fg, var(--ink-soft))",
                    border: ringColor ? `2px solid ${ringColor}` : "1px solid transparent",
                }}
            >
                {value}
            </span>
        </div>
    );
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** Map a habit to one of the 7 color families. Picks based on the habit's
 * stored hex color, or falls back to a cyclic family based on habit index. */
function pickFamilyFor(habit: HabitData, index: number): ColorFamily {
    const h = habit.color?.toLowerCase() || "";
    const families: ColorFamily[] = ["green", "blue", "yellow", "purple", "red", "teal", "pink"];
    if (h.startsWith("#22") || h.startsWith("#16") || h.startsWith("#0f") || h.startsWith("#2d") || h.startsWith("#26") || h.startsWith("#35") || h.startsWith("#40") || h.startsWith("#45") || h.startsWith("#62")) return "green";
    if (h.startsWith("#25") || h.startsWith("#44") || h.startsWith("#48") || h.startsWith("#7f") || h.startsWith("#b2ed")) return "blue";
    if (h.startsWith("#fd") || h.startsWith("#fe")) return "yellow";
    if (h.startsWith("#a6") || h.startsWith("#8b") || h.startsWith("#7c") || h.startsWith("#e0d4")) return "purple";
    if (h.startsWith("#ef") || h.startsWith("#dc") || h.startsWith("#f8") || h.startsWith("#ff")) return "red";
    if (h.startsWith("#14") || h.startsWith("#0d") || h.startsWith("#5e") || h.startsWith("#ccf")) return "teal";
    if (h.startsWith("#ec") || h.startsWith("#db") || h.startsWith("#f4") || h.startsWith("#f9")) return "pink";
    return families[index % families.length];
}

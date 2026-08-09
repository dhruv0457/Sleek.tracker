"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, CheckCircle2, Flame, Trophy, Timer, Sparkles, Download } from "lucide-react";
import { MONTHS_SHORT, pad, mondayIndex } from "@/lib/utils";

interface HeatDay {
  date: string;
  count: number;
  total?: number;
  minutes?: number;
  noMulti?: number;
  multitask?: number;
  avgIntensity?: number;
  perfect?: boolean;
  level: number;
}

interface StatsFull {
  heatmap: HeatDay[];
  streak: { current: number; best: number };
  totals: {
    totalMinutes: number;
    totalCheckins: number;
    totalFocusMinutes?: number;
    focusSessions?: number;
    totalTrophies?: number;
    perfectDays?: number;
    activeDays?: number;
  };
  week: { minutes: number; checkins: number };
  consistencyPercent: number;
  habitsCount: number;
  perfectDays?: number;
  consecutivePerfectRun?: number;
  avgIntensity?: number;
  aiVerifiedCount?: number;
  achievements?: { unlocked: any[]; next: any | null };
}

export function StatsPanel() {
  const [data, setData] = useState<StatsFull | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch(`/api/stats?year=${selectedYear}`)
      .then((r) => r.json())
      .then((d) => setData(d as StatsFull))
      .catch(() => {});
  }, [selectedYear]);

  function exportData(fmt: "csv" | "json") {
    setExporting(true);
    const url = `/api/stats?export=${fmt}&year=${selectedYear}`;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `sleek-stats-${selectedYear}.${fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .finally(() => setExporting(false));
  }
  const yearHeat = data?.heatmap ?? [];
  const weekColumns = useMemo(() => groupByWeekSorted(yearHeat, selectedYear), [yearHeat, selectedYear]);

  if (!data) {
    return (
      <div className="space-y-6 animate-fade-up">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", height: 80 + i * 20 }} />
        ))}
      </div>
    );
  }

  const activeDays = yearHeat.filter((d) => d.count > 0).length;
  const perfectDays = yearHeat.filter((d) => (d.total ?? 0) > 0 && d.count >= (d.total ?? 1)).length;
  const yearPct = Math.min(100, Math.round((activeDays / Math.max(1, yearHeat.length)) * 100));
  const focusMin = data.totals.totalFocusMinutes ?? 0;
  const trophies = data.totals.totalTrophies ?? 0;
  const perfectTotal = data.perfectDays ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TopStat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${data.streak.current}d`} sub={`Best ${data.streak.best}d`} />
        <TopStat icon={<TrendingUp className="h-4 w-4" />} label="Consistency" value={`${data.consistencyPercent}%`} sub="365-day window" />
        <TopStat icon={<CheckCircle2 className="h-4 w-4" />} label="All-time check-ins" value={`${data.totals.totalCheckins}`} sub={`${data.habitsCount} tasks`} />
        <TopStat icon={<Timer className="h-4 w-4" />} label="Focus minutes" value={`${focusMin}m`} sub={`${data.totals.focusSessions ?? 0} sessions`} />
      </div>

      {/* Second row: trophies + perfect + AI + week */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TopStat icon={<Trophy className="h-4 w-4" />} label="Trophies" value={`${trophies}`} sub="lifetime total" accent="text-[var(--amber-600)]" />
        <TopStat icon={<Sparkles className="h-4 w-4" />} label="Perfect days" value={`${perfectTotal}`} sub={`run: ${data.consecutivePerfectRun ?? 0}d`} accent="text-[var(--green-700)]" />
        <TopStat icon={<CheckCircle2 className="h-4 w-4" />} label="AI verified" value={`${data.aiVerifiedCount ?? 0}`} sub="verifications" />
        <TopStat icon={<TrendingUp className="h-4 w-4" />} label="This week" value={`${data.week.minutes}m`} sub={`${data.week.checkins} check-ins`} />
      </div>

      {/* GitHub year heatmap */}
      <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-xs">Year heatmap</div>
            <h2 className="text-xl font-bold text-ink mt-0.5">Activity — {selectedYear}</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="input !py-1.5 !text-sm"
            >
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => exportData("csv")} disabled={exporting} className="btn-ghost !py-1.5 !px-3" title="Export CSV">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
            <button onClick={() => exportData("json")} disabled={exporting} className="btn-ghost !py-1.5 !px-3" title="Export JSON">
              <Download className="h-3.5 w-3.5" />JSON
            </button>
          </div>
        </div>
        <p className="text-xs meta mb-4">Each square is a day. Hover for detail. Green = task done, gold ring = perfect day.</p>

        {/* Month labels */}
        <div className="flex gap-[3px] mb-1 pl-8 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {weekColumns.map((col, i) => {
            if (col.length === 0) return <div key={i} className="w-[14px]" />;
            const firstDate = col.find((d) => d)?.date;
            if (!firstDate) return <div key={i} className="w-[14px]" />;
            const mi = new Date(firstDate + "T00:00:00").getMonth();
            const showLabel = i === 0 || (weekColumns[i - 1].some((d) => d && new Date(d.date + "T00:00:00").getMonth() !== mi));
            return (
              <div key={i} className="w-[14px] text-[9px] meta leading-none flex items-end">
                {showLabel ? MONTHS_SHORT[mi] : ""}
              </div>
            );
          })}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[3px] pl-8 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          <div className="absolute left-0 flex flex-col gap-[2px] text-[9px] meta pt-0">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[14px] leading-[14px] w-7">
                {i === 0 ? "Mon" : i === 2 ? "Wed" : i === 4 ? "Fri" : ""}
              </div>
            ))}
          </div>
          {weekColumns.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {[0, 1, 2, 3, 4, 5, 6].map((di) => {
                const cell = col[di];
                if (!cell) {
                  return <div key={di} className="w-[14px] h-[14px]" style={{ background: "transparent" }} />;
                }
                return <HeatSquare key={di} cell={cell} />;
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-3 text-[10px] meta">
          <span>Less</span>
          <div className="flex gap-[2px]">
            <span className="w-[14px] h-[14px]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
            <span className="w-[14px] h-[14px]" style={{ background: "var(--green-300)" }} />
            <span className="w-[14px] h-[14px]" style={{ background: "var(--green-500)" }} />
            <span className="w-[14px] h-[14px]" style={{ background: "var(--green-700)" }} />
          </div>
          <span>More</span>
          <span className="ml-3 inline-block w-[14px] h-[14px]" style={{ background: "var(--green-500)", boxShadow: "0 0 0 2px var(--amber-500)" }} />
          <span>= perfect day</span>
        </div>
      </div>

      {/* Year totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <YearSmall label="Active days" value={activeDays} />
        <YearSmall label="Perfect days" value={perfectDays} accent="text-[var(--green-700)]" />
        <YearSmall label="Consistency" value={yearPct} suffix="%" />
        <YearSmall label="Avg intensity" value={data.avgIntensity ?? 0} suffix="%" />
      </div>

      {/* Achievement preview */}
      {data.achievements && data.achievements.unlocked.length > 0 && (
        <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <div className="label-xs mb-2">Achievements unlocked</div>
          <div className="flex flex-wrap gap-2">
            {data.achievements.unlocked.map((a) => (
              <div key={a.level} className="px-3 py-1.5 text-xs font-medium" style={{ background: "var(--bg-2)", border: `1px solid ${a.color}`, color: a.color }}>
                Lv.{a.level} · {a.label}
              </div>
            ))}
            {data.achievements.next && (
              <div className="px-3 py-1.5 text-xs font-medium meta" style={{ background: "transparent", border: "1px dashed var(--line)" }}>
                Next: Lv.{data.achievements.next.level} · {data.achievements.next.label} ({data.achievements.next.badgeThreshold} badges)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeatSquare({ cell }: { cell: HeatDay }) {
  const [hover, setHover] = useState(false);
  const bg = cell.level === 0 ? "var(--surface)"
    : cell.level === 1 ? "var(--green-300)"
    : cell.level === 2 ? "var(--green-500)"
    : "var(--green-700)";
  const pct = cell.total && cell.total > 0 ? Math.round((cell.count / cell.total) * 100) : 0;
  const ringStyle = cell.perfect ? { boxShadow: "0 0 0 2px var(--amber-500)" } : undefined;

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        className="heat-cell"
        style={{ background: bg, border: cell.level === 0 ? "1px solid var(--line)" : "none", width: "14px", height: "14px", ...ringStyle }}
      />
      {hover && (
        <div className="absolute z-40 -top-2 left-4 w-max max-w-[320px]" style={{ background: "var(--ink)", color: "white", padding: "8px 12px" }}>
          <div className="text-xs font-bold tabular-nums">{cell.date}</div>
          <div className="text-[10px] mt-1" style={{ opacity: 0.85 }}>
            {cell.count} done · {cell.minutes ? `${cell.minutes}m` : ""}{cell.total ? ` · ${pct}% of ${cell.total} habits` : ""}
            {cell.perfect ? " · perfect" : ""}
            {cell.avgIntensity ? ` · ${cell.avgIntensity}% intensity` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function TopStat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="p-4" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center" style={{ background: "var(--surface)", color: accent || "var(--ink)", border: "1px solid var(--line)" }}>
          {icon}
        </div>
        <div>
          <div className="label-xs">{label}</div>
          <div className={"text-2xl font-bold leading-tight tabular-nums " + (accent || "text-ink")}>{value}</div>
        </div>
      </div>
      <div className="mt-1 text-xs meta">{sub}</div>
    </div>
  );
}

function YearSmall({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div className="p-4 text-center" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
      <div className="label-xs">{label}</div>
      <div className={"text-xl font-bold mt-1.5 tabular-nums " + (accent || "text-ink")}>{value}{suffix || ""}</div>
    </div>
  );
}

function groupByWeekSorted(days: HeatDay[], year: number): (HeatDay | null)[][] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeks: (HeatDay | null)[][] = [];
  const jan1 = new Date(year, 0, 1);
  const jan1MonIdx = mondayIndex(jan1.getDay());
  let currentWeek: (HeatDay | null)[] = new Array(jan1MonIdx).fill(null);

  for (const day of sorted) {
    if (!day.date.startsWith(String(year))) continue;
    const dt = new Date(day.date + "T00:00:00");
    const mIdx = mondayIndex(dt.getDay());
    currentWeek[mIdx] = day;
    if (mIdx === 6) { weeks.push(currentWeek); currentWeek = new Array(7).fill(null); }
  }
  if (currentWeek.some((d) => d !== null)) weeks.push(currentWeek);
  return weeks;
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Pause, Plus, TimerOff, Maximize, Minimize, Check, Sparkles, ArrowRight, Trophy, Clock, Zap, Calendar, TrendingUp, TrendingDown, Award, ChevronRight } from "lucide-react";

type Phase = "idle" | "running" | "paused" | "done";

const PRESETS = [10, 15, 25, 45, 60, 90];

// Local mirrors of the server-side trophy math (kept in sync via trophies.ts)
const TIER_LABELS: { min: number; label: string }[] = [
  { min: 1, label: "1 troph/min" },
  { min: 21, label: "1.5 troph/min" },
  { min: 46, label: "2 troph/min" },
  { min: 91, label: "3 troph/min" },
];

function focusTrophiesLocal(minutes: number): number {
  const m = Math.max(0, Math.floor(minutes));
  let t = 0;
  if (m <= 20) t = m * 1;
  else if (m <= 45) t = 20 + (m - 20) * 1.5;
  else if (m <= 90) t = 20 + 25 * 1.5 + (m - 45) * 2;
  else t = 20 + 25 * 1.5 + 45 * 2 + (m - 90) * 3;
  return Math.floor(t);
}

const FOCUS_BADGES: { threshold: number; label: string; emoji: string }[] = [
  { threshold: 1, label: "First Focus", emoji: "🌱" },
  { threshold: 3, label: "Warming Up", emoji: "🔥" },
  { threshold: 5, label: "Consistent", emoji: "⏱️" },
  { threshold: 10, label: "Deep Diver", emoji: "🧘" },
  { threshold: 25, label: "Iron Will", emoji: "💪" },
  { threshold: 50, label: "Focus Legend", emoji: "👑" },
];

function pickedTier(minutes: number): string {
  let label = TIER_LABELS[0].label;
  for (const t of TIER_LABELS) if (minutes >= t.min) label = t.label;
  return label;
}

interface HabitLight { id: string; name: string; color: string; done: boolean; skipped: boolean; }

interface SessionEntry {
  id: string;
  durationSec: number;
  completed: boolean;
  createdAt: string;
}

interface MonthBucket {
  date: string; // YYYY-MM
  sessions: SessionEntry[];
  earned: number;
  lost: number;
  completedCount: number;
  discardCount: number;
  minutes: number;
}

interface FocusBadgesResult {
  unlocked: { threshold: number; label: string; emoji: string }[];
  next: { threshold: number; label: string; emoji: string } | null;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function FocusPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pickerMin, setPickerMin] = useState(25);
  const [customMin, setCustomMin] = useState("");
  const [durationSec, setDurationSec] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const [pausedAccum, setPausedAccum] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [tasks, setTasks] = useState<HabitLight[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [userTier, setUserTier] = useState<string>("free");
  const [trialDays, setTrialDays] = useState(0);
  const [trophyCount, setTrophyCount] = useState(0);
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [earnedSessionTrophies, setEarnedSessionTrophies] = useState(0);
  // ── 5-month window history state
  const [monthHistory, setMonthHistory] = useState<MonthBucket[]>([]);
  const [historyTotals, setHistoryTotals] = useState<{ sessions: number; earned: number; lost: number; net: number; completedSessions: number } | null>(null);
  const [focusBadges, setFocusBadges] = useState<FocusBadgesResult>({ unlocked: [], next: null });
  const [showHistory, setShowHistory] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const progress = durationSec > 0 ? Math.min(1, elapsedSec / durationSec) : 0;
  const remaining = Math.max(0, durationSec - elapsedSec);
  const remainingMin = Math.ceil(remaining / 60);

  // ─── Data fetch ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.user) { setUserTier(d.user.tier ?? "free"); setTrialDays(d.user.trialDaysLeft ?? 0); }
    }).catch(() => {});
    fetch("/api/stats").then((r) => r.json()).then((d) => {
      if (d.streak) setStreak(d.streak);
      if (d.trophies) setTrophyCount(d.trophies);
    }).catch(() => {});
    fetch("/api/habits").then((r) => r.json()).then((d) => {
      const today = new Date().toISOString().slice(0, 10);
      const list: HabitLight[] = (d.habits || []).map((h: any) => ({
        id: h.id, name: h.name, color: h.color || "#22a558",
        done: h.checkins?.some((c: any) => c.date === today && c.completed) ?? false,
        skipped: h.checkins?.some((c: any) => c.date === today && c.status === "skipped") ?? false,
      }));
      setTasks(list);
      setCompletedToday(list.filter((t: HabitLight) => t.done).length);
    }).catch(() => {});
    fetch("/api/focus/sessions?last=10").then((r) => r.json()).then((d) => {
      if (d.sessions) setHistory(d.sessions);
    }).catch(() => {});
    // Load 5-month grouped history
    fetch("/api/focus/sessions?window=5months").then((r) => r.json()).then((d) => {
      if (d.months) setMonthHistory(d.months);
      if (d.totals) setHistoryTotals(d.totals);
      if (d.focusBadges) setFocusBadges(d.focusBadges);
    }).catch(() => {});
  }, []);

  function refreshHistory() {
    fetch("/api/focus/sessions?last=10").then((r) => r.json()).then((d) => {
      if (d.sessions) setHistory(d.sessions);
    }).catch(() => {});
    fetch("/api/focus/sessions?window=5months").then((r) => r.json()).then((d) => {
      if (d.months) setMonthHistory(d.months);
      if (d.totals) setHistoryTotals(d.totals);
      if (d.focusBadges) setFocusBadges(d.focusBadges);
    }).catch(() => {});
  }

  // ─── Timer loop ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "running") { if (phase === "idle") { setElapsedSec(0); setEarnedSessionTrophies(0); } return; }
    let raf: number;
    const tick = () => {
      const now = Date.now();
      const totalPaused = pausedAccum + (pausedAt ? now - pausedAt : 0);
      const elapsed = Math.min(durationSec, Math.floor((now - startedAt - totalPaused) / 1000));
      setElapsedSec(elapsed);
      if (elapsed >= durationSec) { setPhase("done"); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, startedAt, durationSec, pausedAt, pausedAccum]);

  // ─── Submit completed session ─────────────────────────────────
  useEffect(() => {
    if (phase !== "done" || durationSec < 60) return;
    const minutes = Math.round(durationSec / 60);
    const earned = focusTrophiesLocal(minutes);
    setEarnedSessionTrophies(earned);

    fetch("/api/focus/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec, completed: true }),
    }).then((r) => r.json()).then((d) => {
      if (d.trophies) setTrophyCount(d.trophies);
      if (d.focusBadges) setFocusBadges(d.focusBadges);
      refreshHistory();
    }).catch(() => {});
  }, [phase, durationSec]);

  // ─── Fullscreen tracking ──────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  // ─── Actions ──────────────────────────────────────────────────
  function start(sec: number) {
    setDurationSec(sec);
    setStartedAt(Date.now());
    setPhase("running");
    setElapsedSec(0);
    setPausedAccum(0);
    if (typeof document !== "undefined" && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function pause() { setPhase("paused"); setPausedAt(Date.now()); }
  function resume() {
    if (phase !== "paused") return;
    setPausedAccum((p) => p + (Date.now() - pausedAt));
    setPausedAt(0);
    setPhase("running");
  }

  function add5Minutes() { setDurationSec((p) => p + 300); }

  function discard() {
    if (durationSec >= 60) {
      fetch("/api/focus/session/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec, note: "discarded" }),
      }).then((r) => r.json()).then((d) => {
        if (d.trophies !== undefined) setTrophyCount(d.trophies);
        refreshHistory();
      }).catch(() => {});
    }
    setPhase("idle");
    setElapsedSec(0);
    setDurationSec(0);
    setPausedAccum(0);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function reset() { setPhase("idle"); setElapsedSec(0); setDurationSec(0); setPausedAccum(0); }

  // ─── Compute ──────────────────────────────────────────────────
  const validCustom = customMin && !isNaN(Number(customMin)) && Number(customMin) > 0 && Number(customMin) <= 180 ? Number(customMin) : 0;
  const fmt = (s: number) => {
    const totalSec = Math.floor(s);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const showPremiumBanner = userTier !== "ultra_pro" && trialDays === 0;

  const estimatedTrophies = validCustom > 0
    ? focusTrophiesLocal(validCustom)
    : focusTrophiesLocal(pickerMin);

  const effectiveMinutes = validCustom > 0 ? validCustom : pickerMin;
  const tierLabel = pickedTier(effectiveMinutes);

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="aurora-f-focus aurora-f-focus-a" />
        <div className="aurora-f-focus aurora-f-focus-b" />
        <div className="aurora-f-focus aurora-f-focus-c" />
        <style>{`
          .aurora-f-focus { position:absolute; border-radius:50%; filter:blur(90px); opacity:0.3; will-change:transform; }
          .aurora-f-focus-a { width:50vw; height:50vw; background:radial-gradient(circle, rgba(16,185,129,.28) 0%, transparent 70%); right:-15vw; bottom:-10vw; animation:faA 22s ease-in-out infinite alternate; }
          .aurora-f-focus-b { width:38vw; height:38vw; background:radial-gradient(circle, rgba(59,130,246,.22) 0%, transparent 70%); left:-10vw; top:-10vw; animation:faB 26s ease-in-out infinite alternate; }
          .aurora-f-focus-c { width:34vw; height:34vw; background:radial-gradient(circle, rgba(168,85,247,.18) 0%, transparent 70%); top:50vh; left:20vw; animation:faC 30s ease-in-out infinite alternate; }
          @keyframes faA { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(4vw,3vh) scale(1.08)} }
          @keyframes faB { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-3vw,-3vh) scale(1.06)} }
          @keyframes faC { 0%{transform:translate(0,0) scale(.95)} 100%{transform:translate(-2vw,2vh) scale(1.1)} }
        `}</style>
      </div>

      {/* Content — single-column list layout, no sidebar styling */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 min-h-screen flex flex-col items-center">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between mb-6">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-muted hover:text-ink transition" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2">
            {trophyCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", color: "var(--amber-600)" }}>
                <Trophy className="h-3.5 w-3.5" /> {trophyCount.toLocaleString()}
              </span>
            )}
            <button onClick={toggleFullscreen} className="grid h-8 w-8 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-muted">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ─── IDLE phase ─── */}
        {phase === "idle" && (
          <div className="w-full animate-fade-up space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl mb-3" style={{ background: "linear-gradient(135deg, var(--blue-50), var(--green-50))" }}>
                <Clock className="h-7 w-7" style={{ color: "var(--blue-600)" }} />
              </div>
              <h2 className="text-2xl font-extrabold text-ink">Focus Zone</h2>
              <p className="text-sm meta mt-1">Lock in. Earn trophies. Build streaks.</p>
            </div>

            {/* Duration picker */}
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((m) => (
                <button key={m} onClick={() => { setPickerMin(m); setCustomMin(""); }}
                  className={"py-3 text-sm font-semibold rounded-xl transition border " + (pickerMin === m && !customMin
                    ? "bg-ink text-white border-ink" : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}>
                  {m} min
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input type="number" placeholder="Custom min" value={customMin}
                onChange={(e) => { setCustomMin(e.target.value); setPickerMin(0); }} min={1} max={180}
                className="flex-1 input text-center text-sm !h-11" />
              {validCustom > 0 && <span className="text-xs font-semibold text-[var(--green-600)] shrink-0">{validCustom}m</span>}
            </div>

            {/* Trophy preview + tier badge */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-1.5 text-xs meta">
                <Trophy className="h-3.5 w-3.5" style={{ color: "var(--amber-500)" }} />
                Earn ~{estimatedTrophies} trophies for this session
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                style={{ background: "var(--bg-2)", color: "var(--ink-soft)", border: "1px solid var(--line-soft)" }}>
                <Zap className="h-3 w-3" style={{ color: "var(--blue-500)" }} /> {tierLabel}
              </span>
            </div>

            {/* Start button */}
            <button onClick={() => start(validCustom > 0 ? validCustom * 60 : pickerMin * 60)}
              className="w-full py-3.5 rounded-xl text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 24px rgba(16,185,129,.35)" }}>
              Start {(validCustom > 0 ? validCustom : pickerMin)}‑min focus
            </button>

            {/* ───── LIST SECTION (replaces sidebar-styled cards) ───── */}

            {/* Focus session badges (trophies for completed sessions) */}
            {(focusBadges.unlocked.length > 0 || focusBadges.next) && (
              <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-3.5 w-3.5" style={{ color: "var(--amber-500)" }} />
                  <span className="text-xs font-bold text-ink">Focus session trophies</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_BADGES.map((b) => {
                    const isUnlocked = focusBadges.unlocked.some((u) => u.threshold === b.threshold);
                    return (
                      <div key={b.threshold}
                        className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold " + (isUnlocked ? "" : "opacity-40")}
                        style={isUnlocked
                          ? { background: "linear-gradient(135deg, rgba(251,191,36,.18), rgba(245,158,11,.12))", color: "var(--amber-700)", border: "1px solid var(--amber-300)" }
                          : { background: "var(--bg)", color: "var(--ink-muted)", border: "1px solid var(--line-soft)" }}>
                        <span className="text-sm">{b.emoji}</span>
                        <span>{b.label}</span>
                        <span className="text-[9px] opacity-70">· {b.threshold} sessions</span>
                      </div>
                    );
                  })}
                </div>
                {focusBadges.next && historyTotals && (
                  <p className="text-[10px] meta mt-2">
                    Next: <span className="font-semibold text-ink">{focusBadges.next.emoji} {focusBadges.next.label}</span> — {historyTotals.completedSessions}/{focusBadges.next.threshold} sessions
                  </p>
                )}
              </div>
            )}

            {/* Today's tasks (LIST, not sidebar card) */}
            {tasks.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-ink">Today's tasks</span>
                  <span className="text-[10px] meta tabular-nums">{completedToday}/{tasks.length} done</span>
                </div>
                <ul className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 py-2 text-sm"
                      style={t.done ? { color: "var(--green-700)" } : t.skipped ? { opacity: 0.4 } : {}}>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.done ? "var(--green-500)" : t.color }} />
                      <span className={t.skipped ? "line-through" : ""}>{t.name}</span>
                      {t.done && <Check className="h-3.5 w-3.5 shrink-0 ml-auto" style={{ color: "var(--green-500)" }} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Streak (inline list row, not sidebar card) */}
            <div className="rounded-xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] meta font-bold uppercase tracking-widest">Current Streak</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-extrabold text-ink tabular-nums">{streak.current}</span>
                    <span className="text-xs meta">days</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] meta">best</div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: "var(--amber-600)" }}>{streak.best}d</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (streak.current / Math.max(streak.best, 1)) * 100)}%`, background: "linear-gradient(90deg,#10b981,#34d399)" }} />
              </div>
            </div>

            {/* History — recent 10 sessions */}
            {history.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3.5 w-3.5" style={{ color: "var(--ink-muted)" }} />
                  <span className="text-xs font-bold text-ink">Recent sessions</span>
                </div>
                <ul className="space-y-0.5">
                  {history.map((s) => {
                    const trophies = focusTrophiesLocal(Math.round(s.durationSec / 60));
                    return (
                      <li key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/50 transition text-xs"
                        style={{ background: "var(--bg)" }}>
                        <span className="text-ink-soft">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-ink-soft">{Math.round(s.durationSec / 60)} min</span>
                          <span className={"text-[9px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 " +
                            (s.completed ? "" : "")}
                            style={s.completed
                              ? { background: "var(--green-50)", color: "var(--green-600)" }
                              : { background: "var(--coral-50)", color: "var(--coral-500)" }}>
                            {s.completed
                              ? <><TrendingUp className="h-2.5 w-2.5" /> +{trophies}</>
                              : <><TrendingDown className="h-2.5 w-2.5" /> −{trophies}</>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 5-MONTH HISTORY — collapsible */}
            {monthHistory.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                <button onClick={() => setShowHistory((v) => !v)}
                  className="w-full flex items-center gap-2 text-left">
                  <Calendar className="h-3.5 w-3.5" style={{ color: "var(--ink-muted)" }} />
                  <span className="text-xs font-bold text-ink flex-1">5-month history</span>
                  {historyTotals && (
                    <span className="text-[10px] meta tabular-nums">
                      {historyTotals.sessions} sessions · net <span className={historyTotals.net >= 0 ? "text-[var(--green-600)]" : "text-[var(--coral-500)]"}>{historyTotals.net >= 0 ? "+" : "−"}{Math.abs(historyTotals.net)} 🏆</span>
                    </span>
                  )}
                  <ChevronRight className={"h-4 w-4 text-ink-muted transition-transform " + (showHistory ? "rotate-90" : "")} />
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2 animate-fade-up">
                    {monthHistory.map((m) => {
                      const monthIdx = Number(m.date.split("-")[1]) - 1;
                      const monthLabel = `${MONTH_NAMES[monthIdx]} ${m.date.split("-")[0]}`;
                      const isExpanded = expandedMonth === m.date;
                      return (
                        <div key={m.date} className="rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--line-soft)" }}>
                          <button onClick={() => setExpandedMonth(isExpanded ? null : m.date)}
                            className="w-full px-3 py-2.5 flex items-center justify-between text-left text-xs">
                            <span className="font-semibold text-ink">{monthLabel}</span>
                            <span className="meta tabular-nums flex items-center gap-2">
                              <span className="text-[var(--green-600)] inline-flex items-center gap-0.5">+{m.earned}<Trophy className="h-2.5 w-2.5" /></span>
                              {m.lost > 0 && <span className="text-[var(--coral-500)] inline-flex items-center gap-0.5">−{m.lost}<Trophy className="h-2.5 w-2.5" /></span>}
                              <ChevronRight className={"h-3.5 w-3.5 transition-transform " + (isExpanded ? "rotate-90" : "")} />
                            </span>
                          </button>
                          {isExpanded && (
                            <ul className="px-3 pb-2 space-y-0.5 text-[11px] animate-fade-up" style={{ borderColor: "var(--line-soft)", borderTop: "1px solid var(--line-soft)" }}>
                              <li className="py-1 meta flex justify-between">
                                <span>Done: <strong className="text-ink">{m.completedCount}</strong> · Discarded: <strong className="text-ink">{m.discardCount}</strong></span>
                                <span>focus mins: <strong className="text-ink">{m.minutes}</strong></span>
                              </li>
                              {m.sessions.slice(0, 30).map((s) => {
                                const tr = focusTrophiesLocal(Math.round(s.durationSec / 60));
                                return (
                                  <li key={s.id} className="py-1 flex justify-between">
                                    <span className="text-ink-soft">
                                      {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {Math.round(s.durationSec / 60)}m
                                    </span>
                                    <span style={s.completed ? { color: "var(--green-600)" } : { color: "var(--coral-500)" }}>
                                      {s.completed ? `+${tr}` : `−${tr}`} 🏆
                                    </span>
                                  </li>
                                );
                              })}
                              {m.sessions.length > 30 && <li className="py-1 text-center meta">…{m.sessions.length - 30} more</li>}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Premium banner */}
            {showPremiumBanner && (
              <Link href="/pricing" className="block rounded-xl p-3.5 flex items-center gap-3 transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 6px 20px rgba(99,102,241,.3)" }}>
                <Sparkles className="h-4 w-4 text-white shrink-0" />
                <span className="text-xs font-bold text-white flex-1">Unlock premium features — reminders, AI insights + more</span>
                <ArrowRight className="h-3.5 w-3.5 text-white shrink-0" />
              </Link>
            )}
          </div>
        )}

        {/* ─── RUNNING / PAUSED / DONE phase ─── */}
        {(phase === "running" || phase === "paused" || phase === "done") && (
          <div className="flex-1 flex flex-col items-center justify-center w-full animate-fade-up">
            {/* Big timer — much larger font */}
            <div className={"font-extrabold tabular-nums tracking-tight transition-colors duration-300 " +
              (phase === "done" ? "text-[var(--green-500)]" : phase === "paused" ? "text-[var(--amber-500)]" : "text-ink")}
              style={{ fontSize: "clamp(7rem, 22vw, 18rem)", lineHeight: 0.9, letterSpacing: "-0.04em" }}>
              {phase === "done" ? "Done!" : fmt(remaining)}
            </div>

            <p className="text-base meta mt-3 text-center">
              {phase === "done"
                ? <span className="font-semibold text-[var(--green-600)]">Session complete! You earned {earnedSessionTrophies} trophies.</span>
                : phase === "paused"
                  ? "Paused — resume when ready."
                  : `${Math.round(remainingMin)} min remaining`}
            </p>

            {/* Progress ring */}
            <div className="mt-8 mx-auto relative" style={{ width: 180, height: 180 }}>
              <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-2)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#fg)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress)}`}
                  style={{ transition: "stroke-dashoffset .5s linear" }} />
                <defs>
                  <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center text-sm font-semibold meta">
                {Math.round(progress * 100)}%
              </div>
            </div>

            {/* Controls */}
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              {phase === "running" && (
                <button onClick={pause}
                  className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--bg-2)] border border-[var(--line)] text-ink-soft hover:text-ink hover:border-ink transition"
                  title="Pause">
                  <Pause className="h-5 w-5" />
                </button>
              )}
              {phase === "paused" && (
                <button onClick={resume}
                  className="grid h-12 w-12 place-items-center rounded-xl text-white transition hover:opacity-90"
                  style={{ background: "var(--green-500)" }} title="Resume">
                  <Play className="h-5 w-5 fill-white" />
                </button>
              )}
              <button onClick={discard}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                style={{ background: "var(--coral-50)", color: "var(--coral-600)", border: "1px solid var(--coral-200)" }}>
                <span className="flex items-center gap-1"><TimerOff className="h-3.5 w-3.5" /> End session</span>
              </button>
              {phase === "running" && (
                <button onClick={add5Minutes}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-2)] text-ink-soft border border-[var(--line)] hover:border-ink transition flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> +5 min
                </button>
              )}
              {phase === "done" && (
                <button onClick={reset}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                  New Session
                </button>
              )}
            </div>

            {/* Discard tooltip — shows trophy penalty */}
            {phase === "running" && (
              <p className="mt-3 text-[10px] meta text-center">
                Discarding now <span style={{ color: "var(--coral-500)" }}>deducts {focusTrophiesLocal(Math.round(elapsedSec / 60))} trophies</span>
              </p>
            )}
          </div>
        )}

        {/* Progress bar at bottom of screen */}
        {phase === "running" && (
          <div className="fixed bottom-0 left-0 right-0 h-[3px] transition-all z-30"
            style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }} />
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, X, RotateCcw, ChevronUp, Sparkles } from "lucide-react";

export type FocusSessionState = "idle" | "running" | "paused" | "done" | "discarded";

export interface FocusSession {
  state: FocusSessionState;
  /** Total duration the user picked, in seconds. */
  durationSec: number;
  /** Unix ms timestamp the timer started (or resumed after pause). */
  startedAt: number;
  /** Accumulated paused time in ms — subtracted from elapsed. */
  pausedMs: number;
  /** Number of times the user attempted to discard. */
  discardStrikes: number;
  /** Whether the most recent completion awarded a trophy (server-side decides). */
  trophyAwarded: boolean;
}

export const EMPTY_SESSION: FocusSession = {
  state: "idle",
  durationSec: 0,
  startedAt: 0,
  pausedMs: 0,
  discardStrikes: 0,
  trophyAwarded: false
};

const PRESETS = [10 * 60, 15 * 60, 25 * 60, 45 * 60, 60 * 60]; // seconds

/**
 * useFocusClock — returns the elapsed seconds of the current session,
 * recomputed every 250ms when running. Pauses freeze elapsed.
 */
function useFocusClock(session: FocusSession): number {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (session.state !== "running") return;
    let raf: number;
    const tick = () => {
      const now = Date.now();
      const elapsedMs = now - session.startedAt - session.pausedMs;
      const sec = Math.min(session.durationSec, Math.floor(elapsedMs / 1000));
      setElapsedSec(sec);
      if (sec >= session.durationSec) return; // completion handled elsewhere
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session.state, session.startedAt, session.pausedMs, session.durationSec]);

  // When paused, freeze at the latest computed value.
  useEffect(() => {
    if (session.state === "paused" || session.state === "idle") {
      // freeze; nothing to do
    }
  }, [session.state]);

  return elapsedSec;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  session: FocusSession;
  setSession: (s: FocusSession) => void;
  onComplete: (durationSec: number) => void;
  onDiscard: () => void;
};

/**
 * FocusZonePanel — the in-Focus-View experience. Big clock, growing tree,
 * start/pause/discard controls. When the user navigates away mid-session,
 * the Dashboard mounts <FocusFloatingPip/> instead (sibling component).
 */
export function FocusZonePanel({ session, setSession, onComplete, onDiscard }: Props) {
  const elapsed = useFocusClock(session);
  const [pickerMin, setPickerMin] = useState(25);

  // Detect completion — push to done state + award trophy exactly once.
  useEffect(() => {
    if (session.state === "running" && elapsed >= session.durationSec && session.durationSec > 0) {
      setSession({ ...session, state: "done", trophyAwarded: true });
      onComplete(session.durationSec);
    }
  }, [elapsed, session, setSession, onComplete]);

  function start(min: number) {
    setSession({
      state: "running",
      durationSec: min * 60,
      startedAt: Date.now(),
      pausedMs: 0,
      discardStrikes: 0,
      trophyAwarded: false
    });
  }

  function pause() {
    if (session.state !== "running") return;
    setSession({ ...session, state: "paused", pausedMs: session.pausedMs + (Date.now() - session.startedAt) });
  }
  function resume() {
    if (session.state !== "paused") return;
    setSession({ ...session, state: "running", startedAt: Date.now() });
  }
  function discard() {
    onDiscard();
    setSession({ ...session, state: "discarded", discardStrikes: session.discardStrikes + 1 });
    setTimeout(() => setSession({ ...EMPTY_SESSION }), 800); // brief hailstorm animation
  }
  function reset() {
    setSession({ ...EMPTY_SESSION });
  }

  // --- Tree growth stage (0..1) ---
  const stage = session.durationSec > 0 ? Math.min(1, elapsed / session.durationSec) : 0;
  const isDiscarding = session.state === "discarded";

  if (session.state === "idle") {
    return (
      <div className="animate-fade-up space-y-5">
        <div className="p-6" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <h2 className="text-2xl font-bold text-ink">Focus Zone</h2>
          <p className="mt-1 text-sm ink-soft max-w-xl">
            Plant a seed. Tend it with deep focus. If you make it to the end, your seedling
            becomes a tree — and you earn trophies for the consistency. Step away too many times,
            and a hailstorm wipes the field.
          </p>

          <div className="mt-5">
            <div className="label-xs">Pick a duration</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((sec) => {
                const m = sec / 60;
                const on = pickerMin === m;
                return (
                  <button key={sec} onClick={() => setPickerMin(m)}
                    className={
                      "px-4 py-2 text-sm font-semibold border transition " +
                      (on
                        ? "bg-[var(--blue-600)] text-white border-transparent shadow-sm"
                        : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink hover:text-ink")
                    }>
                    {m} min
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={() => start(pickerMin)} className="btn-primary !py-2.5 !px-5">
              <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Start {pickerMin}-minute session</span>
            </button>
            <span className="text-xs meta">Free trophies on completion · Tab-away minimizes (YouTube-style)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div
        className="p-8 relative overflow-hidden"
        style={{ background: isDiscarding ? "#1a0a0a" : "var(--bg)", border: "1px solid var(--line)", transition: "background .6s" }}
      >
        {/* Big centered clock + tree */}
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div
            className="text-7xl font-bold tabular-nums transition-colors"
            style={{
              color: session.state === "done" ? "var(--green-600)" : session.state === "paused" ? "var(--ink-muted)" : "var(--ink)"
            }}
          >
            {session.state === "done" ? fmt(session.durationSec) : fmt(Math.max(0, session.durationSec - elapsed))}
          </div>
          <div className="text-xs meta">
            {session.state === "done" && "Tree grown — focus complete!"}
            {session.state === "paused" && "Paused"}
            {session.state === "running" && "Stay focused. The farmer is tending your seedling."}
            {isDiscarding && "Hailstorm! Your progress was destroyed."}
          </div>

          {/* Animated tree (SVG, scales with stage) */}
          <FocusTree stage={stage} discarding={isDiscarding} />

          <div className="mt-2 flex items-center gap-2">
            {session.state === "running" && (
              <button onClick={pause} className="btn-ghost !py-2 !px-3" title="Pause">
                <Pause className="h-4 w-4" />
              </button>
            )}
            {session.state === "paused" && (
              <button onClick={resume} className="btn-ghost !py-2 !px-3" title="Resume">
                <Play className="h-4 w-4" />
              </button>
            )}
            {session.state === "done" ? (
              <button onClick={reset} className="btn-green !py-2 !px-4">
                <span className="flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Start another session</span>
              </button>
            ) : (
              <button
                onClick={discard}
                className="btn-ghost !py-2 !px-3"
                title="Discard session — warning: hailstorm"
              >
                <X className="h-4 w-4" /> Discard
              </button>
            )}
          </div>

          {session.state === "done" && session.trophyAwarded && (
            <div className="chip chip-amber">
              <Sparkles className="h-3 w-3" /> +1 trophy earned
            </div>
          )}
          {session.discardStrikes > 0 && session.state !== "done" && (
            <div className="text-xs" style={{ color: "var(--coral-500)" }}>
              You've discarded {session.discardStrikes} time{session.discardStrikes === 1 ? "" : "s"}. After 3, the timer auto-discards.
            </div>
          )}
        </div>

        {/* Hailstorm overlay (animated particles when discarding) */}
        {isDiscarding && <Hailstorm />}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * FocusTree — pure SVG tree that scales trunk + adds canopy branches as stage
 * grows from 0 → 1. When discarding, leaves fall + trunk desaturates.
 * -------------------------------------------------------------------------- */
function FocusTree({ stage, discarding }: { stage: number; discarding: boolean }) {
  const trunkH = 12 + (discarding ? 0 : 1) * stage * 88;
  const canopyScale = discarding ? 1 - stage * 0.9 : Math.max(0, (stage - 0.25) * 1.3);
  const trunkColor = discarding ? "#7c4a4a" : "#5b3b1c";
  const leafColor = discarding ? "#7a3b35" : "#22a558";

  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="my-2 transition-all">
      {/* ground */}
      <ellipse cx="100" cy="180" rx="80" ry="6" fill={discarding ? "#3a1a1a" : "#e2e8f0"} />
      {/* trunk */}
      <rect x="96" y={180 - trunkH} width="8" height={trunkH} fill={trunkColor} rx="2" />
      {/* canopy — overlapping circles that scale in */}
      <g style={{ transformOrigin: "100px 180px", transform: `scale(${canopyScale})`, transition: "transform .4s ease" }}>
        <circle cx="100" cy={180 - trunkH - 12} r="28" fill={leafColor} />
        <circle cx="78"  cy={180 - trunkH - 4}  r="22" fill={leafColor} opacity="0.9" />
        <circle cx="122" cy={180 - trunkH - 4}  r="22" fill={leafColor} opacity="0.9" />
        <circle cx="100" cy={180 - trunkH - 28} r="22" fill={leafColor} opacity="0.95" />
      </g>
      {/* falling leaves when discarding */}
      {discarding && Array.from({ length: 6 }).map((_, i) => (
        <circle key={i}
          cx={70 + i * 12}
          cy={100 + ((i * 17) % 60)}
          r="3"
          fill="#7a3b35"
          style={{ animation: `fall ${1 + (i % 3) * 0.3}s ease-in forwards` }}
        />
      ))}
    </svg>
  );
}

function Hailstorm() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const left = (i * 7) % 100;
        const delay = (i % 8) * 0.08;
        const size = 4 + ((i * 3) % 4);
        return (
          <span key={i}
            className="absolute rounded-full bg-white/80"
            style={{
              left: `${left}%`,
              top: "-20px",
              width: size,
              height: size,
              animation: `hail ${0.7 + (i % 5) * 0.1}s linear ${delay}s infinite`
            }}
          />
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * FocusFloatingPip — the YouTube-style picture-in-picture widget. Mounted at
 * the Dashboard level whenever there's a live session but the user is on a
 * non-focus view. Tap to return to the Focus view; tap X to discard.
 * -------------------------------------------------------------------------- */
export function FocusFloatingPip({
  session,
  onExpand,
  onDiscard
}: {
  session: FocusSession;
  onExpand: () => void;
  onDiscard: () => void;
}) {
  const elapsed = useFocusClock(session);
  const remaining = Math.max(0, session.durationSec - elapsed);
  const progress = session.durationSec > 0 ? Math.min(1, elapsed / session.durationSec) : 0;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-64 animate-fade-up shadow-lg"
      style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: "var(--line)" }}>
        <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--blue-600)] animate-pulse" />
          Focus running
        </span>
        <button
          onClick={onDiscard}
          aria-label="Discard focus session"
          title="Discard (warning: hailstorm)"
          className="text-ink-muted hover:text-[var(--coral-500)] transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <button onClick={onExpand} className="w-full text-left p-3 block">
        {/* mini progress tree */}
        <svg viewBox="0 0 100 60" className="w-full h-14">
          <ellipse cx="50" cy="56" rx="30" ry="3" fill="var(--bg-2)" />
          <rect x="48" y={56 - 8 - progress * 18} width="4" height={8 + progress * 18} fill="#5b3b1c" rx="1" />
          <g style={{ transformOrigin: "50px 56px", transform: `scale(${Math.max(0, (progress - 0.25) * 1.3)})` }}>
            <circle cx="50" cy={56 - 8 - progress * 18 - 6} r="10" fill="#22a558" />
            <circle cx="40" cy={56 - 8 - progress * 18 - 2} r="8" fill="#22a558" opacity="0.9" />
            <circle cx="60" cy={56 - 8 - progress * 18 - 2} r="8" fill="#22a558" opacity="0.9" />
          </g>
        </svg>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-lg font-bold text-ink tabular-nums">{fmt(remaining)}</span>
          <span className="text-xs text-ink-soft flex items-center gap-1">
            Expand <ChevronUp className="h-3 w-3" />
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
          <div className="h-full transition-all" style={{ width: `${progress * 100}%`, background: "var(--green-600)" }} />
        </div>
      </button>
    </div>
  );
}

/* Hail + leaf-fall keyframes — added once here via a <style> is unsafe in SSR;
   rely on globals.css for the real keyframes. Keep refs here for documentation. */

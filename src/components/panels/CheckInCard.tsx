"use client";

import { useState } from "react";
import type { HabitData } from "@/components/types";
import { X, Check, Camera } from "lucide-react";

export function CheckInCard({
  habit,
  date,
  onChanged,
  multitasking = false,
}: {
  habit: HabitData;
  date: string;
  onChanged: () => void;
  multitasking?: boolean;
}) {
  const requiresCamera = !!habit.requiresCamera;
  const existing = habit.checkins.find((c) => c.date === date);
  const done = !!existing?.completed;
  const locked = !!existing?.locked || existing?.status === "skipped";
  const storedIntensity = existing?.intensity ?? 0;
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [intensity, setIntensity] = useState(100);

  /** UI flow:
   *   1. Tap empty circle → ask % done via slider (default 100%).
   *   2. Slide + Save → POST completed=true,intensity=N.
   *   3. Lock forever (real immutability).
   */
  async function confirmDone() {
    setBusy(true);
    await fetch(`/api/habits/${habit.id}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        completed: true,
        status: "done",
        intensity,            // self-reported 0-100 — server clamps it
        multitasking: done ? false : multitasking,
      }),
    });
    setBusy(false);
    setShowSlider(false);
    setBump(true);
    setTimeout(() => setBump(false), 220);
    onChanged();
  }

  /** Cancel — nothing sent. Lock state preserved. */
  function cancel() {
    setShowSlider(false);
  }

  return (
    <>
      <button
        onClick={() => {
          if (busy || locked) return;
          if (requiresCamera) {
            // Trigger AI camera verification — AppShell listens for this event
            // and opens the AIVerifierModal scoped to this habit.
            window.dispatchEvent(new CustomEvent("verify-habit", { detail: { habitId: habit.id, habitName: habit.name } }));
            return;
          }
          if (!done) {
            setShowSlider(true);
          }
        }}
        disabled={busy || locked}
        className={
          "group relative flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 disabled:opacity-50 " +
          (locked ? "cursor-not-allowed" : "")
        }
        style={{
          background: locked ? "var(--bg-2)" : done ? "var(--green-50)" : "var(--surface)",
          border: "1px solid",
          borderColor: locked ? "var(--line)" : done ? "var(--green-200)" : "var(--line)",
          transform: bump ? "scale(1.02)" : "none",
          transition: "transform .18s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* State circle — empty / done */}
        <span
          className="grid h-7 w-7 place-items-center transition-all duration-300"
          style={{
            background: done ? "var(--green-600)" : "var(--bg-2)",
            border: done ? "none" : "1px solid var(--line)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={done ? "animate-pop" : ""}>
            <path d="M5 12.5l4 4 10-10" stroke={done ? "white" : "transparent"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: habit.color }} />
            <span className="truncate text-sm font-semibold text-ink">{habit.name}</span>
          </span>
          {habit.description && (
            <span className="block mt-0.5 text-xs meta truncate">{habit.description}</span>
          )}
          {done && storedIntensity > 0 && storedIntensity < 100 && (
            <span className="block mt-0.5 text-[10px] chip-amber chip text-[10px] py-0.5">{storedIntensity}% intensity</span>
          )}
          {done && existing?.multitasking && (
            <span className="block mt-0.5 text-[10px] chip py-0.5">multitask</span>
          )}
        </span>
        <span className={"text-xs font-semibold transition-colors " + (done ? "text-[var(--green-700)]" : requiresCamera ? "text-[var(--blue-500)]" : "meta")}>
          {locked ? "Skipped" : done ? "Done" : requiresCamera ? <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Verify</span> : "Tap"}
        </span>
      </button>

      {/* Intensity slider popup — bottom-anchored modal */}
      {showSlider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-fade-up"
          onClick={cancel}
        >
          <div
            className="w-full max-w-sm p-5 animate-pop"
            style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Mark done</h3>
                <p className="text-xs meta">How much of "{habit.name}" did you do?</p>
              </div>
              <button onClick={cancel} aria-label="Cancel" className="hover:text-ink transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Big number readout with smooth animated transitions */}
            <div className="mb-4 text-center">
              <div
                className="text-5xl font-bold text-ink transition-colors"
                style={{
                  color: intensity === 100 ? "var(--green-600)"
                    : intensity >= 50 ? "var(--ink)"
                    : "var(--coral-500)"
                }}
              >
                {intensity}<span className="text-2xl meta ml-0.5">%</span>
              </div>
              <div className="text-xs meta mt-1 transition-colors">
                {intensity === 100 && "Full effort"}
                {intensity >= 80 && intensity < 100 && "Strong effort"}
                {intensity >= 50 && intensity < 80 && "Decent — partial work"}
                {intensity > 0 && intensity < 50 && "Just touched it"}
                {intensity === 0 && "Barely attempted"}
              </div>
            </div>

            {/* Quick-pick buttons — tap once to jump directly */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[25, 50, 75, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setIntensity(q)}
                  className={
                    "py-1.5 text-xs font-semibold border transition-all duration-150 " +
                    (intensity === q
                      ? "bg-[var(--green-600)] text-white border-transparent shadow-sm"
                      : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink hover:text-ink hover:bg-white")
                  }
                >
                  {q}%
                </button>
              ))}
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--green-600)" }}
            />

            <div className="mt-1 flex justify-between text-[10px] meta">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            {multitasking && (
              <div className="mt-3 text-xs chip chip-green py-0.5">
                Multitasking ON — intensity will be auto-reduced 20%
              </div>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={cancel} className="btn-ghost">Cancel</button>
              <button onClick={confirmDone} disabled={busy} className="btn-green">
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

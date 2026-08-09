"use client";

import { useEffect, useState } from "react";
import { X, Sun, Sparkles } from "lucide-react";

interface WelcomeModalProps {
  streak: number;
  userName?: string;
  completedToday: number;
  totalHabitsToday: number;
}

export function WelcomeModal({ streak, userName, completedToday, totalHabitsToday }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const hour = now.getHours();
    // Only show between 6am and 12pm (morning window)
    if (hour < 6 || hour >= 12) return;

    const todayKey = `sleek_welcome_${now.toISOString().slice(0, 10)}`;
    if (window.localStorage.getItem(todayKey)) return;

    window.localStorage.setItem(todayKey, "1");
    setVisible(true);
  }, []);

  if (!visible) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 8 ? "Early bird" :
    hour < 10 ? "Good morning" :
    "Morning";

  const motivationalMessages = [
    "The only way to do great work is to love what you do.",
    "Small steps every day. Massive results over time.",
    "Consistency is the only talent that can't be outsourced.",
    "You don't have to be great to start, but you have to start to be great.",
    "Every check-in is a vote for the person you want to become.",
    "The friction today becomes the strength tomorrow.",
    "Light up the night — one habit at a time.",
  ];
  const msg = motivationalMessages[now.getDay() % motivationalMessages.length];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-up" style={{ background: "rgba(0,0,0,0.18)" }} onClick={() => setVisible(false)}>
      <div className="panel w-full max-w-md animate-pop p-8 text-center" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--bg-2)] text-ink-soft transition"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Sun icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #fef9c3, #fde68a)" }}>
          <Sun className="h-8 w-8" style={{ color: "#ca8a04" }} />
        </div>

        {/* Greeting */}
        <h2 className="text-2xl font-bold text-ink">
          {greeting}{userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h2>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">{msg}</p>

        {/* Stats row */}
        {totalHabitsToday > 0 && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-ink">{streak}</div>
              <div className="text-xs meta">day streak</div>
            </div>
            <div className="h-10 w-px" style={{ background: "var(--line)" }} />
            <div className="text-center">
              <div className="text-3xl font-bold text-ink">
                {completedToday}/{totalHabitsToday}
              </div>
              <div className="text-xs meta">done today</div>
            </div>
          </div>
        )}

        {/* Motivational strip */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--green-500)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--green-600)" }}>
            {streak > 0 ? `${streak}-day streak — don't break the chain!` : "Start your streak today!"}
          </span>
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--green-500)" }} />
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setVisible(false)}
          className="mt-7 w-full rounded-xl py-2.5 text-sm font-medium text-ink transition hover:opacity-80"
          style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
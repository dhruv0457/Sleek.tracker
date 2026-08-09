"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trophy, Flame, Target, ArrowRight } from "lucide-react";

/**
 * One-time welcome popup shown the FIRST time a user lands on their dashboard
 * after signing up. Unlike the daily morning WelcomeModal, this fires once
 * ever per browser (guarded by localStorage `sleek_onboarded`) so returning
 * users on a new device still get greeted once, but never twice on the same
 * machine.
 *
 * Deliberately does NOT use a dark / blurred backdrop — the user just signed
 * up; we want a welcoming soft scrim, not a heavy modal dim.
 */
export function WelcomeOnboarding({ userName }: { userName?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("sleek_onboarded")) return;
      // small delay so it animates in after the dashboard paints
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    } catch { /* private mode */ }
  }, []);

  function dismiss() {
    setVisible(false);
    try { window.localStorage.setItem("sleek_onboarded", "1"); } catch {}
  }

  if (!visible) return null;

  const first = (userName || "").split(" ")[0];
  const motivationalMessages = [
    "Big journeys start with one small check-in.",
    "Consistency beats intensity. Show up today.",
    "The friction today becomes the strength tomorrow.",
    "Light up the night — one habit at a time.",
  ];
  const msg = motivationalMessages[new Date().getDay() % motivationalMessages.length];

  const pillars = [
    { icon: <Target className="h-4 w-4" />,  title: "Create tasks",  desc: "Add the habits you want to build. Keep them small." },
    { icon: <Flame className="h-4 w-4" />,   title: "Build streaks", desc: "Daily check-ins grow your streak and intensity." },
    { icon: <Trophy className="h-4 w-4" />,  title: "Earn trophies", desc: "Unlock badges, climb the Candy Path, beat your best." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-up"
      style={{ background: "rgba(0,0,0,0.18)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md animate-pop rounded-3xl p-8 text-center"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft glow accent — no dark backdrop blur needed */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full blur-2xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)", opacity: 0.5 }}
          aria-hidden
        />

        {/* Hero mark */}
        <div
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, #fef3c7, #fcd34d)" }}
        >
          <Sparkles className="h-8 w-8" style={{ color: "#b45309" }} />
        </div>

        <h2 className="text-2xl font-extrabold text-ink">
          Welcome to sleek{first ? `, ${first}` : ""}!
        </h2>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">
          {msg} Use sleek consistently and you'll build real momentum —
          streaks, trophies, and a measurable sense of progress.
        </p>

        {/* Three pillar cards */}
        <div className="mt-6 grid grid-cols-1 gap-2.5 text-left">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-3 rounded-xl px-3.5 py-3"
              style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--surface)" }}>
                {p.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink leading-tight">{p.title}</div>
                <div className="text-[11px] meta mt-0.5 leading-snug">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Primary CTA — "Create tasks" */}
        <a
          href="/tasks"
          onClick={dismiss}
          className="mt-7 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
        >
          Create tasks
          <ArrowRight className="h-4 w-4" />
        </a>

        {/* Secondary dismiss */}
        <button
          onClick={dismiss}
          className="mt-3 w-full text-xs meta hover:text-ink transition py-1"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

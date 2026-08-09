"use client";

import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Shared sticky header for standalone app pages (those reached via the
 * sidebar but rendered as their own route, e.g. /tasks, /leaderboard).
 * Matches the visual style of the existing /badges and /achievements pages
 * so every sidebar destination feels consistent.
 */
export function StandalonePageHeader({
  title,
  subtitle,
  href = "/dashboard",
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  href?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="app-header px-6 py-3.5 sticky top-0 z-10 flex items-center gap-3 shrink-0"
      style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}
    >
      <a
        href={href}
        className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-4 w-4" />
      </a>
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-ink leading-tight truncate">{title}</h1>
        {subtitle && <div className="text-[11px] meta truncate">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </header>
  );
}

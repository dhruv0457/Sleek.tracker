"use client";

import { Flame, TrendingUp, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import type { MonthCell } from "@/components/types";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  premium?: boolean;
  href?: string;  // ← if set, render as a Link instead of onNav
}

export function Sidebar({
  nav, active, onNav, streak, completedToday, totalHabits, onLogout, collapsed,
  sidebarOpen = true, onToggleSidebar
}: {
  nav: NavItem[];
  active: string;
  onNav: (id: any) => void;
  streak: { current: number; best: number };
  completedToday: number;
  totalHabits: number;
  monthCells: MonthCell[];
  onLogout: () => void;
  collapsed?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}) {
  const progressPct = totalHabits === 0 ? 0 : Math.min(100, (completedToday / totalHabits) * 100);

  return (
    <aside
      className={"shrink-0 h-screen flex flex-col border-r transition-[width] duration-300 " + (collapsed ? "w-[60px]" : "w-[244px]")}
      style={{ borderColor: "var(--line)", background: "var(--bg)", scrollbarWidth: "thin" }}
    >
      {/* Logo + collapse row — clean, fixed at the top of the sidebar */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <a href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="sleek home">
          <BrandMark size={28} variant="3d" />
          {!collapsed && (
            <span className="font-semibold tracking-tight text-ink leading-none lowercase">
              sleek
            </span>
          )}
        </a>
        {!collapsed && sidebarOpen && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="grid h-8 w-8 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition"
            aria-label="Collapse sidebar"
            title="Collapse"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrollable nav (badge rail / progress / logout stay pinned) */}
      <nav className={"flex-1 overflow-y-auto overflow-x-hidden py-2 " + (collapsed ? "px-1.5 space-y-1" : "px-2.5 space-y-0.5")}>
        {nav.map((n) => {
          const isActive = active === n.id;
          const cls = "nav-btn " + (isActive ? "active" : "") + (collapsed ? " !justify-center !px-0" : "");
          const inner = (
            <>
              <span className="nav-ico shrink-0">{n.icon}</span>
              {!collapsed && <span className="truncate">{n.label}</span>}
            </>
          );
          if (n.href) {
            return (
              <Link key={n.id} href={n.href} className={cls} title={collapsed ? n.label : undefined}>
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              className={cls}
              title={collapsed ? n.label : undefined}
            >
              {inner}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2.5 shrink-0">
          <ProgressMiniRing pct={progressPct} completed={completedToday} total={totalHabits} />
          <div className="px-4 py-3 border" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center border" style={{ borderColor: "var(--line)", background: "var(--flame-bg)" }}>
                <Flame className="h-4 w-4" style={{ color: "var(--flame-fg)" }} />
              </div>
              <div>
                <div className="text-xl font-bold text-ink leading-tight">
                  {streak.current}<span className="text-sm font-medium meta ml-1">day{streak.current === 1 ? "" : "s"}</span>
                </div>
                <div className="text-[11px] meta flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" style={{ color: "var(--green-600)" }} /> best {streak.best}d
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onLogout}
        title={collapsed ? "Log out" : undefined}
        className={"mx-3 mb-4 flex items-center gap-2 border bg-[var(--bg-2)] py-2.5 text-sm font-medium text-ink-soft transition hover:border-ink hover:text-ink shrink-0 " + (collapsed ? "justify-center px-0" : "justify-center px-3")}
        style={{ borderColor: "var(--line)" }}
      >
        {!collapsed && "Log out"}
      </button>
    </aside>
  );
}

function ProgressMiniRing({ pct, completed, total }: { pct: number; completed: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c - (pct / 100) * c;
  return (
    <div className="border p-3 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
      <div className="relative grid place-items-center">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
          <circle cx="32" cy="32" r={r} stroke="var(--green-600)" strokeWidth="6" fill="none"
                  strokeDasharray={c} strokeDashoffset={dash}
                  strokeLinecap="round" />
        </svg>
        <span className="absolute text-sm font-bold text-ink">{Math.round(pct)}%</span>
      </div>
      <div>
        <div className="label-xs">Today</div>
        <div className="text-sm font-semibold text-ink">
          {completed}/{total} <span className="meta font-normal">done</span>
        </div>
      </div>
    </div>
  );
}

// Legacy export previously used by Dashboard's rail chevron.
// The rail has been removed — sidebar collapse is now folded into the
// sidebar's own header button.

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Plus, Grid3x3, Flame, Trophy, BarChart3, Sparkles, Users,
  Bell, PanelLeftClose, PanelLeftOpen, Crown, Camera, Maximize, Minimize, X, Zap, Menu, Monitor, Smartphone, ArrowRight,
} from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { AvatarPlaceholder } from "@/components/ui/AvatarPlaceholder";
import { AIVerifierModal } from "@/components/panels/AIVerifierModal";
import { PaywallModal } from "@/components/panels/PaywallModal";
import { SettingsModal } from "@/components/panels/SettingsModal";
import type { HabitData, UserFull } from "@/components/types";
import { todayStr, MONTHS_LONG } from "@/lib/utils";
import { isHabitScheduledOnDate } from "@/lib/schedule";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  premium?: boolean;
  href: string;
}

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Overview",                icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard" },
  { id: "tasks",       label: "Tasks",                    icon: <Plus className="h-4 w-4" />,            href: "/tasks" },
  { id: "consistency", label: "Consistency",              icon: <Grid3x3 className="h-4 w-4" />,         href: "/consistency" },
  { id: "focus",       label: "Focus Zone",              icon: <Flame className="h-4 w-4" />,           href: "/focus" },
  { id: "achievements",label: "Timeline & Achievements", icon: <Trophy className="h-4 w-4" />,          href: "/achievements" },
  { id: "badges",      label: "Badges & Trophies",       icon: <Trophy className="h-4 w-4" />,          href: "/badges" },
  { id: "stats",       label: "Statistics",              icon: <BarChart3 className="h-4 w-4" />,       href: "/stats" },
  { id: "insights",   label: "AI Insights",              icon: <Sparkles className="h-4 w-4" />, premium: true, href: "/insights" },
  { id: "leaderboard", label: "Leaderboard",             icon: <Users className="h-4 w-4" />,           href: "/leaderboard" },
  { id: "reminders",   label: "Reminders",               icon: <Bell className="h-4 w-4" />, premium: true, href: "/reminders" },
];

/** Returns "phone" if viewport is narrow (< 768px), else "desktop". */
function detectDeviceClass(): "phone" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  // Use pointer + width as the most reliable signal
  const hasFinePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? true;
  const isNarrow = window.innerWidth < 768;
  return !hasFinePointer || isNarrow ? "phone" : "desktop";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const pathname = usePathname();
  const [user, setUser] = useState<UserFull | null>(null);
  const [habitsForToday, setHabitsForToday] = useState<HabitData[]>([]);
  const [earnedTrophies, setEarnedTrophies] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [verifyHabit, setVerifyHabit] = useState<{ id: string; name: string } | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devicePrompt, setDevicePrompt] = useState<"phone" | "desktop" | null>(null);

  useEffect(() => {
    // ─── Layout mode init ────────────────────────────────────
    // Read the saved layout mode and apply it. We also detect THIS device
    // and, whenever the user opens the dashboard on a NEW device class
    // (compared to the last-known one), prompt them to confirm the mode.
    if (typeof window === "undefined") return;
    const stored = (window.localStorage.getItem("sleek_layout_mode") as "phone" | "desktop" | null);
    const storedDevice = (window.localStorage.getItem("sleek_last_device_class") as "phone" | "desktop" | null);
    const detected = detectDeviceClass();

    // Default: if no stored mode, infer from the device class on first run.
    const initialMode = stored ?? detected;
    document.documentElement.setAttribute("data-layout-mode", initialMode);
    if (initialMode === "phone") setOpen(false);

    // If the user previously picked a mode, but the CURRENT device class
    // differs from the LAST device class we saw, prompt them.
    if (stored && storedDevice && storedDevice !== detected) {
      setDevicePrompt(detected);
    }
    // Remember this device class so we can compare on next load.
    window.localStorage.setItem("sleek_last_device_class", detected);

    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => {});
    fetch("/api/habits").then((r) => r.json()).then((d) => {
      const sorted: HabitData[] = (d.habits || []).map((h: any) => ({
        id: h.id, name: h.name, description: h.description, color: h.color,
        targetMins: h.targetMins, intensityTarget: h.intensityTarget ?? 100,
        requiresCamera: !!h.requiresCamera, schedule: h.schedule,
        checkins: (h.checkins || []).map((c: any) => ({
          date: c.date, completed: c.completed, minutes: c.minutes, status: c.status,
          locked: c.locked, intensity: c.intensity ?? 0, multitasking: !!c.multitasking,
          note: c.note ?? null,
        })),
      }));
      const today = todayStr();
      setHabitsForToday(sorted.filter((h) => isHabitScheduledOnDate(h.schedule, today)));
    }).catch(() => {});
    fetch("/api/badges").then((r) => r.json()).then((d) => setEarnedTrophies(d.earnedCount || 0)).catch(() => {});

    // Fire the cron tick every 60s AND the reminder-deliver endpoint every 30s
    // while the user has any authenticated page open.
    const cronId = setInterval(() => { fetch("/api/cron/tick").catch(() => {}); }, 60_000);
    const reminderInterval = setInterval(() => {
      let tz = "";
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
      const url = tz ? `/api/reminders/deliver?tz=${encodeURIComponent(tz)}` : "/api/reminders/deliver";
      fetch(url, { method: "POST" }).catch(() => {});
    }, 30_000);
    return () => { clearInterval(cronId); clearInterval(reminderInterval); };
  }, []);

  // Close the phone drawer whenever the route changes.
  useEffect(() => {
    setOverlayOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // Listen for camera-verify events dispatched by CheckInCard for camera-required tasks
  useEffect(() => {
    function onVerifyHabit(e: Event) {
      const detail = (e as CustomEvent).detail;
      tryVerify(detail?.habitId, detail?.habitName);
    }
    window.addEventListener("verify-habit", onVerifyHabit);
    return () => window.removeEventListener("verify-habit", onVerifyHabit);
  }, [user]);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function tryVerify(habitId?: string, habitName?: string) {
    const hasAccess = user && (user.tier !== "free" || (user.trialDaysLeft ?? 0) > 0);
    if (!hasAccess) { setPaywall("AI Work Verifier"); return; }
    if (habitId && habitName) setVerifyHabit({ id: habitId, name: habitName });
    else setVerifyHabit({ id: "_all_", name: "_all_" });
  }

  function confirmDevicePrompt(mode: "phone" | "desktop") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sleek_layout_mode", mode);
      window.localStorage.setItem("sleek_last_device_class", mode);
      document.documentElement.setAttribute("data-layout-mode", mode);
      if (mode === "phone") setOpen(false); else setOpen(true);
    }
    setDevicePrompt(null);
  }

  const today = todayStr();
  const completedToday = habitsForToday.filter((h) =>
    h.checkins.some((c) => c.date === today && c.completed)
  ).length;
  const skippedToday = habitsForToday.filter((h) =>
    h.checkins.some((c) => c.date === today && c.status === "skipped")
  );
  const pendingToday = habitsForToday.filter((h) => {
    const c = h.checkins.find((x) => x.date === today);
    return !c || (!c.completed && c.status !== "skipped");
  });
  const notifCount = skippedToday.length + (pendingToday.length > 0 ? 1 : 0);

  const activeNav = NAV.find((n) => isActive(n.href));
  const pageTitle = activeNav?.label ?? "sleek";

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning — let's build consistency today";
    if (h < 18) return "Good afternoon — keep the streak alive";
    return "Good evening — finish strong today";
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Desktop: inline sidebar. Phone: hides via CSS, drawer covers full screen. */}
      <div className={"desktop-sidebar shrink-0 h-screen transition-[width] duration-300 " + (open ? "w-[244px]" : "w-0 overflow-hidden")}>
        <SidebarPersistent open={open} onToggle={() => setOpen(!open)} user={user} onOpenSettings={() => setSettingsOpen(true)} isActive={isActive} />
      </div>

      {/* Phone overlay sidebar (animated drawer + blurred backdrop) */}
      {overlayOpen && (
        <div className="phone-overlay fixed inset-0 z-40">
          {/* Backdrop with blur — click anywhere closes the drawer */}
          <div
            className="absolute inset-0Phone-backdrop animate-fade-up"
            onClick={() => setOverlayOpen(false)}
            style={{ background: "rgba(10,10,15,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          />
          {/* Drawer — slides in from the left */}
          <div className="absolute left-0 top-0 bottom-0 phone-drawer animate-slide-in-left"
            style={{ width: "min(300px, 86vw)" }}>
            <SidebarPersistent open={true} onToggle={() => setOverlayOpen(false)} user={user}
              onOpenSettings={() => { setSettingsOpen(true); setOverlayOpen(false); }} isActive={isActive} />
          </div>
        </div>
      )}
      <style>{`
        .inset-0Phone-backdrop { animation-duration: .25s; }
        @keyframes slideInLeft {
          0% { transform: translateX(-100%); opacity: .6; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-left { animation: slideInLeft .3s cubic-bezier(.22, 1, .36, 1); }
      `}</style>

      {/* Main panel — scrollable. Header is sticky. */}
      <div className="app-main-content flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0">
        <header className="app-header px-4 sm:px-6 py-3 sticky top-0 z-10" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Desktop: hamburger to toggle inline sidebar. */}
              {!open && (
                <button
                  onClick={() => setOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition desktop-toggle"
                  aria-label="Show sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              {/* Phone: always visible menu button to open the drawer */}
              <button
                onClick={() => setOverlayOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition phone-toggle"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="section-title !text-base sm:!text-lg truncate">{pageTitle}</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs ink-soft hidden sm:block">{greeting()}</p>
                  {earnedTrophies > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--yellow-600)" }}>
                      <Trophy className="h-3.5 w-3.5" />
                      {earnedTrophies.toLocaleString()} trophies
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="grid h-9 w-9 place-items-center rounded-xl transition-colors hover:bg-[var(--bg-2)]"
                  aria-label="Notifications"
                  style={{ color: "var(--ink-soft)" }}
                >
                  <Bell className="h-4 w-4" />
                  {notifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full text-white text-[9px] font-bold" style={{ background: "var(--green-600)" }}>
                      {notifCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-11 z-30 w-72 sm:w-80 panel animate-fade-up">
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
                      <span className="label-xs">Today's alerts</span>
                      <button onClick={() => setNotifOpen(false)} className="hover:text-ink transition rounded-xl p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1">
                      {skippedToday.length === 0 && pendingToday.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm ink-soft">All caught up. No alerts today.</div>
                      ) : (
                        <>
                          {skippedToday.length > 0 && (
                            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line-soft)" }}>
                              <div className="text-xs font-semibold text-ink mb-1.5">Skipped (locked)</div>
                              {skippedToday.map((h) => (
                                <div key={h.id} className="text-xs ink-soft flex items-center gap-2 py-0.5">
                                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--line)" }} /> {h.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {pendingToday.length > 0 && (
                            <div className="px-4 py-3">
                              <div className="text-xs font-semibold text-ink mb-1.5">Pending today</div>
                              {pendingToday.map((h) => (
                                <div key={h.id} className="text-xs ink-soft flex items-center gap-2 py-0.5">
                                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--line)" }} /> {h.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <FullscreenBtn />

              {/* Add habit */}
              <button
                onClick={() => setAddHabitOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white hover:opacity-90 transition"
                aria-label="Add habit"
              >
                <Plus className="h-5 w-5" />
              </button>

              {/* AI Verifier */}
              <button
                onClick={() => tryVerify()}
                className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] transition"
                style={{ color: "var(--ink-soft)" }}
                aria-label="AI Verifier"
              >
                <Camera className="h-4 w-4" />
              </button>

              {/* Upgrade CTAs — visible to anyone not on the top tier */}
              {user && user.tier === "free" && !(user.trialDaysLeft && user.trialDaysLeft > 0) && (
                <a
                  href="/pricing"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.04] upgrade-cta"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", boxShadow: "0 4px 12px -3px rgba(245,158,11,.45)" }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span className="upgrade-cta-label">Upgrade to Premium</span>
                </a>
              )}
              {user && user.trialDaysLeft && user.trialDaysLeft > 0 && user.tier === "free" && (
                <a
                  href="/pricing"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.04] upgrade-cta"
                  style={{ background: "linear-gradient(135deg, #10b981, #34d399)", color: "white", boxShadow: "0 4px 12px -3px rgba(16,185,129,.4)" }}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="upgrade-cta-label">{user.trialDaysLeft}d trial · Upgrade</span>
                </a>
              )}
              {user && user.tier === "basic_pro" && (
                <a
                  href="/pricing"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.04] upgrade-cta"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", boxShadow: "0 4px 12px -3px rgba(99,102,241,.4)" }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span className="upgrade-cta-label">Upgrade to Ultra</span>
                </a>
              )}

              <ProfileChip onSettings={() => setSettingsOpen(true)} user={user} />
            </div>
          </div>
        </header>

        {/* Premium upgrade banner — prominent CTA below the header (desktop only shows label inside button; banner is mobile-friendly secondary CTA) */}
        {user && user.tier === "free" && !(user.trialDaysLeft && user.trialDaysLeft > 0) && pathname === "/dashboard" && (
          <PremiumUpgradeBanner />
        )}

        {/* Page body — each page renders its own padded content here */}
        {children}

        {/* Global modals — available on every authenticated sidebar page */}
        {verifyHabit && (
          <AIVerifierModal
            habitsForToday={habitsForToday.map((h) => ({ id: h.id, name: h.name, requiresCamera: h.requiresCamera }))}
            onVerified={() => { setVerifyHabit(null); }}
            onClose={() => setVerifyHabit(null)}
          />
        )}
        {paywall && <PaywallModal featureName={paywall} onClose={() => setPaywall(null)} />}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>

      {addHabitOpen && <QuickAddHabitShell onClose={() => setAddHabitOpen(false)} />}

      {/* Device-change prompt — asks user when their device class differs */}
      {devicePrompt && (
        <DeviceModePrompt detected={devicePrompt} onChoose={confirmDevicePrompt} />
      )}
    </div>
  );
}

function SidebarPersistent({
  open, onToggle, user, onOpenSettings, isActive,
}: {
  open: boolean;
  onToggle: () => void;
  user: UserFull | null;
  onOpenSettings: () => void;
  isActive: (href: string) => boolean;
}) {
  return (
    <aside className="shrink-0 h-screen flex flex-col border-r" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
      <div className="px-3 py-2.5 flex items-center justify-between border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <a href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="sleek home">
          <BrandMark size={28} variant="3d" />
          <span className="font-semibold tracking-tight text-ink leading-none lowercase">sleek</span>
        </a>
        {open && (
          <button onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition desktop-collapse-btn"
            aria-label="Collapse sidebar" title="Collapse">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {/* Phone-only close button — always visible inside the drawer */}
        <button onClick={onToggle}
          className="hidden phone-close-btn grid h-8 w-8 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition"
          aria-label="Close menu" title="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2.5 space-y-0.5">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link key={n.id} href={n.href} className={"nav-btn " + (active ? "active" : "")}>
              <span className="nav-ico shrink-0">{n.icon}</span>
              <span className="truncate flex items-center gap-1.5">
                {n.label}
                {n.premium && <Crown className="h-3 w-3 inline" style={{ color: "var(--yellow-500)" }} />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 border bg-[var(--bg-2)] py-2.5 px-3 text-sm font-medium text-ink-soft transition hover:border-ink hover:text-ink rounded-full w-full"
          style={{ borderColor: "var(--line)" }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <AvatarPlaceholder size={28} className="rounded-full" />
          )}
          <span className="truncate flex-1 text-left">{user?.name || user?.email?.split("@")[0] || "Profile"}</span>
        </button>
      </div>
    </aside>
  );
}

function ProfileChip({ onSettings, user }: { onSettings: () => void; user: UserFull | null }) {
  const initials = (user?.name || user?.email || "U")
    .split(/[ @]/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "U";

  const isPremium = user?.tier === "basic_pro" || user?.tier === "ultra_pro";

  return (
    <button
      onClick={onSettings}
      className="flex items-center gap-2 bg-[var(--bg-2)] border border-[var(--line)] pl-1 pr-3 py-1 hover:border-ink transition group rounded-xl"
      title="Open profile & settings"
    >
      <div className="relative">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-7 w-7 rounded-full object-cover ring-2 ring-[var(--line)] group-hover:ring-[var(--blue-400)] transition"
          />
        ) : (
          <AvatarPlaceholder size={28} className="rounded-full ring-2 ring-[var(--line)] group-hover:ring-[var(--blue-400)] transition" />
        )}
        {isPremium && (
          <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Crown className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </div>
      <span className="hidden sm:block text-xs font-semibold text-ink max-w-[120px] truncate">
        {user?.name || user?.email?.split("@")[0] || "Profile"}
      </span>
      {isPremium && (
        <span className="hidden sm:inline text-[10px] font-bold rounded-xl px-2 py-0.5" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#92400e" }}>
          {user?.tier === "ultra_pro" ? "ULTRA" : "PRO"}
        </span>
      )}
    </button>
  );
}

/* Fullscreen toggle — site-wide. */
function FullscreenBtn() {
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggle = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);
  return (
    <button
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] transition"
      aria-label={isFull ? "Exit fullscreen" : "Enter fullscreen"}
      style={{ color: "var(--ink-soft)" }}
    >
      {isFull ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </button>
  );
}

/* ─── Premium upgrade banner below the header (mobile-friendly) ─────── */
function PremiumUpgradeBanner() {
  const [dismissed, setDismissed] = useState(false);
  // Remember dismissal for the session so it doesn't badger on every render
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("sleek_upgrade_banner_dismissed") === "1") setDismissed(true);
  }, []);
  function dismiss() {
    if (typeof window !== "undefined") window.sessionStorage.setItem("sleek_upgrade_banner_dismissed", "1");
    setDismissed(true);
  }
  if (dismissed) return null;
  return (
    <div className="px-4 sm:px-6 pt-3">
      <div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-3 sm:gap-4 animate-fade-up"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.08))", border: "1px solid rgba(99,102,241,.25)" }}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <Crown className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink">Upgrade to Premium</div>
          <p className="text-[11px] sm:text-xs meta mt-0.5 truncate">Unlock reminders, AI insights, AI camera verifier & more.</p>
        </div>
        <a href="/pricing"
          className="shrink-0 flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          Upgrade <ArrowRight className="h-3.5 w-3.5" />
        </a>
        <button onClick={dismiss} aria-label="Dismiss"
          className="shrink-0 grid h-7 w-7 place-items-center rounded-xl hover:bg-black/10 text-ink-soft transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Device-mode change prompt ─────────────────────────────────────── */
function DeviceModePrompt({
  detected, onChoose,
}: {
  detected: "phone" | "desktop";
  onChoose: (mode: "phone" | "desktop") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 backdrop-blur-md animate-fade-up">
      <div className="panel w-full max-w-md animate-pop rounded-3xl overflow-hidden p-0"
        style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 40px 100px rgba(0,0,0,.4)" }}>
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4, #34d399)" }} />
        <div className="p-6 sm:p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl mb-4 animate-pop"
            style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", boxShadow: "0 12px 30px rgba(59,130,246,.3)" }}>
            {detected === "phone"
              ? <Smartphone className="h-7 w-7 text-white" />
              : <Monitor className="h-7 w-7 text-white" />}
          </div>
          <h2 className="text-xl font-extrabold text-ink">New device detected</h2>
          <p className="text-sm meta mt-2 max-w-xs mx-auto">
            You last used sleek on a <b className="text-ink">{detected === "phone" ? "desktop" : "phone"}</b>.
            Looks like you're on a <b className="text-ink">{detected === "phone" ? "phone" : "desktop"}</b> now.
            Pick the layout that fits this device:
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => onChoose("desktop")}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition hover:scale-[1.03] hover:shadow-lg"
              style={{ borderColor: detected === "desktop" ? "var(--blue-500)" : "var(--line)",
                background: detected === "desktop" ? "linear-gradient(135deg, rgba(59,130,246,.12), rgba(6,182,212,.06))" : "var(--bg-2)" }}>
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={detected === "desktop"
                ? { background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "white" }
                : { background: "var(--bg)", color: "var(--ink-soft)" }}>
                <Monitor className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-ink">Desktop</span>
              <span className="text-[10px] meta">Full sidebar</span>
              {detected === "desktop" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--blue-100)", color: "var(--blue-600)" }}>Suggested</span>
              )}
            </button>
            <button onClick={() => onChoose("phone")}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition hover:scale-[1.03] hover:shadow-lg"
              style={{ borderColor: detected === "phone" ? "var(--green-500)" : "var(--line)",
                background: detected === "phone" ? "linear-gradient(135deg, rgba(16,185,129,.12), rgba(52,211,153,.06))" : "var(--bg-2)" }}>
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={detected === "phone"
                ? { background: "linear-gradient(135deg, #10b981, #34d399)", color: "white" }
                : { background: "var(--bg)", color: "var(--ink-soft)" }}>
                <Smartphone className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-ink">Phone</span>
              <span className="text-[10px] meta">Slide-out menu</span>
              {detected === "phone" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--green-100)", color: "var(--green-600)" }}>Suggested</span>
              )}
            </button>
          </div>
          <p className="text-[10px] meta mt-4">You can change this anytime in Settings → Theme.</p>
        </div>
      </div>
    </div>
  );
}

/* Quick add habit — standalone modal hosted by the shell. */
function QuickAddHabitShell({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [busy, setBusy] = useState(false);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [repeatNextMonth, setRepeatNextMonth] = useState(false);

  function encodeSchedule(kind: string): string | null {
    if (kind === "daily") return "daily";
    if (kind === "weekly") {
      const ordered = DAYS.filter((d) => weeklyDays.includes(d));
      if (ordered.length === 0) return null;
      return "weekly:" + ordered.join(",");
    }
    if (kind === "dates") {
      const dates = [...selectedDates].sort();
      if (dates.length === 0) return null;
      const base = "dates:" + dates.join(",");
      return repeatNextMonth ? `${base};r=1` : base;
    }
    return null;
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const sched = encodeSchedule(schedule);
    if (sched === null) { setBusy(false); return; }
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc || null, schedule: sched })
    });
    setBusy(false);
    onClose();
  }

  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstWeekdayMon = (new Date(calYear, calMonthIdx, 1).getDay() + 6) % 7;

  function toggleDate(d: string) {
    setSelectedDates((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-up" onClick={onClose}>
      <div className="panel w-full max-w-md animate-pop max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink">Add a new task</h3>
        <p className="text-sm meta mt-0.5">Keep it small and specific. You can edit it later.</p>
        <div className="mt-5 space-y-3">
          <input autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name (e.g. Morning reading)"
            className="input w-full" />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="input w-full resize-none" />

          <div>
            <span className="label-xs">Schedule</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { v: "daily", label: "Every day" },
                { v: "weekly", label: "Weekly · pick days" },
                { v: "dates", label: "Specific dates" }
              ].map((opt) => (
                <button key={opt.v} type="button"
                  onClick={() => { setSchedule(opt.v); if (opt.v !== "dates") setSelectedDates([]); if (opt.v !== "weekly") setWeeklyDays([]); }}
                  className={"px-3 py-1.5 text-xs font-medium border transition " +
                    (schedule === opt.v
                      ? "bg-ink text-white border-ink"
                      : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {schedule === "weekly" && (
              <div className="mt-2">
                <span className="label-xs">Days of the week</span>
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {DAYS.map((d) => {
                    const on = weeklyDays.includes(d);
                    return (
                      <button key={d} type="button"
                        onClick={() => setWeeklyDays((p) => on ? p.filter((x) => x !== d) : [...p, d])}
                        className={"px-2.5 py-1 text-xs font-medium border transition " +
                          (on ? "bg-[var(--green-600)] text-white border-[var(--green-700)]" : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {weeklyDays.length === 0 && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--coral-500)" }}>Pick at least one day.</p>
                )}
              </div>
            )}

            {schedule === "dates" && (
              <div className="mt-2">
                <span className="label-xs">Pick one or more dates</span>
                <div className="mt-2 p-3" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))} className="btn-ghost !p-1.5 text-xs" aria-label="Previous month">‹</button>
                    <span className="text-xs font-semibold text-ink">{MONTHS_LONG[calMonthIdx]} {calYear}</span>
                    <button type="button" onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))} className="btn-ghost !p-1.5 text-xs" aria-label="Next month">›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1.5">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] meta font-semibold">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstWeekdayMon }).map((_, i) => (
                      <div key={`b${i}`} style={{ background: "transparent" }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const date = `${calYear}-${String(calMonthIdx + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                      const on = selectedDates.includes(date);
                      return (
                        <button key={date} type="button"
                          onClick={() => toggleDate(date)}
                          title={date}
                          className={"aspect-square text-[11px] font-semibold border transition " +
                            (on
                              ? "bg-[var(--green-600)] text-white border-[var(--green-700)]"
                              : "bg-[var(--surface)] text-ink border-[var(--line)] hover:border-ink")}>
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={repeatNextMonth}
                      onChange={(e) => setRepeatNextMonth(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--green-600)]"
                    />
                    Repeat these dates next month too
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || !name.trim() || (schedule === "weekly" && weeklyDays.length === 0) || (schedule === "dates" && selectedDates.length === 0)} className="btn-green">
            {busy ? "Saving…" : "Save habit"}
          </button>
        </div>
      </div>
    </div>
  );
}

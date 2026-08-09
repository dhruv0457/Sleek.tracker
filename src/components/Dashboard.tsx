"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Grid3x3, Plus, Flame, Trophy, LayoutDashboard, BarChart3, Sparkles, Users, Bell, PanelLeftClose, PanelLeftOpen, X, Camera, Crown, Maximize, Minimize
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { OverviewPanel } from "./panels/OverviewPanel";
import { HabitPanel } from "./panels/HabitPanel";
import { CalendarPanel } from "./panels/CalendarPanel";
import { TrophiesPanel } from "./panels/TrophiesPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { AIVerifierModal } from "./panels/AIVerifierModal";
import { WelcomeModal } from "./panels/WelcomeModal";
import { WelcomeOnboarding } from "./panels/WelcomeOnboarding";
import { AvatarPlaceholder } from "./ui/AvatarPlaceholder";
import { PaywallModal } from "./panels/PaywallModal";
import { GamificationPanel } from "./panels/GamificationPanel";
import { LeaderboardPanel } from "./panels/LeaderboardPanel";
import { RemindersPanel } from "./panels/RemindersPanel";
import { BadgeUnlockModal, useBadgeUnlockQueue } from "./panels/BadgeUnlockModal";
import { SettingsModal } from "./panels/SettingsModal";
import { todayStr } from "@/lib/utils";
import { isHabitScheduledOnDate } from "@/lib/schedule";
import type { HabitData, DashboardProps, UserFull } from "./types";

// Three.js / @react-three/fiber can crash in dev (Turbopack) due to a
// react-reconciler <-> React internals mismatch (ReactCurrentOwner undefined).
// The 3D background is purely decorative, so we load it client-only via a
// separate chunk and wrap it in an error boundary: if WebGL/3D fails the
// dashboard keeps working instead of white-screening.
const DashboardCanvas = dynamic(
  () => import("./DashboardBackground").then((m) => ({ default: m.DashboardCanvas })),
  { ssr: false }
);

type View = "overview" | "habits" | "consistency" | "trophies" | "stats" | "gamification" | "leaderboard" | "reminders";

export function Dashboard(props: DashboardProps) {
  const [view, setView] = useState<View>("overview");
  const [habits, setHabits] = useState<HabitData[]>(props.habits);
  const [habitsForToday, setHabitsForToday] = useState<HabitData[]>(props.habitsForToday ?? props.habits);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [earnedTrophies, setEarnedTrophies] = useState(0);
  const [, setTick] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserFull | null>(null);
  const [verifyHabit, setVerifyHabit] = useState<{ id: string; name: string } | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const badgeQueue = useBadgeUnlockQueue();

  // Multitasking toggle — when ON, every check-in POST carries `multitasking:true`
  // and the backend reduces the recorded intensity by 20% per spec.
  const [isMultitasking, setIsMultitasking] = useState(false);

  // Streak toast: show on first login of the day (uses localStorage to persist
  // the last-login date so re-renders within the same day don't re-trigger it).
  const [showStreakToast, setShowStreakToast] = useState(false);

  const refresh = useCallback(async () => {
    const [hbRes, badgeRes] = await Promise.all([
      fetch("/api/habits").then((r) => r.json()),
      fetch("/api/badges").then((r) => r.json())
    ]);
    // Auth guard: server returns 401 if session expired
    if (hbRes.error === "Unauthorized") {
      window.location.href = "/login";
      return;
    }
    const sorted: HabitData[] = (hbRes.habits || []).map((h: any) => ({
      id: h.id, name: h.name, description: h.description, color: h.color,
      targetMins: h.targetMins, intensityTarget: h.intensityTarget ?? 100, requiresCamera: !!h.requiresCamera, schedule: h.schedule,
      checkins: (h.checkins || []).map((c: any) => ({
        date: c.date, completed: c.completed, minutes: c.minutes, status: c.status, locked: c.locked,
        intensity: c.intensity ?? 0, multitasking: !!c.multitasking, note: c.note ?? null
      }))
    }));
    setHabits(sorted);
    // Filter the refreshed list to only habits scheduled for TODAY.
    const today = todayStr();
    const todays = sorted.filter((h) => isHabitScheduledOnDate(h.schedule, today));
    setHabitsForToday(todays);
    setEarnedTrophies(badgeRes.earnedCount || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (badgeRes.newlyUnlocked?.length) badgeQueue.pushBadgeQueue(badgeRes.newlyUnlocked);
    setTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const u = d.user || null;
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setUserInfo(u);
    }).catch(() => {});
    fetch("/api/badges").then((r) => r.json()).then((d) => {
      setEarnedTrophies(d.earnedCount || 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (d.newlyUnlocked?.length) badgeQueue.pushBadgeQueue(d.newlyUnlocked);
    }).catch(() => {});

    // Push the browser's IANA timezone to the server on first load so the
    // "auto-skip by evening" bug stays fixed even when the user never opened
    // Settings. POST is idempotent — server ignores it if a tz is already set.
    if (typeof window !== "undefined") {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) fetch("/api/auth/setTimezone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz })
        }).catch(() => {});
      } catch { /* older browsers */ }
    }

    // Streak Toast: fire on the FIRST login of the day. We key off
    // localStorage so reloads within the same day don't re-show it, and
    // only render if the user has an active streak (>= 1).
    if (typeof window !== "undefined") {
      const todayKey = todayStr();
      const lastLoginDate = window.localStorage.getItem("habittrack_lastLogin");
      if (lastLoginDate !== todayKey) {
        window.localStorage.setItem("habittrack_lastLogin", todayKey);
        if (props.streak.current > 0) {
          setShowStreakToast(true);
          const t = setTimeout(() => setShowStreakToast(false), 6000);
          return () => clearTimeout(t);
        }
      }
    }

    const cronId = setInterval(() => { fetch("/api/cron/tick").catch(() => {}); }, 60_000);
    const refreshId = setInterval(refresh, 60_000);
    const reminderId = setInterval(() => {
      fetch("/api/reminders/deliver", { method: "POST" }).catch(() => {});
    }, 30_000);

    // Esc — currently a no-op key binding (legacy focus-mode exit); left in
    // place so we can hook it up for "exit fullscreen modal" later.
    const onKey = (_e: KeyboardEvent) => {};
    window.addEventListener("keydown", onKey);

    return () => { clearInterval(cronId); clearInterval(refreshId); clearInterval(reminderId); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  function tryVerify() {
    const hasAccess = userInfo && (userInfo.tier !== "free" || userInfo.trialDaysLeft > 0);
    if (!hasAccess) { setPaywall("AI Work Verifier"); return; }
    setVerifyHabit({ id: "_all_", name: "_all_" }); // signal to show modal with all habits
  }

  const today = todayStr();
  // Use habitsForToday here so the count reflects only scheduled-today
  // habits (matching what the user actually sees in their Today list).
  const completedToday = habitsForToday.filter((h) =>
    h.checkins.some((c) => c.date === today && c.completed)
  ).length;

  // Notifications: alert for skipped + pending habits today — only habits
  // that are scheduled today should warn about being skipped/pending.
  const skippedToday = habitsForToday.filter((h) =>
    h.checkins.some((c) => c.date === today && c.status === "skipped")
  );
  const pendingToday = habitsForToday.filter((h) => {
    const c = h.checkins.find((x) => x.date === today);
    return !c || (!c.completed && c.status !== "skipped");
  });
  const notifCount = skippedToday.length + (pendingToday.length > 0 ? 1 : 0);

  const nav: { id: View | string; label: string; icon: React.ReactNode; premium?: boolean; href?: string }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "habits", label: "Tasks", icon: <Plus className="h-4 w-4" />, href: "/tasks" },
    { id: "consistency", label: "Consistency", icon: <Grid3x3 className="h-4 w-4" /> },
    { id: "focus", label: "Focus Zone", icon: <Flame className="h-4 w-4" />, href: "/focus" },
    { id: "achievements", label: "Timeline & Achievements", icon: <Sparkles className="h-4 w-4" />, href: "/achievements" },
    { id: "trophies", label: "Badges & Trophies", icon: <Trophy className="h-4 w-4" />, href: "/badges" },
    { id: "stats", label: "Statistics", icon: <BarChart3 className="h-4 w-4" />, href: "/stats" },
    { id: "ai-insights", label: "AI Insights", icon: <Sparkles className="h-4 w-4" />, premium: true, href: "/insights" },
    { id: "leaderboard", label: "Leaderboard", icon: <Users className="h-4 w-4" />, href: "/leaderboard" },
    { id: "reminders", label: "Reminders", icon: <Bell className="h-4 w-4" />, premium: true, href: "/reminders" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <DashboardCanvas />
      <WelcomeOnboarding userName={userInfo?.name ?? undefined} />
      <WelcomeModal
        streak={props.streak.current}
        userName={userInfo?.name ?? undefined}
        completedToday={completedToday}
        totalHabitsToday={habitsForToday.length}
      />

      <div className={"shrink-0 h-screen transition-[width] duration-300 " + (sidebarOpen ? "w-[244px]" : "w-0 overflow-hidden")}>
        <Sidebar
          nav={nav}
          active={view}
          onNav={setView}
          streak={props.streak}
          completedToday={completedToday}
          totalHabits={habitsForToday.length}
          monthCells={props.monthCells}
          onLogout={logout}
          collapsed={false}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0">
        <header className="app-header px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition"
                  aria-label="Show sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="section-title !text-base sm:!text-lg truncate">
                  {nav.find((n) => n.id === view)?.label}
                </h1>
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
                  <div className="absolute right-0 top-11 z-30 w-80 panel animate-fade-up">
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
              <button
                onClick={() => setAddHabitOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white hover:opacity-90 transition"
                aria-label="Add habit"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                onClick={tryVerify}
                className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] transition"
                style={{ color: "var(--ink-soft)" }}
                aria-label="AI Verifier"
              >
                <Camera className="h-4 w-4" />
              </button>
              {userInfo && (userInfo.tier === "free" && !(userInfo.trialDaysLeft && userInfo.trialDaysLeft > 0)) && (
                <a
                  href="/pricing"
                  className="flex items-center gap-1 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.04]"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white" }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Get Pro
                </a>
              )}
              {userInfo && userInfo.tier === "basic_pro" && (
                <a
                  href="/pricing"
                  className="flex items-center gap-1 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.04]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Upgrade to Ultra
                </a>
              )}
              <ProfileChip onSettings={() => setSettingsOpen(true)} tier={userInfo?.tier} />
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-8 max-w-[1600px]">
          {view === "overview" && (
            <OverviewPanel
              habits={habitsForToday}
              monthCells={props.monthCells}
              monthName={props.monthName}
              streak={props.streak}
              completedToday={completedToday}
              earnedTrophies={earnedTrophies}
              totalTrophies={16}
              today={today}
              onChanged={refresh}
              multitasking={isMultitasking}
              onToggleMultitasking={() => setIsMultitasking((v) => !v)}
            />
          )}
          {view === "habits" && <HabitPanel habits={habits} onChanged={refresh} />}
          {view === "consistency" && (
            <CalendarPanel habits={habits} monthName={props.monthName} onChanged={refresh} onAddHabit={() => setAddHabitOpen(true)} />
          )}
          {view === "trophies" && <TrophiesPanel />}
          {view === "gamification" && <GamificationPanel />}
          {view === "leaderboard" && <LeaderboardPanel />}
          {view === "reminders" && userInfo && (
            <RemindersPanel tier={userInfo.tier} trialDaysLeft={userInfo.trialDaysLeft} />
          )}
          {view === "stats" && <StatsPanel />}
        </div>
      </main>

      {addHabitOpen && <QuickAddHabit onClose={() => setAddHabitOpen(false)} onCreated={refresh} />}

{verifyHabit && (
        <AIVerifierModal
          habitsForToday={habitsForToday.map(h => ({ id: h.id, name: h.name, requiresCamera: h.requiresCamera }))}
          onVerified={(passed, habitName, confidence, reason) => { setVerifyHabit(null); refresh(); }}
          onClose={() => setVerifyHabit(null)}
        />

      )}
      {paywall && <PaywallModal featureName={paywall} onClose={() => setPaywall(null)} />}

      <BadgeUnlockModal badge={badgeQueue.currentBadge} onClose={badgeQueue.dismissBadge} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Streak Toast — fires on first login of the day if there's an active streak */}
      {showStreakToast && (
        <div className="fixed bottom-6 left-6 z-40 max-w-sm animate-fade-up">
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#1d252b", color: "white", border: "1px solid #1d252b" }}>
            <Flame className="h-5 w-5" style={{ color: "var(--flame-fg)" }} />
            <div>
              <div className="text-sm font-bold">Day {props.streak.current} Streak Started!</div>
              <div className="text-xs" style={{ opacity: 0.8 }}>Let's get to work.</div>
            </div>
            <button onClick={() => setShowStreakToast(false)} className="ml-2 hover:opacity-70" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Focus Zone floating PiP — only when a session is live.
          Now lives on /focus; PiP removed in favour of the dedicated phase. */}
    </div>
  );
}

function ProfileChip({ onSettings, tier }: { onSettings: () => void; tier?: string }) {
  const [user, setUser] = useState<{ name?: string; email?: string; avatar?: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user)).catch(() => {});
  }, []);

  const initials = (user?.name || user?.email || "U")
    .split(/[ @]/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "U";

  const isPremium = tier === "basic_pro" || tier === "ultra_pro";

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
          {tier === "ultra_pro" ? "ULTRA" : "PRO"}
        </span>
      )}
    </button>
  );
}

function QuickAddHabit({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [busy, setBusy] = useState(false);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  // Multi-date calendar state (specific-day option)
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  // Repeat-next-month toggle (applies to "dates" schedule — clones chosen
  // day-of-months forward into the next month, matching HabitPanel logic)
  const [repeatNextMonth, setRepeatNextMonth] = useState(false);

  /**
   * Encode schedule using the SAME scheme as HabitPanel so the backend and
   * badge/computeStats logic parse it consistently:
   *   daily                            -> every day forever
   *   weekly:Mon,Wed,Fri              -> specific weekdays forever
   *   dates:2024-01-12,2024-01-15      -> specific one-off dates
   *   dates:2024-01-12,2024-01-15;r=1  -> specific dates + repeat next month
   *
   * NOTE: QuickAddHabit previously used a "next_month:Mon,Wed|repeat" format
   * that nothing else in the app parsed — habit creation silently failed
   * because computeStats didn't know which dates that habit ran on. The
   * "Repeat next month" option now means: pick specific dates AND set r=1
   * to clone them forward. For weekly-day schedules that should repeat
   * forever, "weekly:Mon,Wed" already repeats every week.
   */
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
    onCreated();
  }

  // ---------- calendar helpers for the `dates` option ----------
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  // Monday-first weekday offset
  const firstWeekdayMon = (new Date(calYear, calMonthIdx, 1).getDay() + 6) % 7;

  function toggleDate(d: string) {
    setSelectedDates((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/50 animate-fade-up" onClick={onClose}>
      <div className="panel w-full max-w-md animate-pop max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
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

          {/* Schedule picker — matches the options in HabitPanel exactly */}
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

            {/* Weekly + weekday picker */}
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

            {/* Multi-date calendar picker — no "this month only" restriction,
                user can navigate to ANY month and pick any future dates */}
            {schedule === "dates" && (
              <div className="mt-2">
                <span className="label-xs">Pick one or more dates</span>
                <MultiDatePicker
                  year={calYear} monthIdx={calMonthIdx} daysInMonth={daysInMonth}
                  firstWeekdayMon={firstWeekdayMon}
                  selected={selectedDates} onToggle={toggleDate}
                  onPrev={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}
                  onNext={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}
                  label={`${["January","February","March","April","May","June","July","August","September","October","November","December"][calMonthIdx]} ${calYear}`}
                />
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
            )}
            {schedule === "dates" && selectedDates.length === 0 && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--coral-500)" }}>Pick at least one date.</p>
            )}
            {schedule === "dates" && selectedDates.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedDates.slice().sort().map((d) => (
                  <span key={d} className="chip chip-green text-[10px] py-0.5">{d}</span>
                ))}
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

// Lightweight multi-date picker — lets the user click several calendar cells
// to set the dates a habit runs on. Mobile, no extra deps. Does NOT restrict to
// the current month — the user can navigate to any month forward or back.
function MultiDatePicker({
  year, monthIdx, daysInMonth, firstWeekdayMon,
  selected, onToggle, onPrev, onNext, label
}: {
  year: number; monthIdx: number; daysInMonth: number; firstWeekdayMon: number;
  selected: string[]; onToggle: (d: string) => void;
  onPrev: () => void; onNext: () => void; label: string;
}) {
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekdayMon; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(date);
  }
  return (
    <div className="mt-2 p-3" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onPrev} className="btn-ghost !p-1.5 text-xs" aria-label="Previous month">‹</button>
        <span className="text-xs font-semibold text-ink">{label}</span>
        <button type="button" onClick={onNext} className="btn-ghost !p-1.5 text-xs" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] meta font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} style={{ background: "transparent" }} />;
          const on = selected.includes(date);
          const isToday = date === todayStr();
          return (
            <button
              key={date}
              type="button"
              onClick={() => onToggle(date)}
              title={date}
              className={"aspect-square text-[11px] font-semibold border transition " +
                (on
                  ? "bg-[var(--green-600)] text-white border-[var(--green-700)]"
                  : "bg-[var(--surface)] text-ink border-[var(--line)] hover:border-ink") +
                (isToday && !on ? " ring-1 ring-ink" : "")}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button type="button" onClick={() => selected.forEach(onToggle)} className="mt-2 text-[10px] meta hover:text-ink transition">
          Clear all ({selected.length})
        </button>
      )}
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning — let's build consistency today";
  if (h < 18) return "Good afternoon — keep the streak alive";
  return "Good evening — finish strong today";
}

// (FocusZoneStub removed — replaced by /panels/FocusZonePanel.tsx FocusZonePanel)

/* Site-wide fullscreen maximize/minimize toggle button.
   Lets the user toggle the whole browser window into / out of fullscreen.
   Sits in the top-right of the dashboard header. */
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

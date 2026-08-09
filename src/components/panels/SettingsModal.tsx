"use client";

import { useEffect, useState } from "react";
import {
  User, Sun, Moon, Check, Trash2, Bell, Link as LinkIcon,
  HelpCircle, X, Settings as SettingsIcon, Mail, Clock, Calendar, Sparkles, LogOut,
  Monitor, Smartphone,
} from "lucide-react";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { GALLERY_IMAGES, CATEGORY_LABELS, type GalleryImage } from "@/lib/gallery";
import { RemindersPanel } from "./RemindersPanel";
import { AvatarPlaceholder } from "../ui/AvatarPlaceholder";

type Tab = "profile" | "appearance" | "notifications" | "reminders" | "help" | "advanced";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { id: "appearance", label: "Theme", icon: <Sun className="h-4 w-4" /> },
    { id: "notifications", label: "Alerts", icon: <Bell className="h-4 w-4" /> },
    { id: "reminders", label: "Reminders", icon: <Clock className="h-4 w-4" /> },
    { id: "help", label: "Help", icon: <HelpCircle className="h-4 w-4" /> },
    { id: "advanced", label: "Advanced", icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-md animate-fade-up-settings" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-[28px] animate-pop-settings flex flex-col"
        style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 50px 120px rgba(0,0,0,.4)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header — gradient stripe + animated title */}
        <div className="relative px-6 sm:px-8 py-6 border-b animate-fade-up-settings" style={{ borderColor: "var(--line)", background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(6,182,212,0.06) 100%)" }}>
          <div className="absolute top-0 left-0 right-0 h-1.5 animate-gradient-flow" style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4, #34d399, #3b82f6)", backgroundSize: "200% 100%" }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 animate-pop-settings">
              <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", boxShadow: "0 10px 24px rgba(59,130,246,0.35)" }}>
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight">Settings</h2>
                <p className="text-xs meta">Customize your sleek experience</p>
              </div>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[var(--bg-2)] transition hover:rotate-90 duration-300" aria-label="Close">
              <X className="h-4 w-4 text-ink-soft" />
            </button>
          </div>
        </div>

        {/* Tab strip — pill nav with animated active background */}
        <div className="flex gap-1.5 px-4 sm:px-6 pt-4 pb-3 overflow-x-auto animate-fade-up-settings" style={{ borderBottom: "1px solid var(--line-soft)" }}>
          {tabs.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap " +
                (tab === t.id
                  ? "bg-ink text-white shadow-md scale-105"
                  : "text-ink-soft hover:bg-[var(--bg-2)] hover:text-ink hover:scale-102")
              }
              style={{ animationDelay: `${idx * 50}ms` }}
              aria-pressed={tab === t.id}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body — slides on tab change */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8" key={tab}>
          <div className="animate-fade-up-settings">
            {tab === "profile" && <ProfileSection />}
            {tab === "appearance" && <AppearanceSection />}
            {tab === "notifications" && <NotificationsSection />}
            {tab === "reminders" && <RemindersSection />}
            {tab === "help" && <HelpSection />}
            {tab === "advanced" && <AdvancedSection />}
          </div>
        </div>
        <style>{`
          @keyframes fadeUpSettings {
            from { opacity: 0; transform: translateY(12px) scale(.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-fade-up-settings { animation: fadeUpSettings .45s cubic-bezier(.22, 1, .36, 1) both; }
          @keyframes popSettings {
            0% { transform: scale(.85); opacity: 0; }
            60% { transform: scale(1.04); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-pop-settings { animation: popSettings .4s cubic-bezier(.22, 1, .36, 1); }
          @keyframes gradientFlow {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
          .animate-gradient-flow { animation: gradientFlow 6s linear infinite; }
          .hover\:scale-102:hover { transform: scale(1.02); }
        `}</style>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

type UserFull = { id?: string; name?: string; email?: string; avatar?: string | null; bio?: string | null; locality?: string | null; tier?: string; trialDaysLeft?: number; settings?: any };

function ProfileSection() {
  const [user, setUser] = useState<UserFull | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setUser(d.user); setName(d.user?.name || ""); setBio(d.user?.bio || ""); setAvatar(d.user?.avatar || "");
    }).catch(() => {});
  }, []);

  async function saveProfile() {
    setSaving(true);
    const r = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar: avatar || null, bio: bio || null }),
    });
    setSaving(false);
    if (r.ok) { setSaved(true); setEditing(false); setPickerOpen(false); setTimeout(() => setSaved(false), 2000); }
  }

  const initials = (user?.name || user?.email || "U").split(/[ @]/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";

  return (
    <div className="space-y-5 animate-fade-up">
      {saved && <SavedBanner />}

      <div className="flex items-center gap-4">
        <div className="shrink-0">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" style={{ border: "2px solid var(--line)" }} />
          ) : (
            <AvatarPlaceholder size={64} className="rounded-full" style={{}} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-ink truncate">{user?.name || "(no name yet)"}</div>
          <div className="text-xs meta truncate">{user?.email}</div>
          {user?.bio && <div className="text-xs meta mt-1">{user.bio}</div>}
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-ghost mt-3 text-xs">Edit profile</button>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-3 animate-fade-up">
          <label className="block">
            <span className="label-xs">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input w-full mt-1.5" />
          </label>
          <label className="block">
            <span className="label-xs">Bio (optional)</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short line about you" className="input w-full mt-1.5 resize-none" />
          </label>

          <div>
            <span className="label-xs">Profile picture</span>
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="mt-1.5 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-dashed transition hover:border-ink"
              style={{ borderColor: "var(--line)" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "var(--blue-600)" }} />
              {avatar && avatar.startsWith("data:image/svg") ? "Browse curated gallery" : "Browse curated gallery"}
            </button>
            {avatar && (
              <button
                onClick={() => { setAvatar(""); setPickerOpen(true); }}
                disabled={!!avatar}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove current picture
              </button>
            )}
          </div>

          {pickerOpen && (
            <GalleryPicker
              current={avatar}
              onPick={(img) => { setAvatar(img.src); setPickerOpen(false); }}
            />
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={saveProfile} disabled={saving} className="btn-green">
              {saving ? "Saving…" : "Save profile"}
            </button>
            <button onClick={() => { setEditing(false); setPickerOpen(false); }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Subscription summary */}
      <div className="p-4 rounded-[14px]" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="h-4 w-4" />
          <span className="text-sm font-bold text-ink">Subscription</span>
        </div>
        <div className="text-xs meta">
          Current tier: <b className="text-ink" style={{ textTransform: "capitalize" }}>{user?.tier || "free"}</b>
          {user?.tier === "free" && user?.trialDaysLeft ? ` · trial ${user.trialDaysLeft}d left` : ""}
        </div>
      </div>
    </div>
  );
}

function GalleryPicker({ current, onPick }: { current: string; onPick: (img: GalleryImage) => void }) {
  const [filter, setFilter] = useState<"all" | "art" | "sketch" | "tech" | "nature">("all");
  const cats = ["all", ...Object.keys(CATEGORY_LABELS)] as Array<"all" | "art" | "sketch" | "tech" | "nature">;
  const shown = filter === "all" ? GALLERY_IMAGES : GALLERY_IMAGES.filter((g) => g.category === filter);

  return (
    <div className="p-3 rounded-[14px] animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={
              "px-2.5 py-1 text-[11px] font-medium rounded-xl transition " +
              (filter === c ? "bg-ink text-white" : "bg-[var(--surface)] text-ink-soft border border-[var(--line)] hover:border-ink")
            }
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {shown.map((img) => {
          const selected = current === img.src;
          return (
            <button
              key={img.id}
              onClick={() => onPick(img)}
              title={img.label}
              className="relative aspect-square rounded-[10px] overflow-hidden transition hover:scale-[1.06]"
              style={{ border: selected ? "2px solid var(--indigo-600)" : "2px solid var(--line)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.label} className="h-full w-full object-cover" />
              {selected && (
                <span className="absolute inset-0 grid place-items-center" style={{ background: "rgba(99,102,241,.25)" }}>
                  <Check className="h-4 w-4 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] meta mt-2">Pre-installed art · sketches · tech & nature patterns. No copyright concerns — pick any.</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function AppearanceSection() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [autoSkipOn, setAutoSkipOn] = useState(true);
  const [weekStartMon, setWeekStartMon] = useState(true);
  const [multitaskingDefault, setMultitaskingDefault] = useState(false);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"desktop" | "phone">("desktop");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const s = d.user?.settings;
      const t = s?.theme === "dark" ? "dark" : "light";
      setTheme(t); setAutoSkipOn(s?.autoSkipOn ?? true); setWeekStartMon(s?.weekStartMon ?? true);
      setMultitaskingDefault(s?.multitaskingDefault ?? false); setTimezone(s?.timezone ?? null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("theme", t);
        document.documentElement.setAttribute("data-theme", t);
        const mode = window.localStorage.getItem("sleek_layout_mode") === "phone" ? "phone" : "desktop";
        setLayoutMode(mode);
        document.documentElement.setAttribute("data-layout-mode", mode);
      }
    }).catch(() => {});
  }, []);

  function applyLayoutMode(mode: "desktop" | "phone") {
    setLayoutMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sleek_layout_mode", mode);
      document.documentElement.setAttribute("data-layout-mode", mode);
    }
  }

  async function save(overrides?: Record<string, unknown>) {
    const payload = { multitaskingDefault, autoSkipOn, weekStartMon, theme, ...overrides };
    await fetch("/api/auth/account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  async function setThemeAndPersist(t: "light" | "dark") {
    setTheme(t);
    if (typeof window !== "undefined") { window.localStorage.setItem("theme", t); document.documentElement.setAttribute("data-theme", t); }
    await save({ theme: t });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {saved && <SavedBanner />}

      <section>
        <SectionTitle icon={<Sun className="h-4 w-4" />}>Theme</SectionTitle>
        <div className="flex gap-2">
          <ThemeBtn active={theme === "light"} onClick={() => setThemeAndPersist("light")} icon={<Sun className="h-4 w-4" />} label="White" />
          <ThemeBtn active={theme === "dark"} onClick={() => setThemeAndPersist("dark")} icon={<Moon className="h-4 w-4" />} label="Black" />
        </div>
      </section>

      <section>
        <SectionTitle icon={<Monitor className="h-4 w-4" />}>Layout Mode</SectionTitle>
        <p className="text-[10px] meta mb-2.5 leading-relaxed max-w-md">
          Desktop-friendly: full sidebar for large screens. Phone-friendly: compact layout, sidebar slides out as overlay — best for small or portrait- oriented devices.
        </p>
        <div className="flex gap-2">
          <LayoutBtn active={layoutMode === "desktop"} onClick={() => applyLayoutMode("desktop")} icon={<Monitor className="h-4 w-4" />} label="Desktop" />
          <LayoutBtn active={layoutMode === "phone"} onClick={() => applyLayoutMode("phone")} icon={<Smartphone className="h-4 w-4" />} label="Phone" />
        </div>
      </section>

      <section>
        <SectionTitle icon={<SettingsIcon className="h-4 w-4" />}>Preferences</SectionTitle>
        <div className="space-y-1">
          <ToggleRow label="Multitasking default ON" desc="Default state of the multitasking toggle on new check-ins." on={multitaskingDefault} setOn={(v) => { setMultitaskingDefault(v); save({ multitaskingDefault: v }); }} />
          <ToggleRow label="Auto-skip at 12:00 PM" desc="Mark undone habits as skipped after noon (locks them)." on={autoSkipOn} setOn={(v) => { setAutoSkipOn(v); save({ autoSkipOn: v }); }} />
          <ToggleRow label="Week starts on Monday" desc="Calendar and heatmap grids start from Monday." on={weekStartMon} setOn={(v) => { setWeekStartMon(v); save({ weekStartMon: v }); }} />
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium text-ink">Time zone</div>
              <div className="text-xs meta mt-0.5">Auto-skip cutoff and reminder times use this zone. Auto = server guess.</div>
            </div>
            <select value={timezone ?? ""} onChange={(e) => { const v = e.target.value || null; setTimezone(v); save({ timezone: v }); }} className="input max-w-[220px]">
              <option value="">Auto (server guess)</option>
              {COMMON_TIMEZONES.map((tz) => (<option key={tz} value={tz}>{tz.replace("_", " ")}</option>))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}

function NotificationsSection() {
  const [emailsMorning, setEmailsMorning] = useState(true);
  const [emailsEvening, setEmailsEvening] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushGranted, setPushGranted] = useState(false);
  const [weeklyMonday, setWeeklyMonday] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const s = d.user?.settings;
      setEmailsMorning(s?.emailsMorning ?? true); setEmailsEvening(s?.emailsEvening ?? true);
      setPushEnabled(s?.pushEnabled ?? true); setWeeklyMonday(s?.weeklyMondayReminder ?? false);
      if (typeof window !== "undefined") setPushGranted((window as any).Notification?.permission === "granted");
    }).catch(() => {});
  }, []);

  async function save(overrides?: Record<string, unknown>) {
    const payload = { emailsMorning, emailsEvening, pushEnabled, weeklyMondayReminder: weeklyMonday, ...overrides };
    await fetch("/api/auth/account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  async function requestPush() {
    const N = (window as any).Notification;
    if (!N) return;
    const perm = await N.requestPermission();
    setPushGranted(perm === "granted");
    if (perm === "granted") save({ pushEnabled: true });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {saved && <SavedBanner />}

      <section>
        <SectionTitle icon={<Bell className="h-4 w-4" />}>In-app & email alerts</SectionTitle>
        <div className="space-y-1">
          <ToggleRow label="Morning agenda email" desc="Daily ~6 AM summary of today's tasks." on={emailsMorning} setOn={(v) => { setEmailsMorning(v); save({ emailsMorning: v }); }} />
          <ToggleRow label="Evening summary email" desc="Daily ~10 PM wrap-up of done vs missed." on={emailsEvening} setOn={(v) => { setEmailsEvening(v); save({ emailsEvening: v }); }} />
          <div className="py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-ink">Browser push notifications</div>
                <div className="text-xs meta mt-0.5">Bell-icon alerts in the app for skipped/pending habits.</div>
              </div>
              {pushGranted ? (
                <ToggleRowInline label="" on={pushEnabled} setOn={(v) => { setPushEnabled(v); save({ pushEnabled: v }); }} />
              ) : (
                <button onClick={requestPush} className="text-xs px-3 py-1.5 rounded-xl border border-[var(--line)] hover:border-ink text-ink-soft hover:text-ink transition">Request permission</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="p-4 rounded-[14px]" style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)", color: "white" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-bold">Weekly Monday reminder</span>
            </div>
            <p className="text-xs opacity-90 max-w-xs">Every Monday morning at 8:00, get an email listing all your tasks scheduled for the day. Kick your week off right.</p>
          </div>
          <ToggleOnDark on={weeklyMonday} setOn={(v) => { setWeeklyMonday(v); save({ weeklyMondayReminder: v }); }} />
        </div>
      </section>
    </div>
  );
}

function RemindersSection() {
  const [tier, setTier] = useState<string>("free");
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { setTier(d.user?.tier || "free"); setTrialDaysLeft(d.user?.trialDaysLeft ?? 0); }).catch(() => {});
  }, []);
  return (
    <div className="animate-fade-up">
      <div className="text-xs meta mb-3 p-3 rounded-[12px]" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
        <Mail className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
        Set custom time-based reminders that fire as email + browser alerts while your dashboard is open. Uses the 12-hour dial picker.
      </div>
      <RemindersPanel tier={tier} trialDaysLeft={trialDaysLeft} />
    </div>
  );
}

function HelpSection() {
  const links = [
    { href: "/about", label: "About sleek" },
    { href: "/faqs", label: "FAQs" },
    { href: "/contact", label: "Contact" },
    { href: "/terms", label: "Terms & conditions" },
    { href: "/privacy", label: "Privacy policy" },
    { href: "/", label: "Landing page" },
  ];
  return (
    <div className="animate-fade-up space-y-3">
      <SectionTitle icon={<HelpCircle className="h-4 w-4" />}>Help & links</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-2">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="flex items-center justify-between px-3 py-2 rounded-[12px] hover:bg-[var(--bg-2)] transition" style={{ border: "1px solid var(--line-soft)" }}>
            <span className="flex items-center gap-2 text-ink-soft text-sm"><LinkIcon className="h-3.5 w-3.5" /> {l.label}</span>
            <span className="text-xs meta">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function AdvancedSection() {
  const [step, setStep] = useState<"idle" | "warn">("idle");
  const [warnName, setWarnName] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [userData, setUserData] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setUserData({ name: d.user?.name || d.user?.email?.split("@")[0] || "", email: d.user?.email || "" });
    }).catch(() => {});
  }, []);

  async function deleteAccount() {
    setDelBusy(true); setDelErr("");
    // Send the typed name as confirmation. Backend matches against user.name
    // (case-insensitive trims). No password required.
    const r = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameConfirm: warnName.trim() }),
    });
    setDelBusy(false);
    if (r.ok) { window.location.href = "/login"; }
    else { const d = await r.json().catch(() => ({})); setDelErr(d.error || "Could not delete account"); }
  }

  function handleStartDelete() {
    if (!warnName.trim() || warnName.trim().toLowerCase() !== (userData?.name?.trim().toLowerCase() || "")) {
      setDelErr("The name you entered doesn't match your account name.");
      return;
    }
    setDelErr("");
    setStep("warn");
  }

  function handleGoBack() {
    setStep("idle");
    setWarnName("");
    setDelErr("");
  }

  return (
    <div className="animate-fade-up space-y-3">
      <SectionTitle icon={<SettingsIcon className="h-4 w-4" />}>Account management</SectionTitle>
      <p className="text-sm meta">This section is irreversible. Proceed with caution.</p>

      {/* Logout */}
      <button
        onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
        className="btn-ghost inline-flex items-center gap-2 text-sm w-full justify-center"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="border-t" style={{ borderColor: "var(--line-soft)" }} />

      {/* Step 0: idle — ask for name first */}
      {step === "idle" && (
        <div className="p-4 rounded-[14px] animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
          <button onClick={() => setStep("idle")} className="btn-ghost inline-flex items-center gap-2 text-sm mb-3" style={{ color: "var(--coral-500)" }}>
            <Trash2 className="h-4 w-4" /> Remove account
          </button>
          <p className="text-xs meta mb-3">Type your account name below to start the removal process.</p>
          <input
            type="text"
            value={warnName}
            onChange={(e) => { setWarnName(e.target.value); setDelErr(""); }}
            placeholder={userData?.name ? `Type: ${userData.name}` : "Your name"}
            className="input w-full"
          />
          {delErr && <p className="text-sm mt-2" style={{ color: "var(--coral-500)" }}>{delErr}</p>}
          <button onClick={handleStartDelete} disabled={!warnName.trim()} className="btn-primary mt-3 text-sm disabled:opacity-50">
            Continue
          </button>
        </div>
      )}

      {/* Step 1: Warning + final delete (no password) */}
      {step === "warn" && (
        <div className="p-4 rounded-[14px] animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--coral-500)" }}>
          <div className="flex items-start gap-2 mb-3">
            <Trash2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--coral-500)" }} />
            <div>
              <div className="text-sm font-bold text-ink mb-1">This will permanently remove your account</div>
              <p className="text-xs meta leading-relaxed">
                All your data will be permanently deleted — every habit you've created, every check-in you've logged,
                every badge and trophy you've earned, every reminder you've set, every streak you've built.
                Your account is moved to the past-users archive; if you sign up again with the same email,
                your archived history will be restored automatically. There is no other undo.
              </p>
            </div>
          </div>
          {delErr && <p className="text-sm mb-2" style={{ color: "var(--coral-500)" }}>{delErr}</p>}
          <div className="flex gap-2">
            <button onClick={deleteAccount} disabled={delBusy} className="btn-primary text-sm disabled:opacity-50" style={{ background: "var(--coral-600)" }}>
              {delBusy ? "Deleting…" : "Delete my account forever"}
            </button>
            <button onClick={handleGoBack} className="btn-ghost text-sm" disabled={delBusy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── shared bits ───────── */

function SavedBanner() {
  return (
    <div className="p-3 text-sm flex items-center gap-2 animate-pop-settings rounded-[14px]"
      style={{ background: "var(--green-50)", border: "1px solid var(--green-200)", color: "var(--green-700)" }}>
      <Check className="h-4 w-4" /> Changes saved.
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}<h3 className="text-sm font-bold text-ink">{children}</h3>
    </div>
  );
}

function ToggleRow({ label, desc, on, setOn }: { label: string; desc: string; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 transition group hover:bg-[var(--bg-2)] -mx-2 px-2 rounded-lg">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs meta mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className="relative h-6 w-11 shrink-0 transition-all duration-300 toggle-pill"
        style={{ background: on ? "var(--green-600)" : "var(--bg-2)", border: "1px solid var(--line)", transform: on ? "scale(1.05)" : "scale(1)" }}
        aria-pressed={on}
      >
        <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300"
          style={{
            left: on ? "22px" : "2px",
            background: "white",
            boxShadow: on ? "0 2px 6px rgba(0,0,0,.25)" : "0 1px 2px rgba(0,0,0,.15)",
            transform: on ? "scale(1.1)" : "scale(1)",
          }} />
      </button>
    </div>
  );
}

function ToggleRowInline({ on, setOn }: { label: string; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setOn(!on)}
      className="relative h-6 w-11 shrink-0 transition"
      style={{ background: on ? "var(--green-600)" : "var(--bg-2)", border: "1px solid var(--line)" }}
      aria-pressed={on}
    >
      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: on ? "22px" : "2px", background: "white" }} />
    </button>
  );
}

function ToggleOnDark({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setOn(!on)}
      className="relative h-6 w-11 shrink-0 transition rounded-full"
      style={{ background: on ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.25)" }}
      aria-pressed={on}
    >
      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: on ? "22px" : "2px", background: on ? "#3b82f6" : "white" }} />
    </button>
  );
}

function ThemeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-xl transition-all duration-200 hover:scale-102 " +
        (active ? "bg-ink text-white border-ink shadow-md" : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
      style={active ? { transform: "scale(1.05)" } : {}}
      aria-pressed={active}
    >
      <span className={active ? "animate-pop-settings" : ""}>{icon}</span> {label}
    </button>
  );
}

function LayoutBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-xl transition-all duration-200 hover:scale-102 whitespace-nowrap " +
        (active ? "text-white border-transparent shadow-md" : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
      style={active ? { background: "linear-gradient(135deg, #3b82f6, #06b6d4)", borderColor: "transparent", boxShadow: "0 4px 14px -4px rgba(59,130,246,0.3)", transform: "scale(1.05)" } : {}}
      aria-pressed={active}
    >
      <span className={active ? "animate-pop-settings" : ""}>{icon}</span> {label}
    </button>
  );
}
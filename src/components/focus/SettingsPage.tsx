"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Sun, Moon, Check, Trash2, Bell, BellOff, Mail, Plus, X } from "lucide-react";

/* Standalone settings page at /settings.
   Supports: profile editing, theme toggle (light/dark),
   timezone picker, and account deletion flow. */
export function SettingsPageClient() {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [locality, setLocality] = useState("");
  const [theme, setTheme] = useState("light");
  const [timezone, setTimezone] = useState("");
  const [multitaskingDefault, setMultitaskingDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  // Danger zone
  const [showDelete, setShowDelete] = useState(false);
  const [delEmail, setDelEmail] = useState("");
  const [delPass, setDelPass] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  // Reminders
  const [reminders, setReminders] = useState<any[]>([]);
  const [pushGranted, setPushGranted] = useState(false);
  const [emailsMorning, setEmailsMorning] = useState(true);
  const [emailsEvening, setEmailsEvening] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [newRTime, setNewRTime] = useState("09:00");
  const [newRLabel, setNewRLabel] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user);
      setName(d.user?.name || "");
      setBio(d.user?.bio || "");
      setAvatar(d.user?.avatar || "");
      setLocality(d.user?.locality || "");
      setMultitaskingDefault(d.user?.settings?.multitaskingDefault ?? false);
      const t = d.user?.settings?.theme === "dark" ? "dark" : "light";
      setTheme(t);
      setTimezone(d.user?.settings?.timezone ?? "");
      setEmailsMorning(d.user?.settings?.emailsMorning ?? true);
      setEmailsEvening(d.user?.settings?.emailsEvening ?? true);
      setPushEnabled(d.user?.settings?.pushEnabled ?? true);
      if (typeof window !== "undefined") {
        document.documentElement.setAttribute("data-theme", t);
        window.localStorage.setItem("theme", t);
        const perm = (window as any).Notification?.permission;
        setPushGranted(perm === "granted");
      }
    }).catch(() => {});
    fetchReminders();
  }, []);

  async function toggleTheme(t: "light" | "dark") {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    if (typeof window !== "undefined") window.localStorage.setItem("theme", t);
    await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: t, multitaskingDefault })
    });
  }

  async function savePrefs() {
    await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, multitaskingDefault, timezone: timezone || undefined })
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveProfile() {
    setSaving(true);
    await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar: avatar || null, bio: bio || null, locality: locality || null })
    });
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function fetchReminders() {
    fetch("/api/reminders").then(r => r.json()).then(d => setReminders(d.reminders || [])).catch(() => {});
  }

  async function addReminder() {
    if (!newRLabel.trim()) return;
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: newRTime, label: newRLabel })
    });
    setNewRLabel("");
    fetchReminders();
  }

  async function toggleReminder(id: string, enabled: boolean) {
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled }) });
    fetchReminders();
  }

  async function deleteReminder(id: string) {
    await fetch("/api/reminders?id=" + encodeURIComponent(id), { method: "DELETE" });
    fetchReminders();
  }

  async function requestPushPermission() {
    const N = (window as any).Notification;
    if (!N) return;
    const perm = await N.requestPermission();
    setPushGranted(perm === "granted");
    if (perm !== "granted") return;
    await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushEnabled: true })
    });
    setPushEnabled(true);
  }

  async function toggleEmailToggle(field: "emailsMorning" | "emailsEvening" | "pushEnabled", v: boolean) {
    if (field === "pushEnabled") { setPushEnabled(v); if (v && !pushGranted) return requestPushPermission(); }
    else if (field === "emailsMorning") setEmailsMorning(v);
    else setEmailsEvening(v);
    await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: v })
    });
  }

  // Poll reminder delivery every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/reminders/deliver", { method: "POST" });
        const d = await r.json();
        for (const item of d.due || []) {
          const N = (window as any).Notification;
          if (N && N.permission === "granted") {
            new N(`sleek · ${item.label}`, { body: item.habitName ? `Task: ${item.habitName} · ${item.time}` : `Reminder · ${item.time}`, icon: "/icon.svg" });
          }
        }
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function deleteAccount() {
    setDelBusy(true);
    setDelErr("");
    const r = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: delEmail, password: delPass })
    });
    setDelBusy(false);
    if (r.ok) {
      window.location.href = "/login";
    } else {
      const d = await r.json().catch(() => ({}));
      setDelErr(d.error || "Could not delete. Verify your email and password.");
    }
  }

  const tzOptions = [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Kolkata",
    "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="app-header px-6 py-3.5 sticky top-0 z-10 flex items-center gap-3">
        <a href="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition" aria-label="Back to dashboard" title="Back">
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="section-title !text-base sm:!text-lg">Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* ── Profile ── */}
        <div className="card !p-7">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white text-sm font-semibold">
              {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase?.() ?? "U"}
            </span>
            <div>
              <div className="font-semibold text-ink">{name || user?.email || "User"}</div>
              <div className="text-xs text-ink-muted">{user?.email}</div>
            </div>
            <button onClick={() => setEditing(!editing)} className="btn-ghost text-xs ml-auto">
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing && (
            <div className="space-y-3 mt-4">
              <input className="input w-full" placeholder="Display name" value={name} onChange={e => setName(e.target.value)} />
              <input className="input w-full" placeholder="Bio (optional)" value={bio} onChange={e => setBio(e.target.value)} />
              <input className="input w-full" placeholder="Locality (optional)" value={locality} onChange={e => setLocality(e.target.value)} />
              <button onClick={saveProfile} disabled={saving} className="btn-green">
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          )}
        </div>

        {/* ── Theme ── */}
        <div className="card !p-7">
          <h3 className="font-semibold text-ink mb-3">Appearance</h3>
          <div className="flex gap-2">
            <button
              onClick={() => toggleTheme("light")}
              className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition " + (theme === "light" ? "bg-ink text-white" : "bg-[var(--bg-2)] text-ink-soft border border-[var(--line)] hover:border-ink")}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
            <button
              onClick={() => toggleTheme("dark")}
              className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition " + (theme === "dark" ? "bg-ink text-white" : "bg-[var(--bg-2)] text-ink-soft border border-[var(--line)] hover:border-ink")}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
          </div>
        </div>

        {/* ── Preferences ── */}
        <div className="card !p-7">
          <h3 className="font-semibold text-ink mb-3">Preferences</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={multitaskingDefault} onChange={e => setMultitaskingDefault(e.target.checked)} className="sr-only" />
              <span className="sleek-check" data-checked={multitaskingDefault ? "true" : "false"} />
              <span className="text-sm text-ink-soft">Multitasking mode (records multitasking flag on taps by default)</span>
            </label>
            <div>
              <label className="text-[11px] uppercase tracking-[.12em] text-ink-muted">Timezone</label>
              <select className="input w-full mt-1.5" value={timezone} onChange={e => setTimezone(e.target.value)}>
                <option value="">Auto-detect</option>
                {tzOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <button onClick={savePrefs} className="btn-ghost text-sm mt-3">
              Save preferences {saved && <Check className="inline h-3.5 w-3.5 ml-1 text-green-600" />}
            </button>
          </div>
        </div>

        {/* ── Notifications + Emails ── */}
        <div className="card !p-7">
          <h3 className="font-semibold text-ink mb-3">Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pushGranted ? <Bell className="h-4 w-4 text-green-600" /> : <BellOff className="h-4 w-4 text-ink-muted" />}
                <span className="text-sm text-ink-soft">Browser notifications</span>
              </div>
              {pushGranted ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={pushEnabled} onChange={e => toggleEmailToggle("pushEnabled", e.target.checked)} className="sr-only" />
                  <span className="sleek-check" data-checked={pushEnabled ? "true" : "false"} />
                </label>
              ) : (
                <button onClick={requestPushPermission} className="text-xs px-3 py-1.5 rounded-xl border border-[var(--line)] hover:border-ink text-ink-soft hover:text-ink transition">
                  Request permission
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {emailsMorning ? <Mail className="h-4 w-4 text-blue-500" /> : <Mail className="h-4 w-4 text-ink-muted" />}
                <span className="text-sm text-ink-soft">Morning agenda email</span>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={emailsMorning} onChange={e => toggleEmailToggle("emailsMorning", e.target.checked)} className="sr-only" />
                <span className="sleek-check" data-checked={emailsMorning ? "true" : "false"} />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {emailsEvening ? <Mail className="h-4 w-4 text-blue-500" /> : <Mail className="h-4 w-4 text-ink-muted" />}
                <span className="text-sm text-ink-soft">Evening summary email</span>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={emailsEvening} onChange={e => toggleEmailToggle("emailsEvening", e.target.checked)} className="sr-only" />
                <span className="sleek-check" data-checked={emailsEvening ? "true" : "false"} />
              </label>
            </div>
          </div>
        </div>

        {/* ── Reminders ── */}
        <div className="card !p-7">
          <h3 className="font-semibold text-ink mb-3">Reminders</h3>
          <div className="flex items-center gap-2 mb-4">
            <input type="time" value={newRTime} onChange={e => setNewRTime(e.target.value)} className="input !py-1.5 !w-24" />
            <input className="input flex-1 !py-1.5" placeholder="Label…" value={newRLabel} onChange={e => setNewRLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addReminder(); }} />
            <button onClick={addReminder} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {reminders.length === 0 && <p className="text-xs text-ink-muted">No reminders yet. Add one above.</p>}
          <ul className="space-y-2">
            {reminders.map((r: any) => (
              <li key={r.id} className="flex items-center gap-3 py-1.5 border-b border-[var(--line)] last:border-0">
                <span className="text-xs tabular-nums font-mono text-ink-muted w-12">{r.time}</span>
                <span className="text-sm text-ink flex-1 truncate">{r.label}</span>
                <label className="flex items-center cursor-pointer">
                  <input type="checkbox" checked={r.enabled} onChange={e => toggleReminder(r.id, e.target.checked)} className="sr-only" />
                  <span className="sleek-check" data-checked={r.enabled ? "true" : "false"} />
                </label>
                <button onClick={() => deleteReminder(r.id)} className="grid h-7 w-7 place-items-center rounded-xl hover:bg-red-50 text-ink-muted hover:text-red-600 transition" title="Delete">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Danger zone ── */}
        <div className="card !p-7" style={{ borderColor: "rgba(220, 38, 38, .3)" }}>
          <h3 className="font-semibold text-ink mb-1">Danger zone</h3>
          <p className="text-xs text-ink-muted mb-3">Delete your account permanently. This cannot be undone.</p>
          {!showDelete && (
            <button onClick={() => setShowDelete(true)} className="flex items-center gap-1 text-xs text-red-500 font-medium hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Delete my account
            </button>
          )}
          {showDelete && (
            <div className="space-y-3 mt-3">
              <input className="input w-full" placeholder="Your email" value={delEmail} onChange={e => setDelEmail(e.target.value)} type="email" />
              <input className="input w-full" placeholder="Your password" value={delPass} onChange={e => setDelPass(e.target.value)} type="password" />
              {delErr && <p className="text-xs text-red-500">{delErr}</p>}
              <div className="flex gap-2">
                <button onClick={deleteAccount} disabled={delBusy || !delEmail || !delPass} className="text-xs px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition">
                  {delBusy ? "Deleting…" : "Confirm deletion"}
                </button>
                <button onClick={() => { setShowDelete(false); setDelErr(""); }} className="text-xs btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── About row ── */}
        <div className="text-center text-xs text-ink-muted">
          <a href="/about" className="hover:text-ink">About sleek</a>
          {" · "}
          <a href="/faqs" className="hover:text-ink">FAQs</a>
          {" · "}
          <a href="/terms" className="hover:text-ink">Terms</a>
          {" · "}
          <a href="/privacy" className="hover:text-ink">Privacy</a>
        </div>
      </main>
    </div>
  );
}
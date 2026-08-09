"use client";

import { useEffect, useState } from "react";
import { User, Upload, Trash2, Check, Link as LinkIcon, ChevronDown, ChevronRight, Bell, Settings as SettingsIcon, HelpCircle, Sun, Moon } from "lucide-react";
import { COMMON_TIMEZONES } from "@/lib/timezones";

export function SettingsPanel() {
  const [user, setUser] = useState<{ id?: string; name?: string; email?: string; avatar?: string | null; bio?: string | null } | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [locality, setLocality] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // Notifications prefs (persisted to backend via PUT /api/auth/account)
  const [notifSkipped, setNotifSkipped] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);

  // Preferences (persisted)
  const [autoSkipOn, setAutoSkipOn] = useState(true);
  const [weekStartMon, setWeekStartMon] = useState(true);
  const [multitaskingDefault, setMultitaskingDefault] = useState(false);
  const [emailsMorning, setEmailsMorning] = useState(true);
  const [emailsEvening, setEmailsEvening] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [tier, setTier] = useState<string>("free");
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  // Advanced (collapsed)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [delEmail, setDelEmail] = useState("");
  const [delPass, setDelPass] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setUser(d.user);
      setName(d.user?.name || "");
      setBio(d.user?.bio || "");
      setAvatar(d.user?.avatar || "");
      setLocality(d.user?.locality || "");
      setMultitaskingDefault(d.user?.settings?.multitaskingDefault ?? false);
      setEmailsMorning(d.user?.settings?.emailsMorning ?? true);
      setEmailsEvening(d.user?.settings?.emailsEvening ?? true);
      setPushEnabled(d.user?.settings?.pushEnabled ?? true);
      setAutoSkipOn(d.user?.settings?.autoSkipOn ?? true);
      setWeekStartMon(d.user?.settings?.weekStartMon ?? true);
      const t = (d.user?.settings?.theme === "dark" ? "dark" : "light");
      setTheme(t);
      setTimezone(d.user?.settings?.timezone ?? null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("theme", t);
        document.documentElement.setAttribute("data-theme", t);
      }
      setTier(d.user?.tier || "free");
      setTrialDaysLeft(d.user?.trialDaysLeft ?? 0);
    }).catch(() => {});
  }, []);

  async function savePrefs(overrides?: Record<string, unknown>) {
    const payload = { multitaskingDefault, emailsMorning, emailsEvening, pushEnabled, autoSkipOn, weekStartMon, theme, ...overrides };
    await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar: avatar || null, bio: bio || null, locality: locality || null })
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setEditingProfile(false);
      setTimeout(() => setSaved(false), 2200);
    }
  }

  async function deleteAccount() {
    setDelBusy(true);
    setDelErr("");
    const res = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: delEmail, password: delPass })
    });
    const data = await res.json().catch(() => ({}));
    setDelBusy(false);
    if (res.ok) {
      window.location.href = "/login";
    } else {
      setDelErr(data?.error || "Could not delete account");
    }
  }

  const initials = (user?.name || user?.email || "U")
    .split(/[ @]/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "").join("") || "U";

  return (
    <div className="max-w-4xl animate-fade-up space-y-6">
      {saved && (
        <div className="p-3 text-sm flex items-center gap-2 animate-pop" style={{ background: "var(--green-50)", border: "1px solid var(--green-200)", color: "var(--green-700)" }}>
          <Check className="h-4 w-4" /> Changes saved.
        </div>
      )}

      {/* Section: Profile */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Profile</h2>
        </div>

        <div className="flex items-start gap-4">
          <div>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-14 w-14 object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center bg-ink text-white text-lg font-bold">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">{user?.name || "(no name yet)"}</div>
            <div className="text-xs meta">{user?.email}</div>
            {user?.bio && <div className="text-xs meta mt-1">{user.bio}</div>}
            {!editingProfile && (
              <button onClick={() => setEditingProfile(true)} className="btn-ghost mt-3 text-xs">
                Edit profile
              </button>
            )}
          </div>
        </div>

        {editingProfile && (
          <div className="mt-4 space-y-3 animate-fade-up">
            <label className="block">
              <span className="label-xs">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input w-full mt-1.5" />
            </label>
            <label className="block">
              <span className="label-xs">Avatar</span>
              <AvatarInput value={avatar} onChange={setAvatar} />
            </label>
            <label className="block">
              <span className="label-xs">Bio (optional)</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short line about you" className="input w-full mt-1.5 resize-none" />
            </label>
            <label className="block">
              <span className="label-xs">Locality (optional)</span>
              <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Gwalior, Sector 4" className="input w-full mt-1.5" />
              <span className="text-[10px] meta mt-1 block">Used to find regional peers. Exact street/city is hidden on the public leaderboard behind a blank space (e.g. "Gwalior, ____").</span>
            </label>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving} className="btn-green">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingProfile(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Section: Subscription */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-3">
          <SettingsIcon className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Subscription</h2>
        </div>
        <div className="text-sm">
          <b className="text-ink">Current tier:</b> <span style={{ textTransform: "capitalize" }}>{tier}</span>
          {tier === "free" && trialDaysLeft > 0 && (
            <span className="ml-2 chip chip-amber text-[10px] py-0.5">Premium trial · {trialDaysLeft}d left</span>
          )}
          {tier === "free" && trialDaysLeft <= 0 && (
            <span className="ml-2 text-xs meta">Trial expired — upgrade to keep AI insights, the AI Work Verifier, automated email reminders, and Google Workspace exports.</span>
          )}
        </div>
        <div className="mt-3 text-xs meta">
          Pro and Ultra Pro tiers are <b>coming soon</b>. For now, premium
          features are free during the 2-day new-user trial — after that you
          can keep using all the core tracking features at no cost.
        </div>
      </section>

      {/* Section: Notifications */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Notifications</h2>
        </div>
        <div className="space-y-3">
          <ToggleRow label="Morning agenda email" desc="Daily ~6 AM summary of today's tasks + motivation (requires Gmail setup)." on={emailsMorning} setOn={(v) => { setEmailsMorning(v); savePrefs({ emailsMorning: v }); }} />
          <ToggleRow label="Evening summary email" desc="Daily ~10 PM wrap-up of what was done vs missed (requires Gmail setup)." on={emailsEvening} setOn={(v) => { setEmailsEvening(v); savePrefs({ emailsEvening: v }); }} />
          <ToggleRow label="In-app push notifications" desc="Show bell-icon alerts in the app for skipped/pending habits." on={pushEnabled} setOn={(v) => { setPushEnabled(v); savePrefs({ pushEnabled: v }); }} />
        </div>
        {!emailsMorning && !emailsEvening && (
          <p className="mt-3 text-xs meta">All email notifications off. You'll still see in-app bell alerts.</p>
        )}
      </section>

      {/* Section: Preferences */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Preferences</h2>
        </div>
        <div className="space-y-3">
          <ToggleRow label="Multitasking default ON" desc="Default state of the multitasking toggle on new check-ins." on={multitaskingDefault} setOn={(v) => { setMultitaskingDefault(v); savePrefs({ multitaskingDefault: v }); }} />
          <ToggleRow label="Auto-skip at 12:00 PM" desc="Mark undone habits as skipped after noon. Once locked (per immutability rule), must delete+recreate to correct." on={autoSkipOn} setOn={(v) => { setAutoSkipOn(v); savePrefs({ autoSkipOn: v }); }} />
          <ToggleRow label="Week starts on Monday" desc="Calendar and heatmap grids will start from Monday." on={weekStartMon} setOn={(v) => { setWeekStartMon(v); savePrefs({ weekStartMon: v }); }} />
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium text-ink">Time zone</div>
              <div className="text-xs meta mt-0.5">Habits are tracked against your local day. The auto-skip cutoff and reminder times use this zone. Leave as Auto for an approximate guess.</div>
            </div>
            <select
              value={timezone ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setTimezone(v);
                savePrefs({ timezone: v });
              }}
              className="input max-w-[220px]"
            >
              <option value="">Auto (server guess)</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section: Appearance — two themes (Black / White) */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Appearance</h2>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <div className="text-sm font-medium text-ink">Theme</div>
            <div className="text-xs meta mt-0.5">Switch between a clean white-background interface and a dark black-background interface. Saved to your profile.</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTheme("light");
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("theme", "light");
                  document.documentElement.setAttribute("data-theme", "light");
                }
                savePrefs({ theme: "light" });
              }}
              className={"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition " +
                (theme === "light"
                  ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                  : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
              aria-pressed={theme === "light"}
            >
              <Sun className="h-3.5 w-3.5" /> White
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme("dark");
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("theme", "dark");
                  document.documentElement.setAttribute("data-theme", "dark");
                }
                savePrefs({ theme: "dark" });
              }}
              className={"flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition " +
                (theme === "dark"
                  ? "bg-white text-black border-white"
                  : "bg-[var(--bg-2)] text-ink-soft border-[var(--line)] hover:border-ink")}
              aria-pressed={theme === "dark"}
            >
              <Moon className="h-3.5 w-3.5" /> Black
            </button>
          </div>
        </div>
      </section>

      {/* Section: Help & links */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-4 w-4" />
          <h2 className="text-base font-bold text-ink">Help & links</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <LinkRow href="/about" label="About sleek" />
          <LinkRow href="/faqs" label="FAQs" />
          <LinkRow href="/contact" label="Contact" />
          <LinkRow href="/terms" label="Terms & conditions" />
          <LinkRow href="/privacy" label="Privacy policy" />
          <LinkRow href="/" label="Landing page" />
        </div>
        <ContactMessages />
      </section>

      {/* Section: Advanced options (collapsed) */}
      <section className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 meta" />
            <h2 className="text-base font-bold text-ink">Advanced options</h2>
          </span>
          <ChevronDown className={"h-4 w-4 meta transition-transform " + (advancedOpen ? "rotate-180" : "")} />
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <p className="text-sm meta">
              This section contains account management tools. Proceed with caution — changes here are irreversible.
            </p>

            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> Remove account
              </button>
            ) : (
              <div className="p-4 animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                <div className="label-xs mb-2">Verify your identity</div>
                <p className="text-xs meta mb-3">
                  Type your registered email and password to confirm. This is permanent and cannot be undone.
                </p>
                <div className="space-y-2.5">
                  <input
                    type="email"
                    value={delEmail}
                    onChange={(e) => setDelEmail(e.target.value)}
                    placeholder="your-registered@email.com"
                    className="input w-full" />
                  <input
                    type="password"
                    value={delPass}
                    onChange={(e) => setDelPass(e.target.value)}
                    placeholder="your password"
                    className="input w-full" />
                  {delErr && <p className="text-sm" style={{ color: "var(--coral-500)" }}>{delErr}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={deleteAccount}
                      disabled={delBusy || !delEmail || !delPass}
                      className="btn-primary disabled:opacity-50"
                    >
                      {delBusy ? "Confirming…" : "Confirm removal"}
                    </button>
                    <button onClick={() => setShowDelete(false)} className="btn-ghost">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleRow({ label, desc, on, setOn }: { label: string; desc: string; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs meta mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className="relative h-6 w-11 transition"
        style={{
          background: on ? "var(--green-600)" : "var(--bg-2)",
          border: "1px solid var(--line)"
        }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 transition-all"
          style={{
            left: on ? "22px" : "2px",
            background: "white"
          }}
        />
      </button>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-2)] transition" style={{ border: "1px solid var(--line-soft)" }}>
      <span className="flex items-center gap-2 text-ink-soft text-sm">
        <LinkIcon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-xs meta">→</span>
    </a>
  );
}

interface ContactMsg {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  message: string;
  createdAt: string;
}

function ContactMessages() {
  const [messages, setMessages] = useState<ContactMsg[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/contact").then((r) => {
      if (r.status === 403) { setForbidden(true); return null; }
      return r.json();
    }).then((d) => {
      if (d?.messages) setMessages(d.messages);
    }).catch(() => {});
  }, []);

  if (forbidden || messages === null || messages.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span>💌</span>
        <h3 className="text-sm font-bold text-ink">Messages received</h3>
        <span className="ml-auto chip chip-green">{messages.length}</span>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="p-3" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{m.fromName}</span>
              <span className="text-[10px] meta">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs meta mt-0.5">{m.fromEmail}</div>
            <div className="text-xs font-medium text-ink mt-2">{m.subject}</div>
            <p className="text-xs ink-soft mt-1 whitespace-pre-wrap">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MAX_AVATAR_BYTES = 256 * 1024; // 256 KB

function AvatarInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    setErr("");
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setErr("PNG, JPEG, WEBP, or GIF only");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErr(`File too large (max ${MAX_AVATAR_BYTES / 1024} KB)`);
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onChange(result);
      setBusy(false);
    };
    reader.onerror = () => { setErr("Could not read file"); setBusy(false); };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-1.5 space-y-3">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[var(--bg-2)] text-[var(--ink-muted)]">
              <User className="h-6 w-6" />
            </div>
          )}
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={"flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm transition " +
            (dragOver ? "border-ink bg-[var(--bg-2)]" : "")}
          style={{ border: "1px dashed var(--line)", background: dragOver ? "var(--bg-2)" : "transparent" }}
        >
          {busy ? "Reading…" : (<><Upload className="h-4 w-4" /> Choose file or drop image</>)}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {err && <p className="text-xs" style={{ color: "var(--coral-500)" }}>{err}</p>}

      <div className="flex items-center gap-3">
        <input
          value={value.startsWith("data:image/") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="input flex-1"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setErr(""); }}
            className="btn-ghost inline-flex items-center gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
      <p className="text-xs meta">PNG/JPEG/WEBP/GIF · max {MAX_AVATAR_BYTES / 1024} KB · stored on your profile.</p>
    </div>
  );
}

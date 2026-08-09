"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, Plus, Trash2, Edit, Pause, Play, Check, X, AlertCircle, CalendarDays, Clock
} from "lucide-react";

function fm12(time: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let hour = parseInt(m[1], 10);
  const min = m[2];
  const ap = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ap}`;
}

function TimeDial({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  let h0 = 7; let m0 = "00"; let ap0 = "AM";
  if (match) {
    const h24 = parseInt(match[1], 10);
    ap0 = h24 >= 12 ? "PM" : "AM";
    let h12x = h24 % 12;
    if (h12x === 0) h12x = 12;
    h0 = h12x;
    m0 = match[2];
  }
  const [h12, setH12] = useState(h0);
  const [mins, setMins] = useState(m0);
  const [ampm, setAmpm] = useState(ap0);

  function commit(h: number, m: string, a: string) {
    let hr = h;
    if (a === "PM" && hr !== 12) hr += 12;
    if (a === "AM" && hr === 12) hr = 0;
    onChange(`${String(hr).padStart(2, "0")}:${m}`);
  }

  function close() {
    setOpen(false);
    commit(h12, mins, ampm);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const m = re.exec(value);
          if (m) {
            const h24 = parseInt(m[1], 10);
            const ap = h24 >= 12 ? "PM" : "AM";
            let hx = h24 % 12;
            if (hx === 0) hx = 12;
            setH12(hx); setMins(m[2]); setAmpm(ap);
          }
          setOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold tabular-nums rounded-xl cursor-pointer transition hover:shadow-sm"
        style={{ background: "var(--bg-2)", border: "1px solid var(--line)", minWidth: 110 }}
      >
        <Clock className="h-4 w-4" style={{ color: "var(--blue-500)" }} />
        {fm12(value)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={close}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.18)" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-[340px] rounded-[28px] p-6 animate-pop"
            style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 32px 80px rgba(0,0,0,0.22)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-[18px] font-semibold text-ink">Pick time</span>
              <button onClick={close} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--bg-2)] transition">
                <X className="h-4 w-4 text-ink-soft" />
              </button>
            </div>

            {/* Live preview */}
            <div className="text-center mb-6 py-4 rounded-2xl" style={{ background: "var(--blue-50)" }}>
              <span className="text-5xl font-bold tabular-nums text-ink tracking-tight">{String(h12).padStart(2, "0")}:{mins}</span>
              <span className="text-2xl font-semibold text-ink-soft ml-2">{ampm}</span>
            </div>

            {/* Hour column picker */}
            <div className="mb-5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2 block">Hour</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                  <button
                    key={h}
                    onClick={() => { setH12(h); commit(h, mins, ampm); }}
                    className={"py-2.5 text-sm font-bold rounded-xl transition-all duration-150 active:scale-95 "
                      + (h === h12
                        ? "bg-[var(--blue-600)] text-white shadow-md ring-1 ring-[var(--blue-300)]"
                        : "bg-[var(--bg-2)] text-ink-soft hover:bg-white hover:text-ink")}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute picker — free input + quick chips */}
            <div className="mb-5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2 block">Minute</span>
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={Number(mins)}
                  onChange={(e) => {
                    let v = parseInt(e.target.value, 10);
                    if (isNaN(v)) v = 0;
                    v = Math.max(0, Math.min(59, v));
                    const m = String(v).padStart(2, "0");
                    setMins(m);
                    commit(h12, m, ampm);
                  }}
                  className="w-20 px-3 py-2 text-base font-bold tabular-nums rounded-xl outline-none transition"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
                />
                <span className="text-sm meta shrink-0">minutes (type any 0-59, e.g. 37)</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMins(m); commit(h12, m, ampm); }}
                    className={"py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 "
                      + (mins === m
                        ? "bg-[var(--blue-600)] text-white shadow-md ring-1 ring-[var(--blue-300)]"
                        : "bg-[var(--bg-2)] text-ink-soft hover:bg-white hover:text-ink")}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* AM / PM toggle */}
            <div className="mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2 block">Period</span>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--line)" }}>
                <button
                  onClick={() => { setAmpm("AM"); commit(h12, mins, "AM"); }}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${ampm === "AM" ? "bg-[var(--blue-600)] text-white" : "bg-[var(--bg-2)] text-ink-soft hover:bg-white"}`}
                >
                  AM
                </button>
                <div style={{ width: 1, background: "var(--line)" }} />
                <button
                  onClick={() => { setAmpm("PM"); commit(h12, mins, "PM"); }}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${ampm === "PM" ? "bg-[var(--blue-600)] text-white" : "bg-[var(--bg-2)] text-ink-soft hover:bg-white"}`}
                >
                  PM
                </button>
              </div>
            </div>

            <button
              onClick={close}
              className="w-full py-3 text-sm font-semibold text-white rounded-xl transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
            >
              Done — {h12}:{mins} {ampm}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const re = /^(\d{1,2}):(\d{2})$/;

type Reminder = { id: string; label: string; time: string; message: string; enabled: boolean; createdAt: string; date?: string | null };

export function RemindersPanel({ tier, trialDaysLeft }: { tier: string; trialDaysLeft: number }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(false);
  const premium = tier !== "free" || trialDaysLeft > 0;
  const [form, setForm] = useState({ label: "", time: "11:00", message: "", date: "" });
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    const r = await fetch("/api/reminders");
    const d = await r.json();
    setReminders(d.reminders || []);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function add() {
    setErr("");
    if (!premium) { setErr("Reminders are a premium feature."); return; }
    if (!form.label.trim()) return;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.time)) { setErr("Invalid time."); return; }
    setBusy(true);
    const r = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: form.label.trim(), time: form.time, message: form.message.slice(0, 2000), date: form.date || undefined }),
    });
    setBusy(false);
    if (r.ok) { setForm({ label: "", time: "11:00", message: "", date: "" }); load(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || "Could not add"); }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled: !enabled }) });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  async function saveEdit(id: string, label: string, time: string, message: string) {
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, label: label.slice(0, 120), time, message: message.slice(0, 2000) }) });
    load();
  }

  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const active = reminders.filter((r) => r.enabled);
  const paused = reminders.filter((r) => !r.enabled);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(160deg, var(--bg) 0%, var(--bg) 60%, var(--blue-50, #eff6ff) 100%)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-30" style={{ background: "radial-gradient(circle, var(--blue-100) 0%, transparent 70%)" }} />
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl shrink-0" style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)" }}>
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Reminders</h2>
              <p className="text-[11px] meta">Scheduled alerts delivered via email</p>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2 flex-wrap items-start">
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Reminder title" className="input flex-1 text-sm min-w-[160px]" disabled={!premium} />
            <TimeDial value={form.time} onChange={(v: string) => setForm((f) => ({ ...f, time: v }))} />
            <button onClick={add} disabled={busy || !premium} className="btn-blue !py-2 !px-3 !rounded-xl text-sm">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--blue-500)" }} />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} min={today} className="input text-xs py-1.5" style={{ maxWidth: 160 }} disabled={!premium} />
            {form.date && <button onClick={() => setForm({ ...form, date: "" })} className="text-[10px] text-ink-soft hover:text-ink underline" type="button">Clear date</button>}
            <span className="text-[10px] meta ml-auto">Optional — leave blank to recur daily</span>
          </div>
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message to send (optional)" rows={2} maxLength={2000} disabled={!premium} className="input w-full resize-y text-sm" style={{ minHeight: 48 }} />
          {err && <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--coral-500)" }}><AlertCircle className="h-3.5 w-3.5" /> {err}</div>}
          {!premium && (
            <div className="p-2.5 rounded-xl text-xs" style={{ background: "var(--blue-50)", border: "1px solid var(--blue-200)", color: "var(--blue-700)" }}>
              Upgrade to Pro to create reminders. Free 2-day trial included.
            </div>
          )}
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--green-500)", boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--green-600)" }}>Active ({active.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {active.map((r, idx) => (
              <div key={r.id} className="animate-fade-up" style={{ animationDelay: `${idx * 70}ms` }}>
                <ReminderCard r={r} expanded={expanded.has(r.id)} onToggleExpand={() => toggleExpand(r.id)} onToggle={(id, en) => toggle(id, en)} onPause={(id) => toggle(id, false)} onDelete={remove} onSaveEdit={saveEdit} />
              </div>
            ))}
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full" style={{ background: "var(--ink-muted)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Paused ({paused.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {paused.map((r, idx) => (
              <div key={r.id} className="animate-fade-up" style={{ animationDelay: `${idx * 70}ms` }}>
                <ReminderCard r={r} expanded={expanded.has(r.id)} onToggleExpand={() => toggleExpand(r.id)} onToggle={(r, e) => toggle(r, e)} onPause={() => toggle(r.id, false)} onDelete={(id) => remove(id)} onSaveEdit={saveEdit} />
              </div>
            ))}
          </div>
        </div>
      )}

      {reminders.length === 0 && (
        <div className="py-10 text-center rounded-2xl animate-pop" style={{ background: "linear-gradient(160deg, var(--bg) 0%, var(--bg-2) 100%)", border: "1px solid var(--line)" }}>
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full animate-float" style={{ background: "linear-gradient(135deg, var(--blue-50), var(--cyan-50, #ecfeff))" }}>
            <Bell className="h-7 w-7" style={{ color: "var(--blue-500)" }} />
          </div>
          <p className="text-sm font-semibold text-ink-muted">No reminders yet</p>
          <p className="text-xs meta mt-1">Create your first reminder above.</p>
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  r, expanded, onToggleExpand, onToggle, onPause, onDelete, onSaveEdit,
}: {
  r: Reminder; expanded: boolean; onToggleExpand: () => void;
  onToggle: (id: string, enabled: boolean) => void; onPause: (id: string) => void;
  onDelete: (id: string) => void; onSaveEdit: (id: string, label: string, time: string, message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(r.label);
  const [editTime, setEditTime] = useState(r.time);
  const [editMessage, setEditMessage] = useState(r.message);

  const dead = !r.enabled;

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 card-tilt" style={{ background: dead ? "var(--bg-2)" : "var(--bg)", border: `1px solid ${dead ? "var(--line-soft)" : "var(--line)"}`, opacity: dead ? 0.6 : 1 }}>
      {!editing ? (
        <>
          <div role="button" tabIndex={0} onClick={onToggleExpand} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onToggleExpand(); } }} className="w-full text-left px-4 pt-3.5 pb-3 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="grid h-10 w-10 place-items-center rounded-xl shrink-0 mt-0.5" style={{ background: dead ? "var(--bg)" : "var(--blue-50)" }}>
                  <Clock className="h-4 w-4" style={{ color: dead ? "var(--ink-muted)" : "var(--blue-500)" }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink leading-snug truncate">{r.label}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--ink-soft)" }}>{fm12(r.time)}</span>
                    {r.date && (
                      <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-bold" style={{ background: "var(--green-100)", color: "var(--green-700)", border: "1px solid var(--green-200)" }}>
                        {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  {r.message && <div className="text-[11px] mt-1.5 text-ink-muted leading-relaxed line-clamp-2 whitespace-pre-line">{r.message}</div>}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onToggle(r.id, r.enabled); }} className="relative h-6 w-10 shrink-0 rounded-full transition-all duration-300" style={{ background: r.enabled ? "var(--green-500)" : "var(--line-soft)", border: "1px solid var(--line)", boxShadow: r.enabled ? "0 0 12px rgba(16, 185, 129, 0.35)" : "none" }} title={r.enabled ? "Pause" : "Resume"}>
                <span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all" style={{ left: r.enabled ? "20px" : "2px" }} />
              </button>
            </div>
          </div>
          {expanded && (
            <div className="px-4 pb-3 flex items-center gap-1.5 border-t pt-2.5" style={{ borderColor: "var(--line-soft)" }}>
              <button onClick={() => { setEditLabel(r.label); setEditTime(r.time); setEditMessage(r.message); setEditing(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:text-ink rounded-xl hover:bg-[var(--bg-2)] transition"><Edit className="h-3 w-3" />Edit</button>
              <button onClick={() => onPause(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:text-[var(--yellow-600)] rounded-xl hover:bg-[var(--bg-2)] transition" title={r.enabled ? "Pause" : "Resume"}>
                {r.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{r.enabled ? "Pause" : "Resume"}
              </button>
              <button onClick={() => onDelete(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-soft hover:text-[var(--coral-500)] rounded-xl hover:bg-[var(--coral-50)] transition ml-auto"><Trash2 className="h-3 w-3" />Delete</button>
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Label" className="input w-full text-sm" />
          <div className="flex gap-2 items-center">
            <TimeDial value={editTime} onChange={(v: string) => setEditTime(v)} />
          </div>
          <textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={2} className="input w-full resize-none text-sm" placeholder="Email body" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="btn-ghost !py-1.5 !px-3 text-xs"><X className="h-3 w-3 mr-1" />Cancel</button>
            <button onClick={() => { onSaveEdit(r.id, editLabel, editTime, editMessage); setEditing(false); }} disabled={!editLabel.trim()} className="btn-green !py-1.5 !px-3 text-xs"><Check className="h-3 w-3 mr-1" />Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
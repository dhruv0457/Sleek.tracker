"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Lock, Mic, MicOff, Brain, ChevronDown, Save, Download, Settings2, Sparkles, Heart, Zap, Microscope, X } from "lucide-react";

interface Message {
  role: "user" | "model";
  content: string;
  streaming?: boolean;
}

type ModelId = "nim-fast" | "nim-reason" | "nim-creative" | "nim-balanced";
type PersonaId = "data" | "motivational" | "toughlove" | "scientific";
type ToneId = "concise" | "detailed" | "motivational";

const MODELS: { id: ModelId; label: string; sub: string; emoji: string }[] = [
  { id: "nim-balanced",  label: "Balanced",   sub: "ChatGPT-style all-rounder", emoji: "⚖️" },
  { id: "nim-reason",    label: "Reasoning",  sub: "Claude-style deep analysis",  emoji: "🧠" },
  { id: "nim-creative",  label: "Creative",   sub: "Gemini-style imaginative",    emoji: "✨" },
  { id: "nim-fast",      label: "Fast",       sub: "Quick answers, low latency",  emoji: "⚡" },
];

const PERSONAS: { id: PersonaId; label: string; sub: string; icon: typeof Brain }[] = [
  { id: "data",        label: "Data Coach",        sub: "Evidence + numbers first",     icon: Brain },
  { id: "motivational",label: "Motivational Coach",sub: "Uplifting, encouraging",       icon: Heart },
  { id: "toughlove",   label: "Tough Love Coach",  sub: "Direct, no excuses",           icon: Zap },
  { id: "scientific",  label: "Scientific Method", sub: "Behavioral-science backed",   icon: Microscope },
];

const TONES: { id: ToneId; label: string }[] = [
  { id: "concise",      label: "Concise" },
  { id: "detailed",      label: "Detailed" },
  { id: "motivational",  label: "Motivational" },
];

export function AIInsightsPanel({ tier, trialDaysLeft }: { tier: string; trialDaysLeft: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(tier === "free" && trialDaysLeft <= 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  // New controls
  const [model, setModel] = useState<ModelId>("nim-balanced");
  const [persona, setPersona] = useState<PersonaId>("data");
  const [tone, setTone] = useState<ToneId>("concise");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/insights/chat")
      .then((r) => r.json())
      .then((d) => {
        setMessages((d.messages || []).map((m: any) => ({
          role: m.role, content: m.content, streaming: false
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e: any) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  function toggleMic() {
    const rec = recRef.current; if (!rec) return;
    if (listening) { rec.stop(); setListening(false); } else { try { rec.start(); setListening(true); } catch { setListening(false); } }
  }

  async function send() {
    if (!input.trim() || busy || blocked) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setInput(""); setBusy(true);

    setMessages((m) => [...m, { role: "model", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/insights/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, model, persona, tone }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages((p) => { const c = [...p]; c[c.length - 1] = { role: "model", content: j.error || "AI unavailable", streaming: false }; return c; });
        if (res.status === 403) setBlocked(true);
        setBusy(false); return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setBusy(false); return; }

      const decoder = new TextDecoder();
      let buf = "", full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith("data: ")) continue;
          const json = t.slice(6);
          if (json === "[DONE]") continue;
          try {
            const p = JSON.parse(json);
            if (p.error) full = p.error;
            else if (p.token) full += p.token;
            setMessages((m) => {
              const c = [...m]; const last = c[c.length - 1];
              if (last && last.streaming) {
                c[c.length - 1] = { ...last, content: full };
              }
              return c;
            });
          } catch {}
        }
      }

      setMessages((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.streaming) c[c.length - 1] = { ...last, streaming: false }; return c; });
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "model", content: "Could not reach AI service.", streaming: false }; return c; });
    }
    setBusy(false);
  }

  function exportConversation() {
    if (messages.length === 0) return;
    const txt = messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}\n`).join("\n---\n\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ai-coach-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveConversation() {
    if (messages.length === 0) return;
    try {
      const payload = JSON.stringify({ model, persona, tone, messages, savedAt: new Date().toISOString() }, null, 2);
      window.localStorage.setItem("habittrack_ai_saved_chat", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  }
  const [saved, setSaved] = useState(false);

  function clearConversation() {
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    setMessages([]);
  }

  const EXAMPLES = [
    "What are my biggest weaknesses every Sunday this month?",
    "What is my work pattern like on Saturdays?",
    "Which habits am I most consistent with?",
    "Where am I multitasking too much?",
  ];

  const activeModel = MODELS.find((m) => m.id === model)!;
  const activePersona = PERSONAS.find((p) => p.id === persona)!;

  return (
    <div className="flex flex-col h-full animate-fade-up" style={{ minHeight: "calc(100vh - 96px)" }}>
      <div className="flex flex-col flex-1 p-5 rounded-2xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)" }}>
            <Brain className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-ink">AI Coach</h2>
          {tier === "free" && trialDaysLeft > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--yellow-100)", color: "var(--yellow-700)" }}>Trial · {trialDaysLeft}d left</span>
          )}
          {blocked && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1" style={{ background: "var(--coral-100)", color: "var(--coral-600)" }}>
              <Lock className="h-3 w-3" /> Premium
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={saveConversation} title="Save conversation"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition disabled:opacity-40"
              disabled={messages.length === 0}>
              <Save className="h-3.5 w-3.5" />
            </button>
            <button onClick={exportConversation} title="Export as text"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition disabled:opacity-40"
              disabled={messages.length === 0}>
              <Download className="h-3.5 w-3.5" />
            </button>
            <button onClick={clearConversation} title="Clear conversation"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition disabled:opacity-40"
              disabled={messages.length === 0}>
              <X className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setShowSettings((s) => !s)} title="Coach settings"
              className={"grid h-8 w-8 place-items-center rounded-full transition " + (showSettings ? "bg-[var(--blue-50)] text-[var(--blue-600)]" : "hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink")}>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-2 text-[11px] flex items-center gap-1.5 px-2 py-1.5 rounded-xl w-fit" style={{ background: "var(--green-50)", color: "var(--green-700)" }}>
            <Sparkles className="h-3 w-3" /> Saved to this browser
          </div>
        )}

        {/* Collapsible settings bar */}
        {showSettings && !blocked && (
          <div className="mb-3 p-3 rounded-xl animate-fade-up" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Model picker */}
              <div>
                <div className="label-xs mb-1.5">Model</div>
                <Dropdown
                  value={model}
                  onChange={(v) => setModel(v as ModelId)}
                  options={MODELS.map((m) => ({ value: m.id, label: `${m.emoji} ${m.label}`, sub: m.sub }))}
                />
              </div>
              {/* Persona picker */}
              <div>
                <div className="label-xs mb-1.5">Coach persona</div>
                <Dropdown
                  value={persona}
                  onChange={(v) => setPersona(v as PersonaId)}
                  options={PERSONAS.map((p) => ({ value: p.id, label: p.label, sub: p.sub }))}
                />
              </div>
              {/* Tone picker */}
              <div>
                <div className="label-xs mb-1.5">Tone</div>
                <Dropdown
                  value={tone}
                  onChange={(v) => setTone(v as ToneId)}
                  options={TONES.map((t) => ({ value: t.id, label: t.label, sub: undefined }))}
                />
              </div>
            </div>
            <div className="mt-2 text-[11px] meta flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Active: <span className="font-semibold text-ink">{activeModel.label}</span> · <span className="font-semibold text-ink">{activePersona.label}</span> · <span className="font-semibold text-ink capitalize">{tone}</span>
            </div>
          </div>
        )}

        <p className="text-xs meta mb-3 shrink-0">
          Ask anything about your habits, data, and patterns.
        </p>

        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-4" style={{ scrollbarWidth: "thin", minHeight: 200 }}>
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-2 text-center py-10">
              <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--blue-50)" }}>
                <Brain className="h-5 w-5" style={{ color: "var(--blue-600)" }} />
              </div>
              <p className="text-sm font-medium text-ink">Ask me anything about your habits</p>
              <p className="text-xs meta max-w-xs">Get data-driven insights about your routines.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
              <div className="max-w-[80%]">
                {m.role === "user" ? (
                  <div className="px-3.5 py-2.5 text-sm bg-ink text-white rounded-2xl rounded-br-md leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 text-sm rounded-2xl rounded-bl-md leading-relaxed shadow-sm" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                    {m.streaming ? (
                      <span className="whitespace-pre-wrap">
                        <StreamingText text={m.content || ""} speed={12} />
                        <span className="inline-block w-1.5 h-4 bg-ink/20 animate-pulse ml-0.5 align-middle rounded-sm" />
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content || ""}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 text-sm rounded-2xl rounded-bl-md flex items-center gap-2" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                <span className="flex gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                <span className="text-ink-muted">Analyzing your data...</span>
              </div>
            </div>
          )}
        </div>

        {!blocked && (
          <div className="mt-3 flex flex-wrap gap-1.5 shrink-0">
            {EXAMPLES.map((e, i) => (
              <button
                key={i}
                onClick={() => setInput(e)}
                disabled={busy}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:scale-[1.02]"
                style={{ background: "var(--bg-2)", color: "var(--ink-soft)", border: "1px solid var(--line)", cursor: busy ? "default" : "pointer" }}
              >{e}</button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2 items-end shrink-0">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={blocked ? "Upgrade to ask AI questions" : listening ? "Listening..." : "Ask about your habits"}
            disabled={blocked}
            rows={1}
            className="input flex-1 resize-none rounded-2xl"
            style={{ minHeight: 46, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={toggleMic}
            disabled={blocked}
            title={listening ? "Stop" : "Speak"}
            className="grid h-[46px] w-[46px] place-items-center shrink-0 rounded-2xl transition hover:scale-105"
            style={{
              background: listening ? "#ef4444" : "var(--bg-2)",
              color: listening ? "white" : "var(--ink-soft)",
              border: `1px solid ${listening ? "#ef4444" : "var(--line)"}`
            }}
          >
            {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
          </button>
          <button type="submit" disabled={busy || blocked} className="btn-green h-[46px] w-[46px] grid place-items-center shrink-0 rounded-2xl">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Dropdown({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink truncate">{current.label}</span>
          {current.sub && <span className="block text-[10px] meta truncate">{current.sub}</span>}
        </span>
        <ChevronDown className={"h-3.5 w-3.5 shrink-0 text-ink-soft transition " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-lg animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={"w-full text-left px-3 py-2 transition flex items-start gap-2 " + (on ? "bg-[var(--blue-50)]" : "hover:bg-[var(--bg-2)]")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink truncate">{o.label}</span>
                  {o.sub && <span className="block text-[10px] meta truncate">{o.sub}</span>}
                </span>
                {on && <span className="text-[var(--blue-600)] text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StreamingText({ text, speed = 12 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  const prevRef = useRef("");
  const idxRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (text !== prevRef.current) {
      prevRef.current = text;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      let last = 0;
      function step(ts: number) {
        if (ts - last > speed) {
          last = ts;
          if (idxRef.current < text.length) idxRef.current++;
          setShown(text.slice(0, idxRef.current));
        }
        if (idxRef.current < text.length) rafRef.current = requestAnimationFrame(step);
        else setShown(text);
      }
      rafRef.current = requestAnimationFrame(step);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return <span className="whitespace-pre-wrap">{shown}</span>;
}

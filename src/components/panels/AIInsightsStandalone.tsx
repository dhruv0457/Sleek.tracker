"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Shield, Settings2, Loader, Plus, Trash2, X, Square, Key, Copy, Check as CheckIcon, MessageSquare } from "lucide-react";
import Link from "next/link";

const EXAMPLE_PROMPTS = [
  "Which habits am I most consistent with?",
  "What are my biggest weak points this month?",
  "Where am I multitasking too much?",
  "Suggest one small change I can make tomorrow.",
];

type ModelId = "nim-fast" | "nim-balanced";
type ToneId = "concise" | "detailed";

const MODELS: { id: ModelId; label: string; hint: string }[] = [
  { id: "nim-balanced", label: "Thoughtful", hint: "Deeper reasoning" },
  { id: "nim-fast", label: "Fast", hint: "Quick replies" },
];
const TONES: { id: ToneId; label: string }[] = [
  { id: "concise", label: "Concise" },
  { id: "detailed", label: "Detailed" },
];

interface Message {
  role: "user" | "model";
  content: string;
  streaming?: boolean;
}
interface ChatRecord {
  id: string;
  title: string;
  messages: Message[];
  model: ModelId;
  tone: ToneId;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function loadChats(): ChatRecord[] {
  try { const r = localStorage.getItem("habittrack_ai_chats"); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveChats(chats: ChatRecord[]) {
  try { localStorage.setItem("habittrack_ai_chats", JSON.stringify(chats)); } catch {}
}

export function AIInsightsStandalone({ embedded = false }: { embedded?: boolean } = {}) {
  const [chats, setChats] = useState<ChatRecord[]>(() => loadChats());
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = loadChats();
    if (stored.length > 0 && !activeId) setActiveId(stored[0].id);
    if (typeof window !== "undefined" && window.innerWidth < 900) setSidebarOpen(false);
  }, []);
  useEffect(() => { saveChats(chats); }, [chats]);

  const active = chats.find((c) => c.id === activeId);
  const messages = active?.messages || [];
  const model = active?.model || "nim-balanced";
  const tone = active?.tone || "concise";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
  }, [input]);

  function newChat() {
    const c: ChatRecord = { id: genId(), title: "New chat", messages: [], model: "nim-balanced", tone: "concise" };
    setChats((p) => [c, ...p]);
    setActiveId(c.id);
    if (typeof window !== "undefined" && window.innerWidth < 900) setSidebarOpen(false);
  }

  function removeChat(id: string) {
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    if (activeId === id) setActiveId(next[0]?.id || "");
  }

  function upsertChat(id: string, patch: Partial<ChatRecord>) {
    setChats((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function appendMessages(id: string, msgs: Message[]) {
    setChats((p) => p.map((c) => {
      if (c.id !== id) return c;
      const next = [...c.messages, ...msgs];
      let title = c.title;
      if (c.title === "New chat" && next.some((m) => m.role === "user")) {
        const first = next.find((m) => m.role === "user");
        title = first ? first.content.slice(0, 38) : "New chat";
      }
      return { ...c, title, messages: next };
    }));
  }

  function updateLast(id: string, content: string) {
    setChats((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const m = [...c.messages]; const last = m[m.length - 1];
      if (last && last.streaming) m[m.length - 1] = { ...last, content };
      return { ...c, messages: m };
    }));
  }
  function finalizeLast(id: string) {
    setChats((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const m = [...c.messages]; const last = m[m.length - 1];
      if (last && last.streaming) m[m.length - 1] = { ...last, streaming: false };
      return { ...c, messages: m };
    }));
  }

  function stop() {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    setBusy(false);
    if (activeId) finalizeLast(activeId);
  }

  async function send() {
    if (!input.trim() || busy || blocked || !activeId) return;
    const msg = input.trim();
    appendMessages(activeId, [{ role: "user", content: msg }, { role: "model", content: "", streaming: true }]);
    setInput(""); setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/insights/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, model, persona: "data", tone }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "AI unavailable" }));
        updateLast(activeId, j.error || "Could not connect.");
        if (res.status === 403) setBlocked(true);
        finalizeLast(activeId);
        setBusy(false); return;
      }
      const reader = res.body?.getReader();
      if (!reader) { setBusy(false); return; }
      const decoder = new TextDecoder();
      let buf = "", full = "";
      const aid = activeId;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim(); if (!t || !t.startsWith("data: ")) continue;
          const j = t.slice(6); if (j === "[DONE]") continue;
          try {
            const p = JSON.parse(j);
            if (p.error) full = p.error; else if (p.token) full += p.token;
            updateLast(aid, full);
          } catch {}
        }
      }
      finalizeLast(aid);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      updateLast(activeId, "Could not reach AI service.");
      finalizeLast(activeId);
    }
    abortRef.current = null;
    setBusy(false);
  }

  function copyMessage(content: string, idx: number) {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className={embedded ? "h-full flex overflow-hidden" : "h-screen flex overflow-hidden"} style={{ background: "var(--bg)" }}>
      {/* Blocked banner */}
      {blocked && (
        <div className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center gap-2 animate-fade-up" style={{ background: "var(--coral-50)", borderBottom: "1px solid var(--coral-200)" }}>
          <Shield className="h-4 w-4 shrink-0" style={{ color: "var(--coral-500)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--coral-700)" }}>AI Insights needs Ultra Pro.</span>
          <Link href="/pricing" className="ml-auto btn-green !py-1.5 !px-3 !text-[12px] shrink-0">Upgrade</Link>
          <button onClick={() => setBlocked(false)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-white/60"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ─── Left sidebar — chat history ─── */}
      <aside className={"shrink-0 h-full border-r flex flex-col transition-all duration-300 overflow-hidden " + (sidebarOpen ? "w-[260px]" : "w-0")}
        style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="p-3 flex items-center gap-2 shrink-0">
          <button onClick={newChat} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 14px rgba(16,185,129,.25)" }}>
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
          <button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-xl text-ink-muted hover:text-ink hover:bg-white transition" title="Hide">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {chats.length === 0 ? (
            <div className="text-[11px] meta text-center py-10 px-3 leading-relaxed">
              <MessageSquare className="h-5 w-5 mx-auto mb-2 opacity-30" />
              No conversations yet.<br />Start chatting with your AI coach.
            </div>
          ) : (
            chats.map((c) => (
              <div key={c.id} onClick={() => { setActiveId(c.id); if (typeof window !== "undefined" && window.innerWidth < 900) setSidebarOpen(false); }}
                className={"group relative px-3 py-2.5 rounded-xl cursor-pointer transition-all border " + (c.id === activeId ? "border-transparent" : "border-transparent hover:bg-white")}
                style={c.id === activeId ? { background: "var(--green-50)", borderLeft: "3px solid var(--green-500)" } : {}}>
                <div className="flex items-center justify-between gap-1.5">
                  <span className={"text-[12px] font-medium truncate " + (c.id === activeId ? "text-ink" : "text-ink-soft")}>{c.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeChat(c.id); }}
                    className="shrink-0 grid h-6 w-6 place-items-center rounded-lg opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 hover:bg-red-50 transition">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>{MODELS.find((m) => m.id === c.model)?.label || "Balanced"}</span>
                  <span className="text-[9px]" style={{ color: "var(--ink-faint)" }}>·</span>
                  <span className="text-[9px] capitalize" style={{ color: "var(--ink-muted)" }}>{c.tone}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: "var(--line)" }}>
          <Link href="/privacy" className="text-[10px] meta flex items-center gap-1.5 hover:text-ink transition" style={{ color: "var(--ink-muted)" }}>
            <Shield className="h-3 w-3" /> Encrypted & private
          </Link>
        </div>
      </aside>

      {/* ─── Main chat column ─── */}
      <div className="flex-1 h-full flex flex-col min-w-0 relative">
        {/* Gradient backdrop */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at top right, rgba(59,130,246,.05), transparent 50%), radial-gradient(ellipse at bottom left, rgba(16,185,129,.04), transparent 50%)",
        }} />

        {/* Top bar */}
        <div className="relative shrink-0 px-4 sm:px-6 py-3 border-b flex items-center gap-2.5" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="grid h-8 w-8 place-items-center rounded-xl border text-ink-soft hover:text-ink hover:bg-white transition shrink-0" style={{ borderColor: "var(--line-soft)" }}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="grid h-9 w-9 place-items-center rounded-xl shrink-0" style={{ background: "linear-gradient(135deg, var(--blue-50), #ecfeff)" }}>
            <Sparkles className="h-4 w-4" style={{ color: "var(--blue-600)" }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink leading-tight">AI Coach</div>
            <div className="text-[10px] meta leading-tight">{MODELS.find((m) => m.id === model)?.label} · {tone} · NVIDIA NIM</div>
          </div>

          {/* Model selector */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => upsertChat(activeId!, { model: m.id })} title={m.hint}
                className={"text-[10px] font-semibold px-2 py-1 rounded-lg transition border " + (model === m.id ? "text-white border-transparent" : "hover:border-ink")}
                style={model === m.id ? { background: "var(--ink)", borderColor: "var(--ink)" } : { borderColor: "var(--line-soft)", color: "var(--ink-soft)" }}>
                {m.label}
              </button>
            ))}
            <span className="w-px h-4 mx-0.5" style={{ background: "var(--line)" }} />
            {TONES.map((t) => (
              <button key={t.id} onClick={() => upsertChat(activeId!, { tone: t.id })}
                className={"text-[10px] font-semibold px-2 py-1 rounded-lg transition border " + (tone === t.id ? "text-white border-ink" : "hover:border-ink")}
                style={tone === t.id ? { background: "var(--ink)", borderColor: "var(--ink)" } : { borderColor: "var(--line-soft)", color: "var(--ink-soft)" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <div className="relative flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            <div ref={scrollRef} className="space-y-4 pb-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 gap-3 animate-fade-up">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl mb-1" style={{ background: "linear-gradient(135deg, var(--blue-50), #ecfeff)" }}>
                    <Sparkles className="h-8 w-8" style={{ color: "var(--blue-600)" }} />
                  </div>
                  <h2 className="text-lg font-bold text-ink">Your AI Coach</h2>
                  <p className="text-xs meta max-w-sm">Powered by NVIDIA NIM. Ask about your habits, streaks, or patterns.</p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mt-2">
                    {EXAMPLE_PROMPTS.map((ex, i) => (
                      <button key={i} onClick={() => { setInput(ex); taRef.current?.focus(); }}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition hover:text-ink"
                        style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex group ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`} style={{ animationDelay: `${Math.min(i * 40, 150)}ms` }}>
                    <div className="max-w-[82%]">
                      {m.role === "user" ? (
                        <div className="relative">
                          <div className="px-4 py-2.5 text-sm text-white rounded-2xl rounded-br-md leading-relaxed whitespace-pre-wrap"
                            style={{ background: "var(--ink)", boxShadow: "0 2px 10px rgba(0,0,0,.15)" }}>
                            {m.content}
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="px-4 py-3 text-sm rounded-2xl rounded-bl-md leading-relaxed whitespace-pre-wrap"
                            style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
                            {m.streaming && !m.content ? (
                              <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-ink/25 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="h-2 w-2 rounded-full bg-ink/25 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="h-2 w-2 rounded-full bg-ink/25 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            ) : m.streaming ? (
                              <span>
                                <span className="whitespace-pre-wrap">{m.content}</span>
                                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm" style={{ background: "var(--green-500)", animation: "caretBlink 1s steps(1) infinite" }} />
                              </span>
                            ) : (
                              <span>
                                <span className="whitespace-pre-wrap">{m.content}</span>
                              </span>
                            )}
                          </div>
                          {!m.streaming && m.content && (
                            <button onClick={() => copyMessage(m.content, i)}
                              className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 grid h-6 w-6 place-items-center rounded-lg text-ink-muted hover:text-ink hover:bg-white transition"
                              title="Copy">
                              {copiedId === i ? <CheckIcon className="h-3 w-3" style={{ color: "var(--green-500)" }} /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="relative shrink-0 border-t" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          <form onSubmit={(e) => { e.preventDefault(); send(); }}
            className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-2.5">
            <div className="flex-1 flex items-end gap-2.5 rounded-2xl px-3 py-2 transition"
              style={{ border: "1px solid var(--line)", background: "var(--bg-2)", boxShadow: busy ? "0 0 0 3px rgba(16,185,129,0.1)" : "none" }}>
              <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask your coach anything…" rows={1}
                readOnly={busy} disabled={blocked}
                className="flex-1 bg-transparent resize-none text-sm outline-none w-full"
                style={{ minHeight: 24, maxHeight: 120, color: "var(--ink)", opacity: busy && !blocked ? 0.6 : 1, cursor: busy ? "not-allowed" : "text" }} />
            </div>
            {busy ? (
              <button type="button" onClick={stop}
                className="h-[44px] w-[44px] grid place-items-center shrink-0 rounded-xl transition animate-pop"
                style={{ background: "var(--coral-500)" }} title="Stop">
                <Square className="h-4 w-4 text-white" fill="white" />
              </button>
            ) : (
              <button type="submit" disabled={blocked || !input.trim() || !activeId}
                className="h-[44px] w-[44px] grid place-items-center shrink-0 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--green-500)", boxShadow: input.trim() && !blocked ? "0 4px 14px rgba(16,185,129,.4)" : "none", cursor: blocked || !input.trim() || !activeId ? "not-allowed" : "pointer" }}>
                <Send className="h-4 w-4 text-white" />
              </button>
            )}
          </form>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-1.5 justify-center">
            <Shield className="h-3 w-3" style={{ color: "var(--ink-muted)" }} />
            <span className="text-[10px] meta">Encrypted · never shared</span>
            <Link href="/privacy" className="text-[10px] underline hover:text-ink ml-1" style={{ color: "var(--ink-muted)" }}>Privacy</Link>
            <span className="text-[10px] meta">·</span>
            <Link href="/terms" className="text-[10px] underline hover:text-ink" style={{ color: "var(--ink-muted)" }}>Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
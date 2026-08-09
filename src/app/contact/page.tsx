"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Check, Lock } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";

export default function ContactPage() {
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSending(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromName, fromEmail, subject, message })
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setFromName(""); setFromEmail(""); setSubject(""); setMessage("");
    } else {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error || "Could not send. Try again later.");
    }
  }

  return (
    <div className="min-h-screen hero-bg">
      <header className="glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} idPrefix="contact" />
            <span className="font-bold lowercase"><span className="aurora-text">sleek</span></span>
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-16">
        <div className="label-xs">Contact</div>
        <h1 className="text-4xl font-extrabold text-ink mt-1 mb-3">Say hi 👋</h1>
        <p className="text-base ink-soft mb-8">
          Questions, feedback, feature ideas — I'd love to hear from you. Send a message below and I'll
          get back to you privately. Your email is never shown publicly.
        </p>

        {sent ? (
          <div className="card text-center py-12 animate-pop">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700 animate-float">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-ink">Message sent</h2>
            <p className="text-sm meta mt-1">Thanks for reaching out! I'll reply privately within 1-3 days.</p>
            <button
              onClick={() => setSent(false)}
              className="btn-ghost mt-6"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="label-xs">Your name</span>
                <input
                  required value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your name" className="input w-full mt-1.5" />
              </label>
              <label className="block">
                <span className="label-xs">Your email</span>
                <input
                  required type="email" value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@email.com" className="input w-full mt-1.5" />
              </label>
            </div>
            <label className="block">
              <span className="label-xs">Subject</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?" className="input w-full mt-1.5" />
            </label>
            <label className="block">
              <span className="label-xs">Message</span>
              <textarea
                required rows={5} value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message…" className="input w-full mt-1.5 resize-none" />
            </label>

            {err && <p className="text-sm text-coral-500">{err}</p>}

            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? "Sending…" : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="h-4 w-4" /> Send message
                </span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs meta">
          <Lock className="h-3 w-3" /> Your message is private and goes directly to the maker.
        </div>

        {/* Feedback from early users */}
        <div className="mt-12">
          <div className="label-xs text-center mb-5">What early users say</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { name: "Neetish",   color: "#22a558", quote: "Finally a tracker that doesn't shame me. The deep-work mode is gold." },
              { name: "Bhavishya", color: "#f5b812", quote: "The cleanest UI I've used. The AI coach gets my Sundays perfectly." },
              { name: "Rachit",    color: "#3b82f6", quote: "Streaks, badges, focus — it all clicks. Feels like a game I want to win." },
            ].map((t) => (
              <div key={t.name} className="card !p-4 animate-fade-up">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-8 w-8 rounded-full grid place-items-center text-white text-xs font-bold" style={{ background: t.color }}>{t.name[0]}</span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{t.name}</div>
                    <div className="text-[10px] meta">early user</div>
                  </div>
                </div>
                <p className="text-sm ink-soft leading-relaxed">"{t.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

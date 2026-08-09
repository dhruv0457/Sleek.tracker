"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2, Download, Calendar, Star } from "lucide-react";
import { BadgeLU, badgeMonogram, type BadgeTier } from "@/components/badges/BadgeLU";

interface BadgeDetail {
  id: string;
  label: string;
  tier: BadgeTier;
  level: number;
  description: string;
  line?: string | null;
  earned: boolean;
  unlockedAt?: string;
  badgeThreshold?: number;
  color: string;
  nodeSize: number;
}

interface ShareTarget {
  name: string;
  url: (label: string, desc: string) => string;
  color: string;
  icon: string;
}

const SHARE_CHANNELS: ShareTarget[] = [
  { name: "WhatsApp", url: (l, d) => `https://wa.me/?text=${encodeURIComponent(`🏆 I just unlocked the "${l}" badge on sleek! ${d}`)}`, color: "#25D366", icon: "💬" },
  { name: "X", url: (l, d) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just unlocked the "${l}" badge on sleek! ${d}`)}`, color: "#1DA1F2", icon: "𝕏" },
  { name: "Telegram", url: (l, d) => `https://t.me/share/url?url=https://sleek.app&text=${encodeURIComponent(`🏆 Unlocked "${l}" on sleek — ${d}`)}`, color: "#0088cc", icon: "✈️" },
];

export function BadgeDetailModal({
  badge,
  onClose
}: {
  badge: BadgeDetail | null;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!badge || !badge.earned) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled || !cardRef.current) return;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: "#fffdf2",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        if (!cancelled) setImgDataUrl(canvas.toDataURL("image/png"));
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [badge]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  function copyBadgeLink() {
    const text = badge
      ? `🏆 "${badge.label}" — ${badge.tier} badge on sleek. ${badge.description}`
      : "";
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  }

  function downloadPng() {
    if (!imgDataUrl) return;
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = `sleek-badge-${badge?.label || "unlocked"}.png`;
    a.click();
  }

  if (!badge) return null;

  const mono = badgeMonogram(badge.label);
  const tierLabel = badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1);
  const unlockedDate = badge.unlockedAt
    ? new Date(badge.unlockedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-up" onClick={onClose}>
      <div className="panel w-full max-w-md animate-pop" onClick={(e) => e.stopPropagation()}>
        {/* Off-screen render target for PNG download */}
        <div className="absolute -left-[9999px] top-0" aria-hidden="true">
          <div
            ref={cardRef}
            style={{
              width: 480,
              padding: 40,
              background: "linear-gradient(135deg, #fffdf2 0%, #fff8e1 60%, #fef3c7 100%)",
              borderRadius: 28,
              boxShadow: "0 24px 64px rgba(245,184,18,.3)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: 140,
                height: 140,
                background: `linear-gradient(135deg, ${
                  badge.tier === "gold" ? "#fef3c7, #fcd34d, #f59e0b" :
                  badge.tier === "silver" ? "#f1f5f9, #cbd5e1, #94a3b8" :
                  badge.tier === "platinum" ? "#eef2ff, #a5b4fc, #6366f1" :
                  "#fff7ed, #fed7aa, #ba8545"
                })`,
                borderRadius: 24,
                boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
              }}
            >
              <span style={{ fontSize: 72 }}>{mono}</span>
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 11,
                fontWeight: 700,
                color: "#a86c04",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              {tierLabel} · Level {badge.level}
            </div>
            <h3 style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: "#1d252b" }}>
              {badge.label}
            </h3>
            {badge.line && (
              <p style={{ marginTop: 10, fontSize: 14, color: "#6b7280", fontStyle: "italic" }}>
                &ldquo;{badge.line}&rdquo;
              </p>
            )}
            <p style={{ marginTop: 12, fontSize: 13, color: "#4b5563" }}>
              {badge.description}
            </p>
            <div style={{ marginTop: 28, fontSize: 11, color: "#9ca3af" }}>
              sleek · embrace the friction and light up the night
            </div>
          </div>
        </div>

        {/* Visible card */}
        <div
          className="rounded-[28px] overflow-hidden"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.2)",
          }}
        >
          {/* Header band */}
          <div
            className="relative py-10 flex flex-col items-center"
            style={{
              background: `linear-gradient(135deg,
                ${badge.tier === "gold" ? "#fef3c7, #fcd34d, #f59e0b" :
                  badge.tier === "silver" ? "#f1f5f9, #e2e8f0, #94a3b8" :
                  badge.tier === "platinum" ? "#eef2ff, #c7d2fe, #6366f1" :
                  "#fff7ed, #fed7aa, #ba8545"})`,
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/60 text-ink-soft hover:bg-white/80 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Glow orb */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 200px 80px at 50% 60%, rgba(245,184,18,.5), transparent 70%)",
              }}
            />

            <div className="relative animate-float">
              <BadgeLU tier={badge.tier} monogram={mono} locked={!badge.earned} size={110} />
            </div>

            <div
              className="mt-3 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.7)",
                color: badge.tier === "gold" ? "#92400e" : badge.tier === "silver" ? "#475569" : badge.tier === "platinum" ? "#4338ca" : "#78350f",
              }}
            >
              {tierLabel} · Level {badge.level}
            </div>
          </div>

          {/* Body */}
          <div className="px-8 pb-8 pt-5">
            <h3 className="text-2xl font-extrabold text-ink text-center">{badge.label}</h3>

            {badge.line && (
              <p className="mt-2 text-center text-sm italic" style={{ color: "var(--amber-600)" }}>
                &ldquo;{badge.line}&rdquo;
              </p>
            )}

            <p className="mt-3 text-sm meta text-center leading-relaxed">
              {badge.description}
            </p>

            {/* Meta row */}
            <div className="mt-5 flex items-center justify-center gap-4">
              {unlockedDate && (
                <div className="flex items-center gap-1.5 text-xs meta">
                  <Calendar className="h-3.5 w-3.5" />
                  {unlockedDate}
                </div>
              )}
              {badge.earned && (
                <div className="flex items-center gap-1.5 text-xs meta">
                  <Star className="h-3.5 w-3.5" style={{ color: "var(--amber-500)" }} />
                  {badge.badgeThreshold} badge{badge.badgeThreshold !== 1 ? "s" : ""} milestone
                </div>
              )}
            </div>

            {/* Download PNG */}
            {badge.earned && imgDataUrl && (
              <button onClick={downloadPng} className="mt-5 btn-primary w-full">
                <span className="flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" /> Save badge image
                </span>
              </button>
            )}

            {/* Share */}
            {badge.earned && (
              <div className="mt-4">
                <div className="label-xs mb-2.5 flex items-center gap-1.5">
                  <Share2 className="h-3 w-3" /> Share badge
                </div>
                <div className="flex items-center gap-2">
                  {SHARE_CHANNELS.map((s) => (
                    <a
                      key={s.name}
                      href={s.url(badge.label, badge.description)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 flex-col items-center gap-1.5 py-3 rounded-xl transition hover:-translate-y-0.5"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
                      title={`Share to ${s.name}`}
                    >
                      <span
                        className="grid h-8 w-8 place-items-center rounded-full text-sm"
                        style={{ background: s.color, color: "white" }}
                      >
                        {s.icon}
                      </span>
                      <span className="text-[10px] meta">{s.name}</span>
                    </a>
                  ))}
                  <button
                    onClick={copyBadgeLink}
                    className="flex flex-1 flex-col items-center gap-1.5 py-3 rounded-xl transition hover:-translate-y-0.5"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
                    title="Copy badge text"
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-sm"
                      style={{ background: "var(--ink)", color: "white" }}
                    >
                      {copied ? "✓" : "📋"}
                    </span>
                    <span className="text-[10px] meta">{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>
            )}

            <button onClick={onClose} className="btn-ghost w-full mt-5">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
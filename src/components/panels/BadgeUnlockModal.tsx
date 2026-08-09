"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2, Download } from "lucide-react";
import type { TrophyData } from "@/components/types";

interface NewlyUnlocked extends Partial<TrophyData> {
  id: string;
}

const SHARE_LINKS = [
  { name: "WhatsApp", url: (e: string, d: string) => `https://wa.me/?text=${encodeURIComponent(`I just unlocked the "${e}" badge on sleek! ${d}`)}`, color: "#25D366", icon: "💬" },
  { name: "Telegram", url: (e: string, d: string) => `https://t.me/share/url?url=https://everyday.app&text=${encodeURIComponent(`I unlocked "${e}" badge — ${d}`)}`, color: "#0088cc", icon: "✈️" },
  { name: "X / Twitter", url: (e: string, d: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just unlocked the "${e}" badge on sleek! ${d}`)}`, color: "#1DA1F2", icon: "🐦" },
  { name: "LinkedIn", url: () => `https://www.linkedin.com/sharing/share-offsite/?url=https://everyday.app`, color: "#0A66C2", icon: "in" },
  { name: "Instagram", url: () => `https://www.instagram.com/`, color: "#E4405F", icon: "📸" }
];

/**
 * Badge unlock modal — shows a glowing badge hero, generates a DOWNLOADABLE
 * PNG image of the badge (so users can share the visual, not just text), and
 * offers quick-links to WhatsApp/Telegram/X/LinkedIn/Instagram.
 */
export function BadgeUnlockModal({
  badge,
  onClose
}: {
  badge: NewlyUnlocked | null;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string>("");

  // Build the badge card PNG asynchronously (uses html2canvas lazily).
  useEffect(() => {
    if (!badge) return;
    let cancelled = false;
    (async () => {
      // Wait one tick for the DOM to render the cardRef.
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled || !cardRef.current) return;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardRef.current!, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        if (!cancelled) setImgDataUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        // html2canvas can fail on some exotic CSS — fall back silently.
        // The share-links still work without the PNG.
      }
    })();
    return () => { cancelled = true; };
  }, [badge]);

  if (!badge) return null;

  function downloadCard() {
    if (!imgDataUrl) return;
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = `badge-${badge!.label || "unlocked"}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 animate-fade-up" onClick={onClose}>
      {/* Glow rays behind the card */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(14)].map((_, i) => (
          <span key={i} className="absolute top-1/2 left-1/2 origin-left h-1 w-40 animate-fade-up"
            style={{
              transform: `rotate(${i * 25.7}deg)`,
              background: "linear-gradient(90deg, rgba(245,184,18,0.7), transparent)",
              animationDelay: `${i * 60}ms`,
              height: 2,
              opacity: 0.8
            }} />
        ))}
      </div>

      <div className="relative w-full max-w-sm animate-pop" onClick={(e) => e.stopPropagation()}>
        {/* Off-screen render target — html2canvas captures this. */}
        <div className="absolute -left-[9999px] top-0">
          <div ref={cardRef} style={{
            width: 480, padding: 32,
            background: "linear-gradient(135deg, #fffdf2 0%, #fff8e1 50%, #ffe7b3 100%)",
            borderRadius: 24,
            boxShadow: "0 20px 60px rgba(245,184,18,.35)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-grid",
                placeItems: "center",
                width: 140, height: 140,
                background: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 50%, #f59e0b 100%)",
                borderRadius: 24,
                boxShadow: "0 10px 30px rgba(245,184,18,0.4)",
                fontSize: 80,
              }}>
                {badge.emoji}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "#a86c04", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {badge.tier} tier · unlocked
              </div>
              <h3 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "#1d252b" }}>
                {badge.label}
              </h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "#3a3a3a" }}>
                {badge.description}
              </p>
              <div style={{ marginTop: 24, fontSize: 11, color: "#71706a" }}>
                sleek · embrace the friction and light up the night
              </div>
            </div>
          </div>
        </div>

        {/* Visible card */}
        <div className="rounded-3xl overflow-hidden" style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          boxShadow: "0 30px 80px rgba(245,184,18,.35), inset 0 0 60px rgba(245,184,18,.06)",
        }}>
          <button onClick={onClose} className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-2)] text-ink-soft hover:opacity-80 z-10">
            <X className="h-4 w-4" />
          </button>

          {/* Glowie animated badge hero */}
          <div className="relative py-10 flex items-center justify-center overflow-hidden"
               style={{ background: "linear-gradient(135deg, #fff7e1 0%, #fef3c7 50%, #fde68a 100%)" }}>
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(220px 100px at 50% 30%, rgba(245,184,18,.55), transparent 70%)" }} />
            <div className="relative flex flex-col items-center animate-pop" style={{ animationDelay: "150ms" }}>
              <div className="grid h-28 w-28 place-items-center rounded-3xl animate-float"
                   style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 50%, #f59e0b 100%)", boxShadow: "0 20px 50px rgba(245,184,18,.45)" }}>
                <span className="text-6xl">{badge.emoji}</span>
              </div>
              <div className="mt-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                   style={{ background: "#fcd34d", color: "#a86c04" }}>
                {badge.tier} tier · unlocked
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 pb-7 pt-4">
            <h3 className="text-2xl font-extrabold text-ink text-center">{badge.label}</h3>
            <p className="mt-2 text-sm meta text-center">{badge.description}</p>

            {/* Download PNG image */}
            {imgDataUrl && (
              <div className="mt-4">
                <button onClick={downloadCard} className="btn-primary w-full">
                  <span className="flex items-center justify-center gap-2"><Download className="h-4 w-4" /> Save badge image</span>
                </button>
              </div>
            )}

            {/* Quick-share channels */}
            <div className="mt-5">
              <div className="label-xs mb-3 flex items-center gap-1.5">
                <Share2 className="h-3 w-3" /> Share
              </div>
              <div className="flex items-center justify-between gap-2">
                {SHARE_LINKS.map((s) => (
                  <a key={s.name}
                     href={s.url(badge.label || "", badge.description || "")}
                     target="_blank" rel="noopener noreferrer"
                     className="flex flex-1 flex-col items-center gap-1.5 px-2 py-2.5 hover:-translate-y-0.5 transition-transform"
                     style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
                     title={`Share to ${s.name}`}>
                    <span className="grid h-7 w-7 place-items-center rounded-full text-white text-xs font-bold"
                          style={{ background: s.color }}>{s.icon}</span>
                    <span className="text-[10px] meta">{s.name}</span>
                  </a>
                ))}
              </div>
            </div>

            <button onClick={onClose} className="btn-ghost w-full mt-6">Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook to manage a queue of newly-unlocked badges to display sequentially. */
export function useBadgeUnlockQueue() {
  const [queue, setQueue] = useState<NewlyUnlocked[]>([]);
  const [current, setCurrent] = useState<NewlyUnlocked | null>(null);
  const idx = useRef(0);

  const push = (badges: NewlyUnlocked[]) => {
    if (!badges || badges.length === 0) return;
    setQueue((q) => [...q, ...badges]);
  };

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
  }, [queue, current]);

  const next = () => {
    idx.current++;
    setQueue((q) => q.slice(1));
    setCurrent(null);
  };

  return { pushBadgeQueue: push, currentBadge: current, dismissBadge: next };
}

"use client";

import { useEffect, useState, useRef } from "react";
import { Download, X, Trophy } from "lucide-react";
import html2canvas from "html2canvas";

interface Badge {
  id: string;
  label: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  description: string;
  earned: boolean;
  line?: string;
  unlockedAt?: string | null;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  bronze:   { bg: "linear-gradient(135deg,#cd7f32,#b87333)", border: "#a05a2c", text: "#92400e" },
  silver:   { bg: "linear-gradient(135deg,#94a3b8,#64748b)", border: "#475569", text: "#334155" },
  gold:     { bg: "linear-gradient(135deg,#f59e0b,#d97706)", border: "#b45309", text: "#92400e" },
  platinum:{ bg: "linear-gradient(135deg,#818cf8,#6366f1)", border: "#4338ca", text: "#3730a3" },
};

const TIER_EMO: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

export function BadgesPageClient() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [trophyCount, setTrophyCount] = useState(0);
  const [selected, setSelected] = useState<Badge | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/badges").then(r => r.json()).then(d => {
      setBadges(d.badges || []);
      setTrophyCount(d.earnedCount || 0);
    }).catch(() => {});
  }, []);

  async function downloadBadge() {
    if (!detailRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(detailRef.current, { scale: 2, backgroundColor: null });
      const link = document.createElement("a");
      link.download = `sleek-badge-${(selected?.label ?? "badge").replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {}
    setDownloading(false);
  }

  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  return (
    <div>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {badges.length === 0 && (
          <div className="text-center py-20 text-ink-muted">
            <div className="text-4xl mb-3">🏅</div>
            <p className="text-sm">No badges yet. Complete tasks, build streaks, or use AI verifier.</p>
          </div>
        )}

        {earned.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold tracking-[.12em] uppercase text-ink-soft">Earned ({earned.length})</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
              {earned.map((b, i) => (
                <BadgeCard key={b.id} badge={b} earned onClick={() => setSelected(b)} index={i} />
              ))}
            </div>
          </>
        )}

        {locked.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4 mt-6">
              <div className="h-2 w-2 rounded-full" style={{ background: "var(--line)" }} />
              <span className="text-xs font-semibold uppercase tracking-[.12em] meta">Locked ({locked.length})</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {locked.map((b, i) => (
                <BadgeCard key={b.id} badge={b} earned={false} onClick={() => setSelected(b)} index={i} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-40 grid place-items-center p-4 bg-black/50 animate-fade-up" onClick={() => setSelected(null)}>
          <div className="animate-pop" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div ref={detailRef} className="w-full max-w-sm p-6 rounded-[24px]" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
              <div className="flex justify-center mb-4">
                <div className="grid h-24 w-24 place-items-center rounded-full shadow-lg" style={{ background: selected.earned ? TIER_COLORS[selected.tier].bg : "var(--line-soft)", opacity: selected.earned ? 1 : 0.35 }}>
                  <span className="text-3xl">{selected.earned ? TIER_EMO[selected.tier] : "🔒"}</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-ink text-center">{selected.label}</h3>
              <div className="flex justify-center my-2">
                <span className="text-[10px] font-bold uppercase tracking-[.16em] px-2.5 py-0.5 rounded-xl" style={{ background: selected.earned ? TIER_COLORS[selected.tier].bg : "var(--line-soft)", color: selected.earned ? "white" : "var(--ink-muted)" }}>{selected.tier}</span>
              </div>
              <p className="text-sm text-center meta mb-1">{selected.description}</p>
              {selected.line && selected.earned && <p className="text-xs text-center italic meta">"{selected.line}"</p>}
              {selected.unlockedAt && <p className="text-[11px] text-center meta mt-3">Unlocked {new Date(selected.unlockedAt).toLocaleDateString()}</p>}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button onClick={() => setSelected(null)} className="btn-ghost py-2 px-4 text-xs">Close</button>
              {selected.earned && (
                <button onClick={downloadBadge} disabled={downloading} className="btn-green py-2 px-4 text-xs font-semibold flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> {downloading ? "Exporting..." : "Download"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, earned, onClick, index }: { badge: Badge; earned: boolean; onClick: () => void; index: number }) {
  const c = TIER_COLORS[badge.tier];
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-[16px] transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-fade-up text-left"
      style={{
        background: earned ? "var(--bg)" : "var(--bg-2)",
        border: earned ? `1px solid ${c.border}` : "1px solid var(--line-soft)",
        opacity: earned ? 1 : 0.55,
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full shrink-0" style={{ background: earned ? c.bg : "var(--line-soft)" }}>
          <span className="text-base">{earned ? TIER_EMO[badge.tier] : "🔒"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink leading-tight truncate">{badge.label}</div>
          <div className="text-[11px] meta mt-0.5">{badge.description}</div>
          {earned && badge.unlockedAt && <div className="text-[10px] meta mt-1.5">{new Date(badge.unlockedAt).toLocaleDateString()}</div>}
        </div>
        {earned && <span className="text-[10px] font-bold uppercase tracking-[.1em] mt-1 shrink-0" style={{ color: c.text }}>{badge.tier}</span>}
      </div>
      {earned && (
        <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
          <div className="h-full rounded-full shimmer-bar" style={{ width: "70%", background: c.bg }} />
        </div>
      )}
    </button>
  );
}
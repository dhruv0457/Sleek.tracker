"use client";

import { useEffect, useState } from "react";
import { Lock, Trophy as TrophyIcon } from "lucide-react";
import { BadgeLU, badgeMonogram, type BadgeTier } from "@/components/badges/BadgeLU";
import { BadgeDetailModal } from "./BadgeDetailModal";

export function TrophiesPanel() {
  const [data, setData] = useState<any | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/badges").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="animate-fade-up p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", opacity: 0.6 }}>
            <div className="mx-auto mb-3 h-14 w-14" style={{ background: "var(--bg)" }} />
            <div className="mx-auto h-3 w-20" style={{ background: "var(--bg)" }} />
            <div className="mx-auto mt-2 h-2.5 w-28" style={{ background: "var(--bg)" }} />
          </div>
        ))}
      </div>
    );
  }

  const earned = data.badges.filter((t: any) => t.earned);
  const locked = data.badges.filter((t: any) => !t.earned);
  const pct = data.totalCount === 0 ? 0 : Math.round((data.earnedCount / data.totalCount) * 100);

  return (
    <div className="animate-fade-up space-y-8">
      {/* Header */}
      <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 place-items-center" style={{ background: "var(--amber-100)", border: "1px solid var(--amber-300)" }}>
            <TrophyIcon className="h-8 w-8" style={{ color: "var(--amber-600)" }} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-ink">
              {data.earnedCount} <span className="text-base font-semibold meta">/ {data.totalCount} unlocked</span>
            </h2>
            <p className="mt-1 text-sm meta">Every milestone begins with a single check-in. Keep your streak alive to unlock them all.</p>
            <div className="mt-3 h-2 w-full max-w-md overflow-hidden" style={{ background: "var(--bg-2)" }}>
              <div className="h-full" style={{ width: `${pct}%`, background: "var(--green-600)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Trophies */}
      <div>
        <div className="label-xs mb-3">Trophies</div>
        {earned.length > 0 && (
          <>
            <div className="label-xs mb-2" style={{ color: "var(--green-700)" }}>Earned · {earned.length}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {earned.map((t: any) => (
                <TrophyCard key={t.id} trophy={t} onDetail={setSelected} />
              ))}
            </div>
          </>
        )}
        <div className="label-xs mb-2">Locked · {locked.length}</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((t: any) => (
            <TrophyCard key={t.id} trophy={t} onDetail={setSelected} />
          ))}
        </div>
      </div>

      {/* Section 2: Badges (level-based, motivational lines) */}
      <div>
        <div className="label-xs mb-3">Badges</div>
        <p className="text-xs meta mb-4">Level-based achievements with motivational milestones. Locked badges show as ? until unlocked, then reveal your progress line.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.badges.map((t: any) => (
            <BadgeCard key={t.id} badge={t} onDetail={setSelected} />
          ))}
        </div>
      </div>

      {selected && (
        <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TrophyCard({ trophy, onDetail }: { trophy: any; onDetail: (b: any) => void }) {
  const mono = badgeMonogram(trophy.label);
  const isEarned = trophy.earned;
  return (
    <div
      className="badge-card p-4 text-center flex flex-col items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform"
      style={{
        borderColor: isEarned ? "var(--amber-500)" : "var(--line)",
        background: isEarned ? "#fffdf2" : "var(--bg)"
      }}
      onClick={() => onDetail(trophy)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onDetail(trophy)}
    >
      <div className="mb-2">
        <BadgeLU tier={(trophy.tier || "bronze") as BadgeTier} monogram={mono} locked={!isEarned} size={56} />
      </div>
      <h3 className="font-semibold text-ink">{trophy.label}</h3>
      <p className="mt-1 text-xs meta leading-relaxed">{trophy.description}</p>
      <div className="mt-2 flex items-center justify-center gap-1 text-xs">
        {isEarned ? (
          <span className="font-semibold flex items-center gap-1" style={{ color: "var(--amber-600)" }}>
            <TrophyIcon className="h-3 w-3" /> Unlocked
          </span>
        ) : (
          <span className="meta flex items-center gap-1">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
      </div>
    </div>
  );
}

function BadgeCard({ badge, onDetail }: { badge: any; onDetail: (b: any) => void }) {
  const mono = badge.label ? badgeMonogram(badge.label) : "??";
  const isEarned = badge.earned;
  return (
    <div
      className="badge-card p-4 text-center flex flex-col items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform"
      style={{
        borderColor: isEarned ? "var(--amber-500)" : "var(--line)",
        background: isEarned ? "#fffdf2" : "var(--bg)"
      }}
      onClick={() => onDetail(badge)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onDetail(badge)}
    >
      <div className="mb-2">
        <BadgeLU tier={(badge.tier || "bronze") as BadgeTier} monogram={mono} locked={!isEarned} size={60} />
      </div>
      {isEarned ? (
        <>
          <h3 className="font-semibold text-ink">{badge.label}</h3>
          {badge.line && <p className="badge-line mt-1">"{badge.line}"</p>}
          <div className="mt-2 flex items-center justify-center gap-2 text-xs">
            <span className="chip chip-amber text-[9px] py-0.5">Level {badge.level}</span>
            <span className="font-semibold" style={{ color: "var(--amber-600)" }}>Unlocked</span>
          </div>
        </>
      ) : (
        <>
          <h3 className="font-semibold text-ink mt-1">Hidden badge</h3>
          <p className="mt-1 text-xs meta leading-relaxed">Keep checking in to unlock this badge.</p>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs meta">
            <Lock className="h-3 w-3" /> Locked
          </div>
        </>
      )}
    </div>
  );
}

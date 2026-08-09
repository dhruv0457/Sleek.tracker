"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronUp, Download, Sparkles, Trophy, Check, Lock, Star } from "lucide-react";
import { BadgeLU, badgeMonogram, type BadgeTier } from "@/components/badges/BadgeLU";
import { BadgeDetailModal } from "./BadgeDetailModal";
import { ACHIEVEMENT_TIERS, type AchievementTier } from "@/lib/trophies";

interface BadgeItem {
  id: string;
  label: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  level: number;
  description: string;
  line?: string | null;
  earned: boolean;
  unlockedAt?: string;
  badgeThreshold: number;
  color: string;
  nodeSize: number;
}

// Candy-Crush-style progression. 50 hand-authored levels, then endless
// auto-generated levels numbered 51+ ("Beyond · 51", "Beyond · 52", ...).
// Thresholds climb smoothly (curve ~1.18x per level) so the journey never ends.

const NAMED_LEVELS: { label: string; threshold: number }[] = [
  { label: "Seed Planter",      threshold: 1 },
  { label: "Root Strong",       threshold: 3 },
  { label: "First Sprout",      threshold: 5 },
  { label: "Green Thumb",       threshold: 8 },
  { label: "Rising Sapling",    threshold: 12 },
  { label: "Branch Builder",    threshold: 16 },
  { label: "Canopy Grower",     threshold: 21 },
  { label: "Forest Walker",     threshold: 26 },
  { label: "Misty Morning",     threshold: 32 },
  { label: "Sunlit Meadow",     threshold: 38 },
  { label: "Trail Finder",      threshold: 45 },
  { label: "Bridge Crosser",    threshold: 52 },
  { label: "Hill Climber",      threshold: 60 },
  { label: "Summit Seeker",     threshold: 68 },
  { label: "Cloud Walker",      threshold: 77 },
  { label: "Storm Rider",       threshold: 86 },
  { label: "Thunder Heart",     threshold: 96 },
  { label: "Wildfire Runner",   threshold: 107 },
  { label: "Ocean Voyager",    threshold: 118 },
  { label: "Kraken Tamer",      threshold: 130 },
  { label: "Abyss Diver",        threshold: 143 },
  { label: "Deep Sea Oracle",   threshold: 157 },
  { label: "Sky Breaker",       threshold: 172 },
  { label: "Star Forger",       threshold: 188 },
  { label: "Galaxy Weaver",     threshold: 205 },
  { label: "Nebula Crafter",    threshold: 223 },
  { label: "Black Hole Rider",  threshold: 242 },
  { label: "Quasar Titan",      threshold: 263 },
  { label: "Universe Pillar",   threshold: 286 },
  { label: "Infinity Flux",     threshold: 311 },
  { label: "Cosmic Bloom",      threshold: 338 },
  { label: "Stellar Garden",    threshold: 367 },
  { label: "Solar Forge",       threshold: 398 },
  { label: "Lunar Architect",   threshold: 431 },
  { label: "Aurora Sovereign",  threshold: 466 },
  { label: "Comet Surgeon",     threshold: 503 },
  { label: "Pulsar Binder",     threshold: 542 },
  { label: "Void Cartographer", threshold: 583 },
  { label: "Eventide Aegis",    threshold: 626 },
  { label: "Halcyon Tide",      threshold: 671 },
  { label: "Phoenix Smith",     threshold: 718 },
  { label: "Dragon Tamer",      threshold: 767 },
  { label: "Griffin Eyrie",     threshold: 818 },
  { label: "Leviathan Wake",    threshold: 871 },
  { label: "Wyrm Sentinel",     threshold: 926 },
  { label: "Chimera Sovereign", threshold: 983 },
  { label: "Crimson Apex",      threshold: 1042 },
  { label: "Obsidian Crown",    threshold: 1103 },
  { label: "Eclipse Eternal",   threshold: 1166 },
  { label: "Ascendant Dawn",    threshold: 1231 },
];

const TOTAL_AUTHORED = NAMED_LEVELS.length; // 50

// Build a windowed list of levels centered on the user's current level.
// Generates enough to feel endless while staying performant.
function buildLevelWindow(badgeCount: number, spanAhead = 14, spanBehind = 10) {
  // Find current level index (0-based): the highest level whose threshold <= badgeCount
  let curIdx = 0;
  for (let i = 0; i < NAMED_LEVELS.length; i++) {
    if (badgeCount >= NAMED_LEVELS[i].threshold) curIdx = i;
    else break;
  }
  // If user has gone beyond level 50, compute the auto-generated level
  const beyond = badgeCount >= NAMED_LEVELS[TOTAL_AUTHORED - 1].threshold;
  let startIdx = Math.max(0, curIdx - spanBehind);
  let endIdx = Math.min(TOTAL_AUTHORED - 1, curIdx + spanAhead);
  const out: { level: number; label: string; threshold: number }[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    out.push({ level: i + 1, ...NAMED_LEVELS[i] });
  }
  // Auto-generate higher levels after 50
  if (beyond || endIdx === TOTAL_AUTHORED - 1) {
    let lastThreshold = NAMED_LEVELS[TOTAL_AUTHORED - 1].threshold;
    let n = TOTAL_AUTHORED + 1;
    while (n <= (beyond ? curIdx + 1 + spanAhead : TOTAL_AUTHORED + 8)) {
      lastThreshold = Math.round(lastThreshold * 1.18) + 7;
      out.push({ level: n, label: `Beyond · ${n}`, threshold: lastThreshold });
      n++;
    }
  }
  return { curIdx, beyond, list: out };
}

function phaseColor(level: number): string {
  if (level <= 10) return "#10b981";
  if (level <= 20) return "#3b82f6";
  if (level <= 30) return "#8b5cf6";
  if (level <= 40) return "#f59e0b";
  if (level <= 50) return "#ef4444";
  return "#06b6d4"; // Beyond
}

function phaseTier(level: number): BadgeTier {
  if (level >= 36) return "platinum";
  if (level >= 22) return "gold";
  if (level >= 11)  return "silver";
  return "bronze";
}

export function GamificationPanel() {
  const [data, setData] = useState<any>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [animatingLevel, setAnimatingLevel] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowLeftArrow(el.scrollLeft > 12);
      setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 12);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => {
      onScroll();
      // Center the track on the user's current level after data loads
      if (data) {
        const cur = el.querySelector("[data-is-current='true']") as HTMLElement | null;
        if (cur) {
          const target = cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2;
          el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        }
      }
    }, 200);
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, [data]);

  const unlocked = useMemo<AchievementTier[]>(() => data?.unlocked ?? [], [data]);
  const next = useMemo<AchievementTier | null>(() => data?.next ?? null, [data]);
  const badgeCount = useMemo<number>(() => data?.badgeCount ?? 0, [data]);
  const trophies = useMemo<number>(() => data?.trophies ?? 0, [data]);

  if (!data) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="p-8 rounded-2xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <div className="text-sm meta">Loading your journey...</div>
        </div>
      </div>
    );
  }

  const hasAnyAchievement = unlocked.length > 0;
  const currentTierLabel = unlocked.length > 0 ? unlocked[unlocked.length - 1].label : "Seed Planter";
  const progressPct = next
    ? Math.min(100, Math.round((badgeCount / next.badgeThreshold) * 100))
    : 100;

  const handleNodeClick = (level: number, label: string, threshold: number) => {
    setAnimatingLevel(level);
    setTimeout(() => setAnimatingLevel(null), 800);
    const earned = badgeCount >= threshold;
    setSelectedBadge({
      id: `level-${level}`,
      label,
      tier: phaseTier(level),
      level,
      description: `Reach ${threshold} badges to unlock "${label}". You have ${badgeCount}.`,
      line: null,
      earned,
      unlockedAt: undefined,
      badgeThreshold: threshold,
      color: phaseColor(level),
      nodeSize: 48 + Math.min(20, level * 0.4),
    });
  };

  function scrollBy(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(480, el.clientWidth * 0.8), behavior: "smooth" });
  }

  const { list: levels, curIdx } = buildLevelWindow(badgeCount);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div
        className="p-5 rounded-2xl relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(59,130,246,0.04) 100%)", border: "1px solid var(--line)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6, #f59e0b)" }} />
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl shrink-0"
            style={{
              background: "linear-gradient(135deg, #fef3c7, #fcd34d)",
              border: "1px solid var(--amber-300)",
            }}
          >
            <Trophy className="h-7 w-7" style={{ color: "var(--amber-600)" }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ink">
              {currentTierLabel}{" "}
              <span className="text-base font-semibold meta">
                · {badgeCount} badge{badgeCount === 1 ? "" : "s"}
              </span>
            </h2>
            <p className="mt-1 text-sm meta">
              {trophies.toLocaleString()} trophies · {unlocked.length} / {ACHIEVEMENT_TIERS.length} achievements unlocked · Level {curIdx + 1}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar to next achievement */}
      {next && (
        <div className="p-5 rounded-2xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="label-xs">Next milestone</span>
              <span className="ml-2 text-sm font-bold text-ink">&ldquo;{next.label}&rdquo;</span>
            </div>
            <span className="text-xs font-semibold meta tabular-nums">
              {badgeCount}/{next.badgeThreshold}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-xl relative" style={{ background: "var(--bg-2)" }}>
            <div
              className="h-full rounded-xl transition-all duration-700 ease-out"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${next.color}, ${next.color}88)`,
                boxShadow: `0 0 12px ${next.color}40`,
              }}
            />
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
                animation: "shimmer 2s ease-in-out infinite",
              }}
            />
          </div>
          <p className="mt-2.5 text-xs meta leading-relaxed">{next.description}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: next.color }}>
            {next.badgeThreshold - badgeCount} more badge{next.badgeThreshold - badgeCount !== 1 ? "s" : ""} to unlock
          </p>
        </div>
      )}

      {/* Candy-Crush Level Trail */}
      <div className="p-5 rounded-2xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="label-xs">Level Trail</div>
            <h3 className="text-xl font-bold text-ink">Candy Path · 50+ Levels · Endless</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollBy(-1)}
              disabled={!showLeftArrow}
              className="grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
              aria-label="Scroll left"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollBy(1)}
              disabled={!showRightArrow}
              className="grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
              aria-label="Scroll right"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-xs meta mb-4">
          Scroll left-to-right through 50 handcrafted levels &mdash; then endless auto-generated
          levels beyond. Tap any node for details.
        </p>

        <div className="relative">
          <div
            ref={trackRef}
            className="overflow-x-auto overflow-y-hidden pb-2 horizontal-thin-scroll"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="relative flex items-start" style={{ minWidth: "max-content", paddingTop: 28, paddingBottom: 12 }}>
              {/* Path rail (continuous) */}
              <div className="absolute inset-x-0 flex pointer-events-none" style={{ top: 56, height: 4, paddingLeft: 16, paddingRight: 16 }}>
                {levels.map((p, i) => {
                  const earned = badgeCount >= p.threshold;
                  const color = phaseColor(p.level);
                  return (
                    <div
                      key={p.level}
                      style={{
                        width: `${100 / levels.length}%`,
                        height: 4,
                        background: earned ? color : "var(--line-soft)",
                        transition: "background .6s ease",
                        borderRadius: 2,
                      }}
                    />
                  );
                })}
              </div>

              {/* Level nodes */}
              {levels.map((p) => {
                const earned = badgeCount >= p.threshold;
                // The "next" level is the lowest non-earned
                const isNextUnearned = !earned && (levels.find((q) => badgeCount < q.threshold)?.level === p.level);
                const isCurrent = levels.find((q) => badgeCount < q.threshold)?.level === p.level + 1 || (earned && p.level === curIdx + 1 && curIdx + 1 <= levels.length);
                const color = phaseColor(p.level);
                const progressPct = earned ? 100 : Math.min(100, Math.round((badgeCount / p.threshold) * 100));
                const size = 42 + Math.min(18, p.level * 0.5);

                return (
                  <div
                    key={p.level}
                    data-is-current={p.level === curIdx + 1}
                    onClick={() => handleNodeClick(p.level, p.label, p.threshold)}
                    className="relative flex flex-col items-center cursor-pointer group mx-1.5 shrink-0"
                    style={{ width: 92, zIndex: 5 }}
                  >
                    {/* Node tile — square (Candy Crush style) */}
                    <div
                      className={"relative grid place-items-center rounded-xl transition-all duration-300 " + (animatingLevel === p.level ? "scale-125" : "group-hover:scale-110")}
                      style={{
                        width: size,
                        height: size,
                        background: earned
                          ? `linear-gradient(135deg, ${color}, ${color}cc)`
                          : "var(--surface)",
                        border: `2.5px solid ${earned ? color : isNextUnearned ? color + "80" : "var(--line)"}`,
                        boxShadow: earned
                          ? `0 6px ${size / 3}px ${color}66`
                          : isNextUnearned
                          ? `0 0 ${size / 4}px ${color}55`
                          : "none",
                      }}
                    >
                      {earned ? (
                        <Star className="text-white" style={{ width: size * 0.42, height: size * 0.42 }} fill="white" strokeWidth={2} />
                      ) : (
                        <span className="text-base font-extrabold text-ink-muted">{p.level}</span>
                      )}

                      {isNextUnearned && !earned && (
                        <span
                          className="absolute inset-0 rounded-xl animate-ping"
                          style={{ border: `2px solid ${color}`, opacity: 0.45 }}
                        />
                      )}
                      {animatingLevel === p.level && (
                        <span
                          className="absolute inset-0 rounded-xl"
                          style={{ border: `3px solid ${color}`, animation: "expandRing 0.5s ease-out forwards" }}
                        />
                      )}

                      {/* Level pill chip — square */}
                      {earned && (
                        <span
                          className="absolute -top-1 -right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                          style={{ background: color, color: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                        >
                          {p.level}
                        </span>
                      )}
                    </div>

                    {/* Level card below */}
                    <div
                      className="mt-2.5 px-2 py-1.5 rounded-xl text-center transition-all duration-300 group-hover:shadow-sm w-full"
                      style={{
                        background: earned ? `${color}0d` : "var(--bg-2)",
                        border: `1px solid ${earned ? color + "40" : isNextUnearned ? color + "30" : "var(--line-soft)"}`,
                      }}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: earned ? color : "var(--ink-muted)" }}>
                        Lvl {p.level}
                      </div>
                      <div className="text-[11px] font-semibold text-ink leading-tight mt-0.5 line-clamp-1">
                        {p.label}
                      </div>
                      <div className="text-[10px] meta mt-0.5">
                        {earned ? "✓ Earned" : `${badgeCount}/${p.threshold}`}
                      </div>
                      {!earned && (
                        <div className="mt-1 h-1 rounded-lg overflow-hidden mx-auto" style={{ background: "var(--line-soft)", maxWidth: 56 }}>
                          <div
                            className="h-full rounded-lg transition-all duration-700"
                            style={{ width: `${progressPct}%`, background: color }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Badges" value={badgeCount} icon="trophy" color="#f5b812" />
        <StatCard label="Total Trophies" value={trophies} icon="trophy" color="#10b981" />
        <StatCard
          label="Achievements Unlocked"
          value={`${unlocked.length}/${ACHIEVEMENT_TIERS.length}`}
          icon="star"
          color="#3b82f6"
        />
        <StatCard
          label="Current Level"
          value={curIdx + 1}
          icon="crown"
          color={phaseColor(curIdx + 1)}
        />
      </div>

      {/* No achievements yet — encourage */}
      {!hasAnyAchievement && next && (
        <div className="p-5 text-center rounded-2xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <Sparkles className="mx-auto h-8 w-8 mb-2" style={{ color: "var(--green-500)" }} />
          <p className="text-sm meta">
            Complete your first tasks and earn badges to unlock Level 1 — &ldquo;{NAMED_LEVELS[0].label}&rdquo;!
          </p>
        </div>
      )}

      {/* Badge detail modal */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, color, textValue,
}: {
  label: string; value: string | number; icon: "trophy" | "star" | "crown"; color: string; textValue?: boolean;
}) {
  return (
    <div
      className="p-3 rounded-xl flex items-center gap-3 transition-all duration-300 hover:shadow-md card-tilt"
      style={{ background: `${color}0d`, border: `1.5px solid ${color}30` }}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg shrink-0"
        style={{ background: color, color: "white" }}
      >
        {icon === "trophy" && <Trophy className="h-4 w-4" />}
        {icon === "star" && <Sparkles className="h-4 w-4" />}
        {icon === "crown" && <span className="text-base">👑</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] label-xs">{label}</p>
        <p
          className={`font-bold text-ink ${textValue ? "text-sm truncate" : "text-xl tabular-nums"}`}
          style={!textValue ? { color } : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Lock } from "lucide-react";

interface AchievementNode {
  level: number;
  label: string;
  desc: string;
  earned: boolean;
  progress: number;
  threshold: number;
  color: string;
  icon: string;
}

const NAMED_LEVELS: { label: string; desc: string; threshold: number; icon: string; color: string }[] = [
  { label: "Seedling",   desc: "Get your first 2 badges",       threshold: 2,   icon: "🌱", color: "#22c55e" },
  { label: "Sprout",     desc: "Collect 4 badges",               threshold: 4,   icon: "🌿", color: "#16a34a" },
  { label: "Sapling",    desc: "Earn 6 badges",                  threshold: 6,   icon: "🪴", color: "#15803d" },
  { label: "Bloom Bud",  desc: "Reach 9 badges",                 threshold: 9,   icon: "🌻", color: "#ca8a04" },
  { label: "Sunlit",     desc: "Grow to 13 badges",              threshold: 13,  icon: "☀️", color: "#eab308" },
  { label: "Golden",     desc: "Hit 18 badges milestone",        threshold: 18,  icon: "⭐", color: "#f59e0b" },
  { label: "Diamond",    desc: "Shine at 26 badges",             threshold: 26,  icon: "💎", color: "#38bdf8" },
  { label: "Ruby Core",  desc: "Forge 35 badges",                threshold: 35,  icon: "🔴", color: "#ef4444" },
  { label: "Emerald",    desc: "Smelt 45 badges",                threshold: 45,  icon: "💚", color: "#10b981" },
  { label: "Amethyst",   desc: "Polish 56 badges",               threshold: 56,  icon: "💜", color: "#8b5cf6" },
  { label: "Sapphire",   desc: "Shape 68 badges",                threshold: 68,  icon: "💙", color: "#3b82f6" },
  { label: "Obsidian",   desc: "Cut 82 badges",                  threshold: 82,  icon: "🖤", color: "#334155" },
  { label: "Quartz",     desc: "Chisel 97 badges",               threshold: 97,  icon: "🤍", color: "#94a3b8" },
  { label: "Topaz",      desc: "Reveal 113 badges",              threshold: 113, icon: "🧡", color: "#f97316" },
  { label: "Jade",       desc: "Rise to 130 badges",             threshold: 130, icon: "💚", color: "#059669" },
  { label: "Onyx",       desc: "Build 148 badges",              threshold: 148, icon: "🦾", color: "#475569" },
  { label: "Opal",       desc: "Earn 167 badges",                threshold: 167, icon: "🌈", color: "#ec4899" },
  { label: "Crown",      desc: "Collect 187 badges",             threshold: 187, icon: "👑", color: "#f59e0b" },
  { label: "Titan",      desc: "Master 208 badges",              threshold: 208, icon: "⚡", color: "#6366f1" },
  { label: "Legend",     desc: "Reign at 230 badges",            threshold: 230, icon: "🏆", color: "#d97706" },
];

function buildLevelNodes(earnedCount: number): AchievementNode[] {
  return NAMED_LEVELS.map((m, i) => {
    const earned = earnedCount >= m.threshold;
    const progress = earned
      ? 100
      : Math.min(99, Math.round((earnedCount / m.threshold) * 100));
    return {
      level: i + 1,
      label: m.label,
      desc: m.desc,
      earned,
      progress,
      threshold: m.threshold,
      color: m.color,
      icon: m.icon,
    };
  });
}

// Layout geometry for the winding path
const ROW_H = 110;      // vertical distance between node centers (px)
const W = 420;          // svg viewBox width
const MARGIN_X = 95;    // distance from svg edge to left/right center node
const NODE_Y0 = 70;     // y position of the first node center

// Compute (x, y) for each node — they zigzag left/right but the path is
// a single smooth cubic bezier chain that runs through every node.
function nodePoint(idx: number) {
  const isLeft = idx % 2 === 0;
  const x = isLeft ? MARGIN_X : W - MARGIN_X;
  const y = NODE_Y0 + idx * ROW_H;
  return { x, y, isLeft };
}

// Build the SVG path "d" string as a sequence of smooth S-curve segments
// connecting consecutive nodes. The curve bulges sideways between rows so
// it visually reads like a candy-crush style winding road.
function buildPathD(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midY = (p0.y + p1.y) / 2;
    // cubic with control points pushed to the opposite side of the next node
    // creates a continuous S-shape rather than an angular zigzag.
    const c1x = p0.x;
    const c1y = midY;
    const c2x = p1.x;
    const c2y = midY;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function AchievementsPageClient() {
  const [achiev, setAchievements] = useState<AchievementNode[]>([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [totalBadges, setTotalBadges] = useState(28);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/badges")
      .then((r) => r.json())
      .then((d) => {
        const cnt = d.earnedCount || 0;
        setEarnedCount(cnt);
        setTotalBadges(d.totalCount || 28);
        setAchievements(buildLevelNodes(cnt));
      })
      .catch(() => {})
      .finally(() => setHasLoaded(true));
    // eslint-disable-next-line
  }, []);

  const nodes = achiev;
  const points = nodes.map((_, i) => nodePoint(i));
  const fullD = buildPathD(points);

  // Current level = the most-recently unlocked tier, OR the first unearned one
  // if nothing has been earned yet. This is the node the flowing animation runs
  // along so the user sees "you are here".
  const currentLevelIndex = (() => {
    const lastEarnedIdx = nodes.map((n) => n.earned).lastIndexOf(true);
    if (lastEarnedIdx !== -1) return lastEarnedIdx;
    const firstUnearnedIdx = nodes.findIndex((n) => !n.earned);
    return firstUnearnedIdx === -1 ? nodes.length - 1 : firstUnearnedIdx;
  })();

  // Per-segment path strings — used for the colored "earned" overlay.
  // Each segment runs between node i and node i+1.
  const segments: { d: string; idx: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midY = (p0.y + p1.y) / 2;
    const d =
      `M ${p0.x} ${p0.y} C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
    segments.push({ d, idx: i });
  }

  const totalH = NODE_Y0 * 2 + (nodes.length - 1) * ROW_H;

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-24">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-ink">Candy Path</h2>
          <span className="text-xs meta tabular-nums">
            {earnedCount} / {totalBadges} badges
          </span>
        </div>
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl mb-2"
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
          >
            <span className="text-sm font-semibold text-ink">
              {earnedCount} of {totalBadges} badges
            </span>
          </div>
          <p className="text-[11px] meta">
            {nodes.filter((n) => n.earned).length} / {nodes.length} levels cleared
          </p>
        </div>

        {hasLoaded && nodes.length > 0 && (
          <div className="relative w-full max-w-md" style={{ minHeight: totalH }}>
            <svg
              viewBox={`0 0 ${W} ${totalH}`}
              width="100%"
              preserveAspectRatio="xMidYMin meet"
              style={{ display: "block", overflow: "visible" }}
            >
              <defs>
                {/* Instance passes the segment the flowing dash animation lives on */}
                <linearGradient id="cp-flow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {/* Base path — everything gray, the full road behind everything */}
              <path
                d={fullD}
                fill="none"
                stroke="var(--line)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
              />

              {/* Earned segments drawn in their tier color (greyed out only) */}
              {segments.map(({ d, idx }) => {
                const earned = nodes[idx].earned && nodes[idx + 1].earned;
                if (!earned) return null;
                const fromColor = nodes[idx].color;
                const toColor = nodes[idx + 1].color;
                const segId = `cp-earned-${idx}`;
                return (
                  <g key={segId}>
                    <defs>
                      <linearGradient id={segId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={fromColor} />
                        <stop offset="100%" stopColor={toColor} />
                      </linearGradient>
                    </defs>
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#${segId})`}
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Connector into the *current* (first unearned) node glows with
                  a flowing dashed overlay so the user can see "we are here". */}
              {(() => {
                // Segment that LEADS into the current node = currentLevelIndex,
                // unless that's the very first node (no incoming segment).
                const segIdx = currentLevelIndex - 1;
                if (segIdx < 0 || segIdx >= segments.length) return null;
                const seg = segments[segIdx];
                const flowColor = nodes[currentLevelIndex]?.color ?? "#f59e0b";
                const flowId = `cp-flow-${segIdx}`;
                return (
                  <g>
                    <defs>
                      <linearGradient id={flowId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={flowColor} stopOpacity="0.2" />
                        <stop offset="50%" stopColor={flowColor} stopOpacity="0.9" />
                        <stop offset="100%" stopColor={flowColor} stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                    <path
                      d={seg.d}
                      fill="none"
                      stroke={`url(#${flowId})`}
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray="14 26"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-80"
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.55;1;0.55"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                );
              })()}
            </svg>

            {/* Round candy nodes overlaid on top of the SVG, positioned to align
                with the node centers computed above. */}
            <div className="absolute inset-0 pointer-events-none">
              {nodes.map((a, idx) => {
                const { x, y, isLeft } = nodePoint(idx);
                // Convert from viewBox coords into percentage-based positions
                // so the overlay tracks the SVG regardless of rendered width.
                const leftPct = (x / W) * 100;
                const topPx = y;
                const isCurrent = idx === currentLevelIndex;
                const size = 64 + a.level * 1.4;
                return (
                  <div
                    key={a.level}
                    className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${leftPct}%`, top: topPx, width: size, height: size }}
                    onClick={() => setSelectedLevel(selectedLevel === a.level ? null : a.level)}
                  >
                    <CandyNode
                      a={a}
                      size={size}
                      isCurrent={isCurrent}
                      isTarget={selectedLevel === a.level}
                    />
                  </div>
                );
              })}
            </div>

            {/* Floating labels — placed to the side of each node */}
            <div className="absolute inset-0 pointer-events-none">
              {nodes.map((a, idx) => {
                const { x, y, isLeft } = nodePoint(idx);
                const sideLeft = isLeft; // label sits on the same side as the node
                const leftPct = sideLeft ? ((x - 56) / W) * 100 : ((x + 56) / W) * 100;
                const transformX = sideLeft ? "-100%" : "0";
                return (
                  <div
                    key={`label-${a.level}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${leftPct}%`,
                      top: y,
                      transform: `translate(${transformX}, -50%)`,
                      maxWidth: 170,
                    }}
                  >
                    <LabelBlock a={a} align={sideLeft ? "right" : "left"} isCurrent={idx === currentLevelIndex} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasLoaded && nodes.length === 0 && (
          <div className="text-center py-20 text-ink-muted flex-1 flex items-center justify-center flex-col">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-sm">Start completing tasks to begin your Candy Path journey.</p>
          </div>
        )}
      </div>
  );
}

function CandyNode({
  a,
  size,
  isCurrent,
  isTarget,
}: {
  a: AchievementNode;
  size: number;
  isCurrent: boolean;
  isTarget: boolean;
}) {
  const color = a.color;
  return (
    <div className="relative w-full h-full cursor-pointer group">
      {/* Pulsing halo for the "you are here" node */}
      {isCurrent && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.25 }}
          aria-hidden
        />
      )}
      {/* Selection halo */}
      {isTarget && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 4px ${color}66`, opacity: 0.7 }}
          aria-hidden
        />
      )}

      <div
        className="absolute inset-0 rounded-full grid place-items-center transition-transform duration-300 group-hover:scale-110"
        style={{
          background: a.earned
            ? `radial-gradient(circle at 35% 30%, ${color}, ${shade(color, -25)})`
            : "var(--surface)",
          border: `3px solid ${a.earned ? color : "var(--line)"}`,
          boxShadow: a.earned
            ? `0 6px 18px ${color}66, inset 0 2px 6px rgba(255,255,255,0.25)`
            : "inset 0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        {/* Glossy highlight to make it read as a round candy */}
        <span
          className="absolute rounded-full"
          style={{
            left: "18%",
            top: "10%",
            width: "42%",
            height: "30%",
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        {a.earned ? (
          <span className="relative z-10" style={{ fontSize: size * 0.4 }}>
            {a.icon}
          </span>
        ) : (
          <Lock
            className="relative z-10 text-ink-muted"
            style={{ width: size * 0.32, height: size * 0.32 }}
          />
        )}
      </div>

      {/* Level badge */}
      <span
        className="absolute -top-1 -right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full z-20"
        style={{
          background: a.earned ? color : "var(--bg-2)",
          color: a.earned ? "white" : "var(--ink-muted)",
          border: `1px solid ${a.earned ? color : "var(--line)"}`,
        }}
      >
        {a.level}
      </span>
    </div>
  );
}

function LabelBlock({
  a,
  align,
  isCurrent,
}: {
  a: AchievementNode;
  align: "left" | "right";
  isCurrent: boolean;
}) {
  const color = a.earned ? a.color : "var(--ink-muted)";
  return (
    <div
      className="pointer-events-auto"
      style={{
        background: a.earned ? `${a.color}12` : "var(--bg-2)",
        border: `1px solid ${a.earned ? `${a.color}55` : "var(--line-soft)"}`,
        borderRadius: 14,
        padding: "6px 10px",
        textAlign: align,
        boxShadow: isCurrent ? `0 0 0 2px ${a.color}40` : "none",
      }}
    >
      <div
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        Lv.{a.level}
      </div>
      <div className="text-[13px] font-bold text-ink leading-tight">{a.label}</div>
      {!a.earned ? (
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{
              background: "var(--line-soft)",
              width: 90,
              marginLeft: align === "right" ? "auto" : 0,
            }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${a.progress}%`, background: a.color }}
            />
          </div>
          <span className="text-[9px] meta">{a.progress}%</span>
        </div>
      ) : (
        <div className="text-[9px] meta mt-0.5" style={{ color }}>
          ✓ Earned
        </div>
      )}
    </div>
  );
}

// lighten or darken a hex color by amt (-25 darkens, 25 lightens)
function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const num = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16
  );
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

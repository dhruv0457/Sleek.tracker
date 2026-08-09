"use client";

/**
 * BadgeLU — renders a premium metallic emblem SVG for each badge tier
 * instead of a plain emoji. The emblem has a tier-coded ring (bronze/silver/
 * gold/platinum), a monogram inside, and a glossy reflection. Locked badges
 * render as a dim question-mark placeholder.
 *
 * Color map per tier:
 *   bronze   → warm copper (#ba8545)
 *   silver   → cool gray   (#9ba0ad)
 *   gold     → rich amber  (#f5b812)
 *   platinum → icy indigo  (#a5b4fc / #4f46e5)
 */

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

const TIER_COLORS: Record<BadgeTier, { ring: string; bg: string; text: string }> = {
  bronze:   { ring: "#ba8545", bg: "#ba8545", text: "#ffffff" },
  silver:   { ring: "#9ba0ad", bg: "#9ba0ad", text: "#ffffff" },
  gold:     { ring: "#f5b812", bg: "#fcd34d", text: "#0e0e0e" },
  platinum: { ring: "#4f46e5", bg: "#818cf8", text: "#ffffff" }
};

type Props = {
  tier: BadgeTier;
  /** 1-3 letter monogram rendered inside the badge. */
  monogram: string;
  size?: number;       // px of the bounding square (default 64)
  locked?: boolean;    // renders a matt gray padlock with "?"
};

export function BadgeLU({ tier, monogram, size = 64, locked }: Props) {
  const c = locked ? { ring: "#cbd5e1", bg: "#f1f5f9", text: "#94a3b8" } : TIER_COLORS[tier];
  const pad = 2;
  const inner = size - pad * 2;
  const r = inner * 0.38;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={locked ? "Locked badge" : `${tier} badge · ${monogram}`}>
      {/* Outer glow ring */}
      <circle cx={size / 2} cy={size / 2} r={inner / 2 + 2.5} fill="none" stroke={c.ring} strokeWidth="2.5" opacity="0.4" />
      {/* Metallic disk */}
      <circle cx={size / 2} cy={size / 2} r={r} fill={`url(#gld-${tier}-${size})`} stroke={c.ring} strokeWidth="2.2" />
      {/* Surface gloss */}
      <ellipse cx={size / 2 - r * 0.3} cy={size / 2 - r * 0.45} rx={r * 0.45} ry={r * 0.22}
        fill="white" opacity="0.28" />
      {locked ? (
        <>
          <text x={size / 2} y={size / 2 + inner * 0.08} textAnchor="middle" dominantBaseline="middle"
            fontFamily="var(--font-mono), monospace" fontSize={r * 1.3} fontWeight="600" fill={c.text} opacity="0.5">?</text>
        </>
      ) : (
        <>
          {/* Monogram */}
          <text x={size / 2} y={size / 2 + inner * 0.09} textAnchor="middle" dominantBaseline="middle"
            fontFamily="var(--font-sans), sans-serif" fontSize={r * 0.88} fontWeight="700" fill={c.text}
            style={{ textTransform: "uppercase" }}>{monogram.toUpperCase()}</text>
        </>
      )}
      {/* Gradients */}
      <defs>
        <linearGradient id={`gld-${tier}-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.bg} stopOpacity="1" />
          <stop offset="85%" stopColor={c.ring} stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Shortcut: derive a monogram from a badge label (first 2 caps).
 */
export function badgeMonogram(label: string): string {
  const caps = label.replace(/\s/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  return caps.slice(0, 2) || label.slice(0, 2).toUpperCase();
}
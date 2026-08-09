"use client";

import React, { type ReactNode, Component } from "react";
import dynamic from "next/dynamic";

const BrandMark3D = dynamic(
  () => import("./BrandMark3D").then((m) => m.BrandMark3D),
  { ssr: false }
);

export function BrandMark2D({
  size = 32,
  className = "",
  inverted = false,
}: { size?: number; className?: string; inverted?: boolean }) {
  const cx = size / 2;
  const idSuffix = inverted ? "inv" : "reg";
  // Controlled palette — anchors on brand teal/emerald then uses one warm
  // accent (amber) and one cool accent (indigo). No more 6-color rainbow
  // noise so the logo reads as cohesive instead of chaotic.
  const bg = inverted ? "#082f2f" : "#06b6d4";
  const ring = inverted ? "#5eead4" : "#0e7490";
  const petal1 = "#22d3ee";   // cyan
  const petal2 = "#10b981";   // emerald
  const petal3 = "#34d399";   // mint
  const accent = "#f59e0b";   // amber spark
  const accent2 = "#6366f1";  // indigo deep-dot

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Core orb — three-stop teal→emerald cone */}
        <linearGradient id={`bk-orb-${idSuffix}`} x1="22%" y1="10%" x2="78%" y2="90%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor={petal1} />
          <stop offset="100%" stopColor={petal2} />
        </linearGradient>
        {/* Petal gradient — radial so the nested petals read as one bloom */}
        <radialGradient id={`bk-petals-${idSuffix}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={petal3} stopOpacity="0.9" />
          <stop offset="70%" stopColor={petal2} stopOpacity="0.55" />
          <stop offset="100%" stopColor={petal1} stopOpacity="0" />
        </radialGradient>
        {/* Soft inner glow under the orb */}
        <radialGradient id={`bk-glow-${idSuffix}`} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.55" />
          <stop offset="70%" stopColor={petal2} stopOpacity="0.1" />
          <stop offset="100%" stopColor={petal2} stopOpacity="0" />
        </radialGradient>
        <filter id={`bk-soft-${idSuffix}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* Outer ring — slow counter-rotating hairline track */}
      <circle cx="36" cy="36" r="33" fill="none" stroke={ring} strokeWidth="1.1" strokeOpacity="0.5" strokeDasharray="2 6">
        <animateTransform attributeName="transform" type="rotate" from="0 36 36" to="360 36 36" dur="14s" repeatCount="indefinite" />
      </circle>

      {/* Glow base */}
      <circle cx="36" cy="36" r="30" fill={`url(#bk-glow-${idSuffix})`} filter={`url(#bk-soft-${idSuffix})`} />

      {/* Four soft petals — animate to "bloom" / pulse, this is the main
          interactivity that draws the eye instead of a static flat icon */}
      <g fill={`url(#bk-petals-${idSuffix})`}>
        {[0, 45, 90, 135].map((rot) => (
          <ellipse
            key={rot}
            cx="36"
            cy="22"
            rx="9"
            ry="18"
            transform={`rotate(${rot} 36 36)`}
            opacity="0.85"
            style={{ transformOrigin: "36px 36px" }}
          >
            <animate
              attributeName="ry"
              values="17;19.5;17"
              dur="3.6s"
              begin={`${rot / 45 * 0.45}s`}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}
      </g>

      {/* Orbital travelers — two small dots travelling opposite directions
          around the ring bound it together */}
      <circle r="2.2" fill={accent}>
        <animateMotion dur="6.5s" repeatCount="indefinite" path="M 36 4 A 32 32 0 1 1 35.99 4" />
      </circle>
      <circle r="1.8" fill={accent2}>
        <animateMotion dur="6.5s" begin="-3.25s" repeatCount="indefinite" path="M 36 4 A 32 32 0 1 1 35.99 4" />
      </circle>

      {/* Core orb — jelly button with a glossy highlight */}
      <circle cx="36" cy="36" r="15" fill={`url(#bk-orb-${idSuffix})`} />
      <circle cx="36" cy="36" r="15" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* Gloss highlight */}
      <ellipse cx="31.5" cy="28.5" rx="7" ry="5" fill="#ffffff" opacity="0.45" transform="rotate(-25 31.5 28.5)" />

      {/* Center amber spark — slow breathe + rotate keeps the logo lively */}
      <g>
        <polygon
          points="36,28 37.4,33 42,33.6 38.4,35.6 39.6,40 36,37.6 32.4,40 33.6,35.6 30,33.6 34.6,33"
          fill="#ffffff"
          opacity="0.95"
        >
          <animateTransform attributeName="transform" type="rotate" from="0 36 36" to="360 36 36" dur="9s" repeatCount="indefinite" />
        </polygon>
        <circle cx="36" cy="36" r="2.5" fill={accent}>
          <animate attributeName="r" values="2.3;3.1;2.3" dur="2.6s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

class BrandMark3DBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export function BrandMark({
  size = 32,
  variant,
  className = "",
  idPrefix,
  rounded,
  inverted,
  tone,
}: {
  size?: number;
  variant?: "2d" | "3d";
  className?: string;
  idPrefix?: string;
  rounded?: number;
  inverted?: boolean;
  tone?: "green" | "ink" | "white";
}) {
  if (variant === "3d") {
    return (
      <BrandMark3DBoundary fallback={<BrandMark2D size={size} className={className} inverted={inverted} />}>
        <BrandMark3D size={size} />
      </BrandMark3DBoundary>
    );
  }
  return <BrandMark2D size={size} className={className} inverted={inverted || tone === "white"} />;
}
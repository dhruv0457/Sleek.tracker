"use client";

import { useId } from "react";

interface AvatarPlaceholderProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AvatarPlaceholder({ size = 64, className, style }: AvatarPlaceholderProps) {
  // useId() returns a stable id across SSR + hydration, so the SVG gradient
  // id matches on both server and client (fixes hydration mismatch warnings).
  const rawId = useId();
  const uid = `ap${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const h = size / 2;
  const headR = size * 0.14;
  const bodyW = size * 0.38;
  const bodyH = size * 0.22;
  const bodyY = h + headR + size * 0.02;

  const shouldersW = size * 0.48;
  const shouldersH = size * 0.08;
  const shouldersY = bodyY + bodyH - size * 0.01;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={style}
      aria-label="Profile placeholder"
    >
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx={h} cy={h} r={h - 2} fill={`url(#${uid}g)`} />
      <ellipse cx={h} cy={size * 0.30} rx={bodyW} ry={bodyH} fill="#ffffff99" />
      <ellipse cx={h} cy={shouldersY} rx={shouldersW} ry={shouldersH} fill="#ffffff99" />
      <circle cx={h} cy={h * 0.6} r={headR} fill="#ffffff" />
      <circle
        cx={h} cy={h} r={h - 1}
        fill="none"
        stroke="var(--line)"
        strokeWidth={size > 40 ? 2 : 1}
      />
    </svg>
  );
}
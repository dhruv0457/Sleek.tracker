"use client";

import React from "react";

interface PixarSceneProps {
  progress: number;   // 0..1
  completed: boolean;  // timer reached 0
  discarding: boolean; // user hit discard
}

export default function PixarScene({ progress, completed, discarding }: PixarSceneProps) {
  const p = Math.min(1, Math.max(0, progress));
  const isDone = completed && p >= 1;
  const isDiscard = discarding;

  // ─── Derived animation values ───
  const skyTop = lerpColor("#6b7ea0", p < 0.3 ? "#6b7ea0" : "#4fc3f7", Math.min(1, p * 2));
  const skyBot = lerpColor("#8e9bb0", p < 0.3 ? "#8e9bb0" : "#e0f2fe", Math.min(1, p * 2));
  const treeScale = Math.min(1, Math.max(0, (p - 0.35) * 1.6));
  const trophyY = isDone ? 30 : 120;
  const trophyO = isDone ? 1 : 0;
  const meteorX = isDiscard ? 600 : 900;
  const meteorO = isDiscard ? 1 : 0;

  return (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBot} />
        </linearGradient>
        <linearGradient id="riverGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="mtnDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes treeSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(1.5deg); } 75% { transform: rotate(-1deg); } }
        @keyframes birdFly { 0% { transform: translate(0,0); } 25% { transform: translate(30px,-14px); } 50% { transform: translate(60px,0); } 75% { transform: translate(30px,14px); } 100% { transform: translate(0,0); } }
        @keyframes riverRipple { 0% { transform: translateX(0); opacity: 0.7; } 50% { transform: translateX(8px); opacity: 1; } 100% { transform: translateX(0); opacity: 0.7; } }
        @keyframes riverFlow { 0% { transform: translateY(0); } 100% { transform: translateY(12px); } }
        @keyframes trophyDrop { 0% { transform: translateY(-80px); opacity: 0; } 60% { transform: translateY(10px); opacity: 1; } 80% { transform: translateY(-4px); } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes meteorStrike { 0% { transform: translate(600px,-200px) rotate(45deg); opacity: 1; } 100% { transform: translate(200px,400px) rotate(45deg); opacity: 0; } }
        @keyframes boomFlash { 0% { opacity: 0; transform: scale(0); } 30% { opacity: 1; transform: scale(3); } 100% { opacity: 0; transform: scale(5); } }
        @keyframes fishFloat { 0%, 100% { transform: translate(0,0); } 25% { transform: translate(12px,-4px) rotate(3deg); } 50% { transform: translate(24px,2px) rotate(-2deg); } 75% { transform: translate(12px,0) rotate(1deg); } }
        @keyframes butterflyRunway { 0% { transform: translateX(180px) translateY(0); } 30% { transform: translateX(300px) translateY(-20px); } 60% { transform: translateX(500px) translateY(-8px); } 80% { transform: translateX(650px) translateY(-25px); } 100% { transform: translateX(800px) translateY(-12px); } }
        @keyframes waterShimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        
        @keyframes deerRun { 0% { transform: translateX(860px); } 30% { transform: translateX(400px); } 45% { transform: translateX(350px) translateY(-8px); } 60% { transform: translateX(280px); } 75% { transform: translateX(200px); } 100% { transform: translateX(100px); } }
        @keyframes deerRun2 { 0% { transform: translateX(60px); } 30% { transform: translateX(200px); } 50% { transform: translateX(400px); } 80% { transform: translateX(550px); } 100% { transform: translateX(800px); } }
        .t-sway { transform-origin: 0 100%; animation: treeSway 4s ease-in-out infinite; }
        .t-sway2 { transform-origin: 0 100%; animation: treeSway 4.5s ease-in-out infinite 0.3s; }
        .t-sway3 { transform-origin: 0 100%; animation: treeSway 5s ease-in-out infinite 0.7s; }
        .bird { animation: birdFly 2.5s ease-in-out infinite alternate; }
        .bird2 { animation: birdFly 3.2s ease-in-out -0.8s infinite alternate; }
        .river-line { animation: riverRipple 2s ease-in-out infinite alternate; }
        .river-flow { animation: riverFlow 3s ease-in-out infinite alternate; }
        .shimmer { animation: waterShimmer 2s ease-in-out infinite alternate; }
        .trophy-anim { animation: trophyDrop 0.8s cubic-bezier(.22,1,.36,1) forwards; }
        .meteor-anim { animation: meteorStrike 1.2s ease-in forwards; }
        .boom-anim { animation: boomFlash 0.6s ease-out forwards; }
        .fish-anim { animation: fishFloat 4s ease-in-out infinite; }
        .fish-anim2 { animation: fishFloat 3.5s ease-in-out infinite 1.5s; }
        .butterfly-anim { animation: butterflyRunway 3s ease-in-out infinite alternate; }
        .deer-run { animation: deerRun 8s ease-in-out infinite; }
        .deer-run2 { animation: deerRun2 7.5s ease-in-out infinite 2s; }
        .deer-body { fill: #c27a40; }
        .deer-spot { fill: #f5deb3; }
        .deer-leg { fill: #8b5e3c; }
      `}</style>

      {/* Sky */}
      <rect x="0" y="0" width="800" height="400" fill="url(#sky)" />

      {/* White clouds (appear 0.3+) */}
      {p > 0.4 && (
        <>
          <g>
            <ellipse cx="180" cy="70" rx="45" ry="20" fill="#fff" opacity={Math.min(1, (p - 0.4) * 5)} />
            <ellipse cx="200" cy="58" rx="30" ry="16" fill="#fff" opacity={Math.min(1, (p - 0.4) * 5)} />
          </g>
          <g>
            <ellipse cx="620" cy="50" rx="55" ry="22" fill="#fff" opacity={Math.min(1, (p - 0.45) * 5)} />
            <ellipse cx="640" cy="48" rx="35" ry="18" fill="#fff" opacity={Math.min(1, (p - 0.45) * 5)} />
          </g>
        </>
      )}

      {/* Mountains */}
      <polygon points="0,280 120,150 280,280" fill={p > 0.3 ? "#4b5563" : "#4b5563"} />
      <polygon points="150,280 340,110 500,280" fill="#374151" />
      <polygon points="380,280 570,140 750,280" fill="#4b5563" />
      <polygon points="500,280 700,180 800,280" fill="#374151" />

      {/* Snowcaps on tall mountains (0.7+) */}
      {p > 0.6 && (
        <polygon points="330,15 340, 110 345,55 360,115 370,20" fill="#fff" opacity={Math.min(1, (p - 0.6) * 5)} />
      )}

      {/* River (wider, animated flow) */}
      {p > 0.45 && (
        <g opacity={Math.min(1, (p - 0.45) * 4)}>
          {/* River water body */}
          <path d="M360,160 Q380,175 395,195 Q410,240 440,280 Q470,330 410,420" fill="#3b82f6" opacity={0.85} className="river-flow" />
          <path d="M362,160 Q385,180 398,200 Q415,248 445,285 Q472,335 412,420" fill="#60a5fa" opacity={0.6} className="river-flow" />
          {/* Shimmer lines */}
          <path d="M363,200 Q390,220 420,240" fill="none" stroke="#93c5fd" strokeWidth={1.5} className="shimmer" />
          <path d="M370,260 Q400,280 425,305" fill="none" stroke="#93c5fd" strokeWidth={1} className="shimmer" />
          <path d="M375,320 Q405,340 430,365" fill="none" stroke="#93c5fd" strokeWidth={1.2} className="shimmer" />
          {/* Fish */}
          <g className="fish-anim" opacity={Math.min(1, (p - 0.5) * 3)}>
            <ellipse cx="410" cy="235" rx="8" ry="3" fill="#fbbf24" />
            <polygon points="402,235 394,230 394,240" fill="#fbbf24" />
            <circle cx="413" cy="234" r="1" fill="#1d1d1f" />
          </g>
          <g className="fish-anim2" opacity={Math.min(1, (p - 0.55) * 3)}>
            <ellipse cx="385" cy="310" rx="6" ry="2.5" fill="#f472b6" />
            <polygon points="379,310 373,306 373,314" fill="#f472b6" />
            <circle cx="387" cy="309" r="0.8" fill="#1d1d1f" />
          </g>
        </g>
      )}

      {/* Ground plane */}
      <rect x="0" y="280" width="800" height="120" fill={p > 0.3 ? "#4ade80" : "#6b7280"} />

      {/* Grass patches (appear progressively) */}
      {p > 0.25 && (
        <>
          <rect x="50" y="275" width="40" height="20" rx="4" fill="#22c55e" opacity={Math.min(1, (p - 0.25) * 4)} />
          <rect x="200" y="272" width="30" height="18" rx="4" fill="#16a34a" opacity={Math.min(1, (p - 0.28) * 4)} />
          <rect x="480" y="276" width="50" height="20" rx="4" fill="#22c55e" opacity={Math.min(1, (p - 0.3) * 4)} />
          <rect x="650" y="270" width="38" height="22" rx="4" fill="#15803d" opacity={Math.min(1, (p - 0.32) * 4)} />
        </>
      )}

      {/* Tree 1 */}
      {p > 0.35 && (
        <g transform={`translate(100,200) scale(${treeScale})`} className={p > 0.6 ? "t-sway" : ""}>
          <rect x="-5" y="20" width="10" height="60" fill="#78350f" rx={2} />
          <polygon points="-30,20 0,-40 30,20" fill="#166534" />
          <polygon points="-22,-5 0,-50 22,-5" fill="#15803d" />
        </g>
      )}

      {/* Tree 2 */}
      {p > 0.42 && (
        <g transform={`translate(260,190) scale(${Math.min(1, (p - 0.42) * 1.5)})`} className={p > 0.6 ? "t-sway2" : ""}>
          <rect x="-4" y="20" width="8" height="70" fill="#78350f" rx={2} />
          <polygon points="-28,20 0,-45 28,20" fill="#22c55e" />
          <polygon points="-20,-30 0,-50 20,-30" fill="#16a34a" />
        </g>
      )}

      {/* Tree 3 (small) */}
      {p > 0.5 && (
        <g transform={`translate(470,210) scale(${Math.min(p * 1.2, 1)})`} className={p > 0.65 ? "t-sway3" : ""}>
          <rect x="-3" y="20" width="6" height="50" fill="#5d2e0c" rx={1} />
          <polygon points="-20,20 0,-30 20,20" fill="#4ade80" />
        </g>
      )}

      {/* Tree 4 (tall pine) */}
      {p > 0.55 && (
        <g transform={`translate(630,170) scale(${Math.min((p - 0.55) * 1.5, 1)})`} className={p > 0.7 ? "t-sway" : ""}>
          <rect x="-4" y="30" width="8" height="80" fill="#5d4037" rx={2} />
          <polygon points="-30,30 0,-10 30,30" fill="#15803d" />
          <polygon points="-26,10 0,-30 26,10" fill="#16a34a" />
          <polygon points="-22,-12 0,-50 22,-12" fill="#22c55e" />
        </g>
      )}

      {/* Flowers bloom (phase 4) */}
      {p > 0.75 && (
        <>
          <circle cx="70" cy="260" r="4" fill="#facc15" />
          <circle cx="80" cy="255" r="3" fill="#eab308" />
          <circle cx="500" cy="258" r="3.5" fill="#facc15" />
          <circle cx="720" cy="255" r="4" fill="#fef08a" />
        </>
      )}

      {/* Birds (phase 3) */}
      {p > 0.55 && (
        <g className="bird" opacity={Math.min(1, (p - 0.55) * 4)}>
          <path d="M 300,80 Q 305,72 310,80" fill="none" stroke="#374151" strokeWidth={1.5} />
          <path d="M 330,90 Q 335,82 340,90" fill="none" stroke="#374151" strokeWidth={1.5} />
        </g>
      )}
      {p > 0.62 && (
        <g className="bird2" opacity={Math.min(1, (p - 0.62) * 4)}>
          <path d="M 550,55 Q 555,47 560,55" fill="none" stroke="#374151" strokeWidth={1.5} />
          <path d="M 580,62 Q 585,54 590,62" fill="none" stroke="#374151" strokeWidth={1.5} />
        </g>
      )}

      {/* Butterfly (phase 3.5) */}
      {p > 0.65 && (
        <g className="butterfly-anim" opacity={Math.min(1, (p - 0.65) * 4)}>
          <g transform="translate(0, 160)">
            <ellipse cx="-5" cy="0" rx="5" ry="3" fill="#f59e0b" opacity={0.75} className="butterfly-wing" />
            <ellipse cx="5" cy="0" rx="5" ry="3" fill="#3b82f6" opacity={0.7} className="butterfly-wing" />
            <ellipse cx="-3" cy="-4" rx="3.5" ry="2.5" fill="#eab308" opacity={0.8} className="butterfly-wing" />
            <ellipse cx="3" cy="-4" rx="3.5" ry="2.5" fill="#2563eb" opacity={0.75} className="butterfly-wing" />
            <rect x="-0.5" y="0" width="1" height="8" rx="0.5" fill="#451a03" />
          </g>
        </g>
      )}

      {/* Deer running across the scene */}
      {p > 0.58 && (
        <g className="deer-run" opacity={Math.min(1, (p - 0.58) * 4)}>
          {/* Body */}
          <ellipse cx="200" cy="255" rx="14" ry="10" className="deer-body" />
          {/* Head */}
          <ellipse cx="180" cy="244" rx="7" ry="5" className="deer-body" />
          <circle cx="183" cy="242" r="1.2" fill="#1d1d1f" /> {/* eye */}
          {/* Antlers */}
          <path d="M176,239 Q172,228 168,226" fill="none" stroke="#5d4037" strokeWidth={1.5} />
          <path d="M176,239 Q180,230 178,225" fill="none" stroke="#5d4037" strokeWidth={1.5} />
          {/* Legs */}
          <rect x="192" y="262" width="3" height="12" rx="1" className="deer-leg" />
          <rect x="202" y="262" width="3" height="12" rx="1" className="deer-leg" />
          <rect x="210" y="260" width="3" height="14" rx="1" className="deer-leg" />
          <rect x="198" y="260" width="3" height="14" rx="1" className="deer-leg" />
          {/* Tail */}
          <circle cx="215" cy="252" r="3" fill="#fff" opacity={0.8} />
          {/* Spots */}
          <circle cx="198" cy="252" r="1.5" className="deer-spot" />
          <circle cx="206" cy="256" r="1" className="deer-spot" />
          <circle cx="200" cy="260" r="1.2" className="deer-spot" />
        </g>
      )}
      {p > 0.63 && (
        <g className="deer-run2" opacity={Math.min(1, (p - 0.63) * 4)}>
          <ellipse cx="150" cy="248" rx="12" ry="8" className="deer-body" />
          <ellipse cx="134" cy="238" rx="6" ry="4" className="deer-body" />
          <circle cx="136" cy="237" r="1" fill="#1d1d1f" />
          <path d="M128,235 L125,225 L129,224" fill="none" stroke="#5d4037" strokeWidth={1.2} />
          <path d="M128,235 L131,227 L133,226" fill="none" stroke="#5d4037" strokeWidth={1.2} />
          <rect x="142" y="254" width="2.5" height="10" rx="0.8" className="deer-leg" />
          <rect x="150" y="254" width="2.5" height="10" rx="0.8" className="deer-leg" />
          <rect x="156" y="252" width="2.5" height="12" rx="0.8" className="deer-leg" />
          <rect x="146" y="252" width="2.5" height="12" rx="0.8" className="deer-leg" />
          <circle cx="140" cy="248" r="1" className="deer-spot" />
          <circle cx="148" cy="250" r="1.2" className="deer-spot" />
        </g>
      )}

      {/* Trophy banner (on completion) */}
      {isDone && (
        <g transform={`translate(380,${trophyY})`} opacity={trophyO} className="trophy-anim">
          <rect x="-60" y="-22" width="120" height="36" rx="8" fill="#facc15" stroke="#eab308" strokeWidth={2} />
          <polygon points="0,-14 -14,14 14,14" fill="#f59e0b" />
          <text x="0" y="-2" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1d1d1f">FOCUS COMPLETE!</text>
          <text x="0" y="12" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">+1 Trophy</text>
        </g>
      )}

      {/* Meteor strike (on discard) */}
      {isDiscard && (
        <>
          <g transform={`translate(${meteorX},-100)`} opacity={meteorO} className="meteor-anim">
            <circle cx="0" cy="0" r="14" fill="#dc2626" />
            <circle cx="0" cy="0" r="10" fill="#f97316" />
            <path d="M 14,0 Q 40,-15 60,-10" fill="none" stroke="#ef4444" strokeWidth={6} strokeDasharray="4 12" />
            <path d="M 10,5 Q 35,0 55,5" fill="none" stroke="#fbbf24" strokeWidth={3} strokeDasharray="3 8" />
            {/* Boom */}
            <g className="boom-anim">
              <circle cx="200" cy="250" r="25" fill="#dc2626" opacity={0.6} />
              <circle cx="200" cy="250" r="14" fill="#f97316" opacity={0.8} />
              <circle cx="200" cy="250" r="6" fill="#fbbf24" />
            </g>
          </g>
          <g transform="translate(380, 120)" opacity={meteorO} className="trophy-anim">
            <rect x="-65" y="-22" width="130" height="36" rx="8" fill="#dc2626" stroke="#ef4444" strokeWidth={2} />
            <text x="0" y="-2" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">DISCARDED</text>
            <text x="0" y="12" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ef4444">-1 Trophy</text>
          </g>
        </>
      )}
    </svg>
  );
}

function lerpColor(a: string, b: string, t: number): string {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  if (!aa || !bb) return a;
  const r = Math.round(aa.r + (bb.r - aa.r) * t);
  const g = Math.round(aa.g + (bb.g - aa.g) * t);
  const bl = Math.round(aa.b + (bb.b - aa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
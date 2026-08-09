"use client";

import { useEffect, useRef, useState } from "react";

export default function LandingHero({
  headline, sub, cta, secondary, onPrimary, onSecondary
}: {
  headline: React.ReactNode; sub: string; cta: string; secondary: string;
  onPrimary: () => void; onSecondary: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollT, setScrollT] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [heroExited, setHeroExited] = useState(false);

  const state = useRef({
    stars: [] as {x:number;y:number;r:number;twPhase:number;twSpeed:number;col:string}[],
    sparks: [] as {x:number;y:number;vx:number;vy:number;life:number;maxLife:number;r:number;col:string}[],
    orbiters: [] as {angle:number;dist:number;r:number;col:string;speed:number}[],
    blobs: [] as {x:number;y:number;r:number;vx:number;vy:number;col:string;alpha:number}[],
    t: 0, scrollT: 0, pointerX: 0, pointerY: 0
  });

  useEffect(() => {
    const st = state.current;
    for (let i = 0; i < 280; i++) {
      const col = Math.random() < 0.5 ? "#ffffff" : (Math.random() < 0.35 ? "#60a5fa" : "#22d3ee");
      st.stars.push({
        x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.2,
        twPhase: Math.random() * Math.PI * 2,
        twSpeed: 0.6 + Math.random() * 1.6, col
      });
    }
    for (let i = 0; i < 26; i++) {
      st.orbiters.push({
        angle: (i * 2.4 + Math.random() * 1.2) % (Math.PI * 2),
        dist: 0.94 + Math.random() * 0.3,
        r: 1.8 + Math.random() * 2.5,
        col: ["#60a5fa", "#22d3ee", "#ffffff","#3b82f6","#06b6d4","#34d399","#6ee7b7"][i % 7],
        speed: 0.3 + Math.random() * 0.5
      });
    }
    // Colorful floating blobs for background candy
    const blobColors = [
      { r: 59, g: 130, b: 246 },  // blue
      { r: 6, g: 182, b: 212 },   // cyan
      { r: 52, g: 211, b: 153 },   // green
      { r: 96, g: 165, b: 250 },  // sky
      { r: 34, g: 211, b: 238 },   // cyan
    ];
    for (let i = 0; i < 5; i++) {
      const c = blobColors[i];
      st.blobs.push({
        x: 0.2 + Math.random() * 0.6,
        y: 0.3 + Math.random() * 0.4,
        r: 80 + Math.random() * 180,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        col: `rgba(${c.r},${c.g},${c.b},`,
        alpha: 0.08 + Math.random() * 0.1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let raf = 0;
    const upd = () => {
      raf = requestAnimationFrame(() => {
        const h = wrapRef.current?.offsetHeight ?? window.innerHeight;
        const t = Math.min(1, Math.max(0, window.scrollY / h));
        setScrollT(t);
        setHeroExited(t >= 0.85);
        state.current.scrollT = t;
      });
    };
    const onMove = (e: PointerEvent) => {
      state.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      state.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      setPointer({ x: state.current.pointerX, y: state.current.pointerY });
    };
    window.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    upd();
    return () => { window.removeEventListener("scroll", upd); window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    let raf = 0; let last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr * 1, 0, 0, dpr * 1, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      state.current.t += dt / 1000;

      const W = canvas.clientWidth; const H = canvas.clientHeight;
      const s = state.current.scrollT;
      const t = state.current.t;
      const px = state.current.pointerX * W * 0.16;

      ctx.fillStyle = `rgba(6, 6, 12, ${1 - s * 0.22})`;
      ctx.fillRect(0, 0, W, H);

      // Floating colorful blobs in background
      for (const blob of state.current.blobs) {
        blob.x += blob.vx * (dt / 1200);
        blob.y += blob.vy * (dt / 1200);
        if (blob.x < -0.3 || blob.x > 1.3) blob.vx *= -1;
        if (blob.y < -0.3 || blob.y > 1.3) blob.vy *= -1;
        const bx = blob.x * W;
        const by = blob.y * H;
        const a = blob.alpha * (1 - s * 0.4);
        if (a > 0.01) {
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, blob.r);
          g.addColorStop(0, blob.col + String(a * 1.4) + ")");
          g.addColorStop(0.6, blob.col + String(a * 0.5) + ")");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
      }

      const moonY = H * 0.62 - s * H * 1.35;
      const moonX = W * 0.5 + px;
      const moonR = Math.min(W, H) * 0.22;
      const light = Math.sin(Math.min(Math.PI, s * 2.6)) * 0.9;

      if (light > 0.02) {
        {
          const g = ctx.createRadialGradient(moonX, moonY, moonR * 1.1, moonX, moonY, moonR * 5.5);
          g.addColorStop(0, `rgba(125, 211, 252, ${0.55 * light})`);
          g.addColorStop(0.35, `rgba(56, 189, 248, ${0.32 * light})`);
          g.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        {
          const g = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3.2);
          g.addColorStop(0, `rgba(110, 231, 183, ${0.72 * light})`);
          g.addColorStop(0.45, `rgba(52, 211, 153, ${0.38 * light})`);
          g.addColorStop(1, "rgba(52, 211, 153, 0)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
      }

      for (const st of state.current.stars) {
        const sy = (st.y - s * 0.08) % 1;
        const sw = st.twPhase + t * st.twSpeed;
        const alpha = 0.28 + Math.abs(Math.sin(sw)) * 0.68;
        const r = Math.max(0.4, st.r * (1 - s * 0.15));
        ctx.fillStyle = st.col === "white" || st.col === "#ffffff"
          ? `rgba(255, 255, 255, ${alpha})`
          : st.col === "#60a5fa" || st.col === "#3b82f6"
            ? `rgba(125, 211, 252, ${alpha})`
            : `rgba(110, 231, 183, ${alpha})`;
        ctx.beginPath();
        ctx.arc(st.x * W, sy * H, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 1.08, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 245, 247, ${0.04 + light * 0.14})`; ctx.fill();

      const bA = 0.92 + s * 0.06;
      ctx.fillStyle = `rgba(252, 252, 255, ${bA})`;
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();

      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.arc(moonX + moonR * 0.44, moonY - moonR * 0.25, moonR * 0.88, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      for (const orb of state.current.orbiters) {
        orb.angle += orb.speed * (dt / 1000);
        const dist = orb.dist * moonR * 1.05;
        const ox = moonX + Math.cos(orb.angle) * dist;
        const oy = moonY + Math.sin(orb.angle) * dist * 0.5;
        const alpha = 0.25 + light * 0.6;
        ctx.fillStyle = orb.col === "#ffffff" ? `rgba(255, 255, 255, ${alpha})`
          : orb.col === "#60a5fa" || orb.col === "#3b82f6" ? `rgba(96, 165, 250, ${alpha})`
          : orb.col === "#34d399" || orb.col === "#6ee7b7" ? `rgba(52, 211, 153, ${alpha})`
          : `rgba(110, 231, 183, ${alpha})`;
        ctx.beginPath(); ctx.arc(ox, oy, orb.r * (0.5 + light * 0.5), 0, Math.PI * 2); ctx.fill();
      }

      const sparks = state.current.sparks;
      const spawnRate = Math.min(7, s * 10);
      for (let i = 0; i < spawnRate; i++) {
        const col = Math.random() < 0.35 ? "#ffffff" : (Math.random() < 0.4 ? "#60a5fa" : "#22d3ee");
        sparks.push({
          x: moonX + (Math.random() - 0.5) * moonR * 1.8,
          y: moonY + (Math.random() - 0.5) * moonR * 1.5,
          vx: (Math.random() - 0.5) * 0.7,
          vy: -(0.8 + Math.random() * 1.4),
          life: 0, maxLife: 0.9 + Math.random() * 1.8,
          r: 0.8 + Math.random() * 3.5, col
        });
        if (sparks.length > 500) sparks.shift();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt / 1000;
        if (sp.life > sp.maxLife) { sparks.splice(i, 1); continue; }
        sp.x += sp.vx * (dt / 16); sp.y += sp.vy * (dt / 16);
        sp.vy -= 0.003 * dt / 16;
        const a = (1 - sp.life / sp.maxLife) * 0.85;
        const col = sp.col === "#ffffff"
          ? `rgba(255, 255, 255, ${a})`
          : sp.col === "#60a5fa"
            ? `rgba(125, 211, 252, ${a})`
            : `rgba(110, 231, 183, ${a})`;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  // eslint-disable-next-line
  }, []);

  return (
    <section ref={wrapRef} className="relative w-full overflow-hidden" style={{ height: "100svh", background: "#06060c" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      <div
        className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center pointer-events-none"
        style={{
          transform: `translate3d(${pointer.x * 10}px, ${pointer.y * 6}px, 0) scale(${1 - scrollT * 0.06})`,
          transition: "transform .22s cubic-bezier(.22,1,.36,1)", opacity: heroExited ? 0 : 1
        }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-xl bg-white/8 backdrop-blur-md border border-white/15 text-[11px] font-medium tracking-wide animate-fade-up" style={{ color: "#e5e5ea" }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#22d3ee", animation: "pulse 2s infinite" }} />
          Free forever · No ads · Privacy-first
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-[88px] font-semibold tracking-tight leading-[1.04] text-white" style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}>
          {headline}
        </h1>

        <p className="mt-7 text-lg sm:text-xl max-w-2xl leading-relaxed" style={{ color: "#d2d2d7", textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}>
          {sub}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
          <button onClick={onPrimary} className="group relative px-6 py-3 rounded-xl font-medium text-[15px] text-[#1d1d1f] transition-all hover:scale-[1.03] active:scale-[0.97] focus:outline-none overflow-hidden" style={{ background: "linear-gradient(135deg, #60a5fa, #3b82f6, #22d3ee, #06b6d4)", backgroundSize: "200% 200%" }}>
            <span className="relative z-10 text-white">{cta}&nbsp;→</span>
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #22d3ee, #06b6d4, #3b82f6, #60a5fa)", backgroundSize: "200% 200%" }} />
          </button>
          <button onClick={onSecondary} className="px-6 py-3 rounded-xl text-white font-medium text-[15px] border border-white/25 backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.97] hover:bg-white/10 focus:outline-none">
            {secondary}
          </button>
        </div>

        <p className="mt-7 text-[12px] text-[#8e8e93]">No credit card · Sign up in 30 seconds · 2-day premium trial auto-applies</p>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none" style={{ opacity: Math.max(0, 1 - scrollT * 3) }}>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/55">Scroll to light up</span>
        <div className="h-8 w-5 rounded-xl border border-white/30 flex justify-center pt-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-bounce" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(6,6,12,0) 0%, #ffffff 100%)" }} />
    </section>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";

/* Apple-style scroll-reveal + scroll-progress.
 *
 * Two behaviours:
 *
 * 1. Anyone adding `data-reveal` to an element gets `.reveal`+`.is-in` toggling
 *    when it enters the viewport (one-shot fade-up + blur-clear).
 *
 * 2. Anyone wanting CONTINUOUS scroll progress (so content tied to scroll
 *    position like Apple's product-page "video" effect) reads the CSS var
 *    `--reveal` (0..1) on a scroll-measured element. Add `data-reveal-progress`
 *    to opt in; the hook updates `--reveal` continuously as that element
 *    transits the viewport (0 = top of element hitting bottom of viewport,
 *    1 = bottom of element reaching top of viewport).
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    /* ---------- one-shot reveal ---------- */
    const revEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    ).map((el) => {
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
      const d = el.dataset.revealDelay;
      const s = el.dataset.revealScale;
      if (d) el.style.transitionDelay = `${d}ms`;
      if (s === "true") el.classList.add("reveal-scale");
      return el;
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    /* ---------- continuous scroll-progress ---------- */
    const progEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal-progress]")
    );

    let raf = 0;
    const updateProgress = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of progEls) {
        const rect = el.getBoundingClientRect();
        // total travel from "bottom of element hits bottom of viewport" (just
        // below) → "top of element hits top of viewport" (just above).
        // 0 → element mid-entirely-below, 1 → element fully above.
        const start = vh;            // element bottom = viewport bottom
        const end = -rect.height;    // element top = viewport top
        const travel = start - end;   // distance over which progress goes 0..1
        if (travel <= 0) continue;
        const cur = start - rect.top; // how far we've scrolled past "start"
        const t = Math.min(1, Math.max(0, cur / travel));
        el.style.setProperty("--reveal", t.toFixed(3));
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateProgress);
    };

    if (reduce) {
      // Reduce-motion users: skip the animation, but still set progress to 1.
      revEls.forEach((el) => el.classList.add("is-in"));
      progEls.forEach((el) => el.style.setProperty("--reveal", "1"));
      return;
    }

    revEls.forEach((el) => io.observe(el));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateProgress();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
}

"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

/**
 * Mount-entrance animations powered by anime.js (no flash; only runs on client).
 * Usage: <div data-animate="fade-up">...</div> → animates in on mount.
 */
export function useAnimateOnMount<T extends HTMLElement = HTMLDivElement>(): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { root.querySelectorAll("[data-animate]").forEach((el) => el.classList.add("is-animated")); return; }

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-animate]"));
    items.forEach((el, i) => {
      const kind = el.getAttribute("data-animate") || "fade-up";
      if (kind === "fade-up") {
        anime({
          targets: el,
          translateY: [12, 0],
          opacity: [0, 1],
          duration: 560,
          delay: i * 60,
          easing: "easeOutCubic",
          begin: () => el.classList.add("is-animated")
        });
      } else if (kind === "pop") {
        anime({
          targets: el,
          scale: [0.85, 1],
          opacity: [0, 1],
          duration: 420,
          delay: i * 40,
          easing: "easeOutBack",
          begin: () => el.classList.add("is-animated")
        });
      } else if (kind === "draw") {
        const paths = el.querySelectorAll("path, polyline, circle, rect, line");
        anime({
          targets: Array.from(paths),
          opacity: [0, 1],
          duration: 900,
          delay: anime.stagger(120, { start: i * 80 }),
          easing: "easeInOutSine"
        });
      }
    });
  }, []);
  return ref;
}

/** Animate a numeric counter (used on trophy counter / stat tiles). */
export function animateNumber(el: HTMLElement, from: number, to: number, ms = 900): void {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = String(to);
    return;
  }
  const obj = { v: from };
  anime({
    targets: obj,
    v: to,
    duration: ms,
    easing: "easeOutCubic",
    update: () => { el.textContent = String(Math.round(obj.v)); }
  });
}

"use client";

import { useEffect } from "react";

/**
 * Reads the persisted theme from localStorage and applies it to <html> as
 * data-theme="light"|"dark". Persisted by the SettingsPanel toggle and the
 * /api/auth/me response. Renders nothing — this is a side-effect only.
 *
 * We read from localStorage (not the API) so the theme flash is avoided on
 * first paint: the SettingsPanel writes to localStorage on every change.
 */
export function ThemeBootstrap() {
  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem("theme")) || "light";
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);
  return null;
}

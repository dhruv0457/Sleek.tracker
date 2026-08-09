import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* sleek — Apple-inspired black + white + green/blue/yellow accents */
        bg: { DEFAULT: "#ffffff", 2: "#f5f5f7" },
        ink: { DEFAULT: "#1d1d1f", soft: "#424245", muted: "#6e6e73" },
        line: { DEFAULT: "#d2d2d7", soft: "#e5e5ea" },
        /* Aliases for legacy class names so existing components don't break */
        cream: { 100: "#ffffff", 200: "#f5f5f7", 300: "#e5e5ea" },
        accent: { DEFAULT: "#2563eb", soft: "#eff6ff" },

        /* Green */
        green: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
          400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857"
        },
        /* Blue — primary interactive */
        blue: {
          50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
          400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e3a8a", 900: "#172554"
        },
        /* Yellow */
        yellow: {
          50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047",
          400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207"
        },

        /* Kept for back-compat — mapped onto neutrals so stray uses don't render
           pink/purple/coral anywhere by accident. */
        gold: { 100: "#fef9c3", 300: "#fde047", 500: "#eab308", 600: "#ca8a04" },
        coral: { 100: "#fff7ed", 500: "#6e6e73" },
        pink: { 50: "#f5f5f7", 100: "#e5e5ea", 200: "#d2d2d7", 300: "#8e8e93", 400: "#6e6e73", 500: "#424245", 600: "#1d1d1f", 700: "#000000" },
        purple: { 50: "#f5f5f7", 100: "#e5e5ea", 200: "#d2d2d7", 300: "#8e8e93", 400: "#6e6e73", 500: "#424245", 600: "#1d1d1f", 700: "#000000", 800: "#1d1d1f", 900: "#000000" },
        indigo: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e3a8a", 900: "#172554" },
        sky: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
        amber: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207" }
      },
      fontFamily: {
        /* SF Pro stack first — matches Apple where available */
        sans:  ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "\"SF Pro Display\"", "\"SF Pro Text\"", "\"Segoe UI\"", "Roboto", "Helvetica", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Source Serif 4", "Georgia", "serif"],
        mono:  ["var(--font-mono)", "\"SF Mono\"", "\"IBM Plex Mono\"", "ui-monospace", "monospace"]
      },
      borderRadius: {
        DEFAULT: "12px",
        sm: "8px", md: "12px", lg: "18px", xl: "22px", "2xl": "28px", pill: "980px"
      },
      boxShadow: {
        none: "none",
        card: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.04)",
        glow: "0 0 0 3px var(--blue-100)",
        aurora: "0 8px 24px rgba(0,0,0,.18)"
      },
      backgroundImage: {
        "grad-aurora": "linear-gradient(180deg, #1d1d1f 0%, #2a2a2e 100%)",   /* aliased to ink */
        "grad-forest": "linear-gradient(180deg, #ffffff 0%, #f5f5f7 100%)",   /* aliased to paper */
        "grad-night":  "linear-gradient(180deg, #0a0a0c 0%, #000000 100%)"
      }
    }
  },
  plugins: []
};
export default config;

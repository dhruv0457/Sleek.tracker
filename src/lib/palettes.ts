// ============================================================
// Habit palettes — everyday.app streak-intensity color system.
// Every habit gets one base palette. Each day the habit is completed,
// the cell's shade moves one step darker within that palette. A missed
// day (white) BREAKS the streak and resets the shade to level 1 on the
// next completion. A skipped day (light gray) PAUSES the streak — the
// streak survives and the shade continues counting through it.
// ============================================================

export const MAX_LEVEL = 6;

// Exact hex values sampled from the everyday.app reference screenshot.
export const PALETTES: Record<string, string[]> = {
    green: [
        "#b2fc9f", // level 1 — just started
        "#62ec43", // level 2
        "#40d229", // level 3
        "#35b721", // level 4
        "#2d9d1b", // level 5
        "#268316", // level 6 — long streak (20+ days)
    ],
    blue: [
        "#b2edfe",
        "#7fe0fd",
        "#48cffd",
        "#44b9fc",
        "#35a5fc",
        "#2789d8", // extended to 6 for parity
    ],
    yellow: [
        "#fef5a0",
        "#fee55e",
        "#fed431",
        "#fdc02e",
        "#fdac2b",
        "#e07e14",
    ],
    purple: [
        "#e0d4ff",
        "#c4a8ff",
        "#a67Aff",
        "#8b5cf6",
        "#7c3aed",
        "#6d28d9",
    ],
    red: [
        "#ffd0d0",
        "#ff9e9e",
        "#f87171",
        "#ef4444",
        "#dc2626",
        "#b91c1c",
    ],
    teal: [
        "#ccfbf1",
        "#5eead4",
        "#2dd4bf",
        "#14b8a6",
        "#0d9488",
        "#0f766e",
    ],
    pink: [
        "#fce7f3",
        "#f9a8d4",
        "#f472b6",
        "#ec4899",
        "#db2777",
        "#be185d",
    ],
};

// Badge ring strokes per family (when current streak == longest streak).
export const RING_COLORS: Record<string, string> = {
    green: "#2d9c1b",
    blue: "#2e9bfc",
    yellow: "#fd9928",
    purple: "#7c3aed",
    red: "#dc2626",
    teal: "#0d9488",
    pink: "#db2777",
};

export const EMPTY_WHITE = "#ffffff";   // missed — breaks streak
export const SKIP_GRAY = "#f6f6f6";     // skipped — streak survives

// All 7 habit color family keys.
export const ALL_FAMILIES = ["green", "blue", "yellow", "purple", "red", "teal", "pink"] as const;
export type ColorFamily = (typeof ALL_FAMILIES)[number];

// Map a custom hex color to the closest palette family by hue.
export function familyFromHex(hex: string): ColorFamily {
    const h = hex.toLowerCase();
    // very rough — for richer implementation you'd compute RGB distance,
    // but the starter habits use a few common greens.
    if (h === "#22a558" || h.startsWith("#16") || h.startsWith("#0f") || h.startsWith("#2d")) return "green";
    if (h.startsWith("#25") || h.startsWith("#35") || h.startsWith("#44") || h.startsWith("#48")) return "blue";
    if (h.startsWith("#fd") || h.startsWith("#fe")) return "yellow";
    if (h.startsWith("#a6") || h.startsWith("#8b") || h.startsWith("#7c")) return "purple";
    if (h.startsWith("#ef") || h.startsWith("#dc") || h.startsWith("#f8")) return "red";
    if (h.startsWith("#14") || h.startsWith("#0d") || h.startsWith("#5e")) return "teal";
    return "green";
}

export function pickFamily(habitColorHex: string, usedFamilies: string[]): ColorFamily {
    // Prefer the closest family not already used; fall back to any unused.
    const guessed = familyFromHex(habitColorHex);
    if (!usedFamilies.includes(guessed)) return guessed;
    return (ALL_FAMILIES.find((f) => !usedFamilies.includes(f)) as ColorFamily) || "green";
}

// ------------------------------------------------------------
// Shading algorithm — computes, for each date, the shade-level
// within the current running streak, the current and longest
// streak, and the total completed count.
// ------------------------------------------------------------

export type EntryValue = "completed" | "missed" | "skipped" | undefined;

export interface ShadeResult {
    /** Map of YYYY-MM-DD -> level (1..MAX_LEVEL) */
    shadeByDate: Record<string, number>;
    /** Map of YYYY-MM-DD -> "SKIP_GRAY" | "MISS_WHITE" for special states */
    specialByDate: Record<string, "SKIP_GRAY" | "MISS_WHITE">;
    /** running streak as of the most recent completed day */
    currentStreak: number;
    /** historical max streak */
    longestStreak: number;
    /** lifetime count of completed days */
    totalCount: number;
}

export function computeShades(entries: { date: string; value: EntryValue }[]): ShadeResult {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let runningStreak = 0;
    let longest = 0;
    let totalCount = 0;
    const shadeByDate: Record<string, number> = {};
    const specialByDate: Record<string, "SKIP_GRAY" | "MISS_WHITE"> = {};

    for (const e of sorted) {
        if (e.value === "completed") {
            runningStreak += 1;
            shadeByDate[e.date] = Math.min(runningStreak, MAX_LEVEL);
            longest = Math.max(longest, runningStreak);
            totalCount++;
        } else if (e.value === "skipped") {
            specialByDate[e.date] = "SKIP_GRAY";
            // runningStreak untouched — streak survives
        } else {
            specialByDate[e.date] = "MISS_WHITE";
            runningStreak = 0;
        }
    }

    return {
        shadeByDate,
        specialByDate,
        currentStreak: runningStreak,
        longestStreak: longest,
        totalCount,
    };
}

// Resolve the actual fill color for a given date + shade result.
export function shadeColorFor(
    family: ColorFamily,
    date: string,
    shades: ShadeResult
): string {
    if (shades.specialByDate[date] === "SKIP_GRAY") return SKIP_GRAY;
    if (shades.specialByDate[date] === "MISS_WHITE") return EMPTY_WHITE;
    const level = shades.shadeByDate[date];
    if (!level) return EMPTY_WHITE;
    const palette = PALETTES[family] || PALETTES.green;
    return palette[Math.min(level, palette.length) - 1] || palette[0];
}

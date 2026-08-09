/**
 * Central gamification math — single source of truth for the trophy, badge,
 * and achievement economy.
 *
 * ─────────────── Trophies (incremental, per-action) ───────────────
 *   Scoring model shaped to encourage *longer* focus and *deeper* consistency
 *   rather than shallow micro-rewards.
 *
 *   • 1 check-in (completed task)         = 1 trophy
 *   • Focus session lasting M minutes     = floor(M² / 10) trophies
 *     (10 min → 10²/10 = 10 trophies,
 *      25 min → 25²/10 = 62 trophies,
 *      45 min → 45²/10 = 202 trophies,
 *      60 min → 60²/10 = 360 trophies)
 *   • AI-verified check-in                = +3 trophies (stacks on top of base)
 *   • Perfect day (all scheduled habits done) = +5 trophies per day
 *   • 4-day perfect-day streak bucket     = +50 trophies
 *
 * ─────────────── Badges (milestone, once-only) ───────────────
 *   Actions the user performs. Each badge is earned ONCE. The badge list
 *   lives in /api/badges; the achievement tiering depends on badge count.
 *
 * ─────────────── Achievements (tree nodes, triggered by badge milestones) ──
 *   Achievement levels unlock when you cross thresholds of total earned
 *   badges:
 *       5 badges  → Achievement Lv.1  "Seed Planter"
 *      10 badges  → Achievement Lv.2  "Sprout Keeper"
 *      15 badges  → Achievement Lv.3  "Sapling Grower"
 *      20 badges  → Achievement Lv.4  "Tree Tender"
 *      30 badges  → Achievement Lv.5  "Orchard Master"
 *      40 badges  → Achievement Lv.6  "Forest Guardian"
 *      50 badges  → Achievement Lv.7  "Habit King"
 *
 * ─────────────── TOTAL trophies formula ────────────────
 *   trophies = totalCheckins           (1 per task)
 *            + totalFocusMinutes² ÷ 10 (rounded down)
 *            + (aiVerified × 3)
 *            + (perfectDays × 5)
 *            + (perfectDayStreakBuckets × 50)
 */

/**
 * Trophy accrual from a single focus session of `durationMinutes`.
 * Tiered system — longer sessions unlock bonus multipliers, so sessions
 * feel disproportionately more rewarding (psychological variable-reward curve).
 *
 *   01–20  min  → 1 trophy / min        (base)
 *   21–45  min  → 1.5 trophies / min   (+50% bonus)
 *   46–90  min  → 2 trophies / min     (+100% bonus)
 *   91–180 min  → 3 trophies / min     (+200% bonus)
 *
 * Each threshold is inclusive on the upper bound.
 */
export function focusTrophies(durationMinutes: number): number {
  const m = Math.max(0, Math.floor(durationMinutes));
  let trophies = 0;
  if (m <= 20) trophies = m * 1;
  else if (m <= 45) trophies = 20 + (m - 20) * 1.5;
  else if (m <= 90) trophies = 20 + 25 * 1.5 + (m - 45) * 2;
  else trophies = 20 + 25 * 1.5 + 45 * 2 + (m - 90) * 3;
  return Math.floor(trophies);
}

/**
 * Trophy loss when a user DISCARDS a focus session that lasted
 * `durationMinutes` before they discarded it. Mirrors the accrual formula
 * (the user "un-earns" what this session would have granted), so the
 * penalty scales with how long they tracked before giving up.
 */
export function deductFocusTrophies(durationMinutes: number): number {
  return focusTrophies(durationMinutes);
}

/**
 * Dedicated focus-session trophy tier badges shown on the Focus page.
 * Unlocked by the count of COMPLETED focus sessions — not minutes.
 *
 *   1 session    → First Focus 🌱
 *   3 sessions   → Warming Up 🔥
 *   5 sessions   → Consistent ⏱️
 *   10 sessions  → Deep Diver 🧘
 *   25 sessions  → Iron Will 💪
 *   50 sessions  → Focus Legend 👑
 */
export interface FocusTrophyBadge {
  threshold: number;
  label: string;
  emoji: string;
}
export const FOCUS_TROPHY_BADGES: FocusTrophyBadge[] = [
  { threshold: 1,  label: "First Focus",     emoji: "🌱" },
  { threshold: 3,  label: "Warming Up",      emoji: "🔥" },
  { threshold: 5,  label: "Consistent",      emoji: "⏱️" },
  { threshold: 10, label: "Deep Diver",       emoji: "🧘" },
  { threshold: 25, label: "Iron Will",        emoji: "💪" },
  { threshold: 50, label: "Focus Legend",     emoji: "👑" },
];

/**
 * Returns the list of unlocked focus-session badges (cumulative) plus
 * the next upcoming badge for progress display, given a total completed
 * session count.
 */
export function computeFocusBadges(completedSessions: number): {
  unlocked: FocusTrophyBadge[];
  next: FocusTrophyBadge | null;
} {
  const unlocked = FOCUS_TROPHY_BADGES.filter((b) => completedSessions >= b.threshold);
  const next = FOCUS_TROPHY_BADGES.find((b) => completedSessions < b.threshold) ?? null;
  return { unlocked, next };
}

/**
 * How many 4-day consistency buckets (50 trophies each) are earned from
 * `totalPerfectDays` perfect days.
 */
export function perfectDayStreakBuckets(totalPerfectDays: number): number {
  return Math.floor(totalPerfectDays / 4);
}

export interface TrophyCalcInput {
  totalCheckins: number;
  totalFocusMinutes: number; // sum of all completed focus-session minutes
  aiVerifiedCount: number;
  perfectDays: number;
}

export function computeTotalTrophies(input: TrophyCalcInput): number {
  return (
    input.totalCheckins               // 1 per task
    + focusTrophies(input.totalFocusMinutes)
    + input.aiVerifiedCount * 3
    + input.perfectDays * 5
    + perfectDayStreakBuckets(input.perfectDays) * 50
  );
}

// ─────────────── Achievement tier definitions ───────────────

export interface AchievementTier {
  level: number;
  label: string;
  badgeThreshold: number;
  description: string;
  color: string; // hex for the tree-node glow
  nodeSize: number; // px diameter for the timeline tree
}

export const ACHIEVEMENT_TIERS: AchievementTier[] = [
  { level: 1,  label: "Seed Planter",    badgeThreshold: 5,  description: "First 5 badges — you've planted the seed of discipline.",                         color: "#22a558", nodeSize: 44 },
  { level: 2,  label: "Sprout Keeper",   badgeThreshold: 10, description: "10 badges — the sprout needs daily tending. Keep going.",                      color: "#45c06d", nodeSize: 52 },
  { level: 3,  label: "Sapling Grower",  badgeThreshold: 15, description: "15 badges — your sapling is reaching for light.",                             color: "#4ade80", nodeSize: 60 },
  { level: 4,  label: "Tree Tender",     badgeThreshold: 20, description: "20 badges — a young tree takes root. Storms won't uproot it now.",          color: "#86efac", nodeSize: 68 },
  { level: 5,  label: "Orchard Master",  badgeThreshold: 30, description: "30 badges — you're not growing one tree, you're growing a whole orchard.",    color: "#fbbf24", nodeSize: 76 },
  { level: 6,  label: "Forest Guardian", badgeThreshold: 40, description: "40 badges — the forest trusts you. You are its guardian.",                   color: "#f59e0b", nodeSize: 84 },
  { level: 7,  label: "Habit King",      badgeThreshold: 50, description: "50 badges — crowned. Your consistency is legend.",                            color: "#4f46e5", nodeSize: 96 },
];

export function computeAchievementLevel(badgeCount: number): AchievementTier | null {
  for (let i = ACHIEVEMENT_TIERS.length - 1; i >= 0; i--) {
    if (badgeCount >= ACHIEVEMENT_TIERS[i].badgeThreshold) return ACHIEVEMENT_TIERS[i];
  }
  return null;
}

/**
 * Compute all achievements the user has unlocked AND which ones are upcoming
 * (next tier they haven't reached yet — shown as locked tree nodes).
 */
export function computeAchievements(badgeCount: number): {
  unlocked: AchievementTier[];
  next: AchievementTier | null;
} {
  const unlocked = ACHIEVEMENT_TIERS.filter((t) => badgeCount >= t.badgeThreshold);
  const next = ACHIEVEMENT_TIERS.find((t) => badgeCount < t.badgeThreshold) ?? null;
  return { unlocked, next };
}

// ─────────────── Trophy tier labels for the profile chip ───────────────

export const TROPHY_TIERS = [
  { min: 0,     label: "Observer",     color: "var(--ink-muted)" },
  { min: 10,    label: "Starter",      color: "var(--green-600)" },
  { min: 50,    label: "Builder",      color: "var(--green-700)" },
  { min: 200,   label: "Grinder",      color: "var(--amber-600)" },
  { min: 500,   label: "Champion",     color: "var(--blue-600)" },
  { min: 1500,  label: "Legend",       color: "var(--coral-500)" },
];

export function tierForTrophies(trophes: number): { label: string; color: string } {
  let t = TROPHY_TIERS[0];
  for (const tier of TROPHY_TIERS) if (trophes >= tier.min) t = tier;
  return t;
}
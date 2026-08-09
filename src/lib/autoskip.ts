import { prisma } from "@/lib/prisma";
import { todayStr, pad } from "@/lib/utils";
import { userTodayStr, serverNow } from "@/lib/now";

/**
 * Strict immutability per spec:
 * - Past days (before today) with no entry -> auto-mark locked "missed"
 * - Past days with a pending entry -> lock as "missed"
 * - Today at/after SKIP_HOUR_LOCAL with no entry -> auto-mark locked "skipped"
 *
 * IMPORTANT: uses the USER'S timezone via `serverNow()` — not server UTC.
 * This fixes the original bug where a habit set at 9 AM local would get
 * skipped by 5 PM UTC because the server clock thought it was a new day.
 *
 * SKIP_HOUR_LOCAL = 23 (11 PM local): the user's day is genuinely over.
 * The previous value of 18 (6 PM local) was too aggressive and caused the
 * reported "by evening it forgets today is still today" symptom.
 */
export const SKIP_HOUR_UTC = 12; // legacy — kept for reference; not used here.
export const SKIP_HOUR_LOCAL = 23;

export async function runAutoSkip(userId: string): Promise<{ skipped: number }> {
  const today = await userTodayStr(userId);
  const now = await serverNow(userId);
  const yesterdayDate = new Date(now.getTime() - 86_400_000);
  const yesterdayStr = toDateStrLocal(yesterdayDate);
  let skipped = 0;

  const habits = await prisma.habit.findMany({ where: { userId }, include: { checkins: true } });

  type H = typeof habits[number];
  type C = H["checkins"][number];

  // 1. For any NON-today date before today with a pending (or no) entry -> lock as missed.
  for (const h of habits) {
    const pastUnresolved = h.checkins.filter(
      (c: C) => c.date < today && !c.locked && !c.completed && c.status === "pending"
    );
    for (const c of pastUnresolved) {
      await prisma.checkIn.update({ where: { id: c.id }, data: { status: "missed", locked: true } });
      skipped++;
    }
    // Only create a locked "missed" row for YESTERDAY if the habit was
    // SCHEDULED yesterday. Otherwise we'd punish users for habits not yet
    // created — the original bug. We rely on the schedule lib for this.
    const { isHabitScheduledOnDate } = await import("@/lib/schedule");
    const scheduledYesterday = isHabitScheduledOnDate(h.schedule, yesterdayStr, h.createdAt);
    const hasY = h.checkins.some((c: C) => c.date === yesterdayStr);
    if (scheduledYesterday && !hasY) {
      await prisma.checkIn.create({
        data: { habitId: h.id, date: yesterdayStr, completed: false, status: "missed", locked: true, minutes: 0 }
      });
      skipped++;
    }
  }

  // 2. Today at/after SKIP_HOUR_LOCAL (in user's local tz) with no entry -> locked "skipped".
  // `serverNow` returns a Date whose UTC fields ARE the user's wall-clock,
  // so getUTCHours() returns the local hour directly.
  if (now.getUTCHours() >= SKIP_HOUR_LOCAL) {
    for (const h of habits) {
      const { isHabitScheduledOnDate } = await import("@/lib/schedule");
      if (!isHabitScheduledOnDate(h.schedule, today, h.createdAt)) continue;
      const existing = h.checkins.find((c: C) => c.date === today);
      if (!existing) {
        await prisma.checkIn.create({
          data: { habitId: h.id, date: today, completed: false, status: "skipped", locked: true, minutes: 0 }
        });
        skipped++;
      } else if (!existing.completed && existing.status === "pending" && !existing.locked) {
        await prisma.checkIn.update({ where: { id: existing.id }, data: { status: "skipped", locked: true } });
        skipped++;
      }
    }
  }
  return { skipped };
}

/** Format a Date (UTC fields = local tz fields from serverNow) as YYYY-MM-DD. */
function toDateStrLocal(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns true if a given checkin row is locked and cannot be modified.
 */
export function isLocked(row: { locked?: boolean; status?: string }): boolean {
  return Boolean(row.locked) || row.status === "skipped";
}

void pad;
void prisma;
void todayStr;

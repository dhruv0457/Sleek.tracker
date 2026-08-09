import { todayStr } from "@/lib/utils";

/** A completed check-in with its date. */
export interface CompletedCheck {
  date: string;
  minutes?: number;
}

/**
 * Compute current & best streak from a list of completed check-in dates.
 * Walks backwards from today; counts consecutive days with at least one completed entry.
 * Works for raw Prisma rows OR HabitData.checkins arrays.
 */
export function computeStreaks(checkins: CompletedCheck[]): { current: number; best: number } {
  const set = new Set(checkins.filter((c) => c.date).map((c) => c.date));

  let current = 0;
  const cursor = new Date();
  while (set.has(todayStr(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  let best = 0;
  let run = 0;
  let prevMs: number | null = null;
  for (const d of [...set].sort()) {
    const ms = new Date(d + "T00:00:00").getTime();
    run = prevMs !== null && ms - prevMs === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prevMs = ms;
  }
  best = Math.max(best, current);
  return { current, best };
}

/** Group check-ins by date for fast lookups. */
export function buildCheckinMap<T extends { id: string; checkins: { date: string; completed: boolean; minutes?: number }[] }>(
  habits: T[]
): Record<string, Record<string, { completed: boolean; minutes: number }>> {
  const map: Record<string, Record<string, { completed: boolean; minutes: number }>> = {};
  for (const h of habits) {
    for (const c of h.checkins) {
      if (!map[c.date]) map[c.date] = {};
      map[c.date][h.id] = { completed: c.completed, minutes: c.minutes ?? 0 };
    }
  }
  return map;
}

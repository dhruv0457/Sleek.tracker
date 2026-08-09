// ============================================================
// Schedule helpers — decides whether a habit "fires" on a given
// calendar date. Used by the Dashboard Today list, autoskip,
// and the badges route to avoid counting habits on days their
// schedule explicitly excludes.
//
// Schedule string formats (stored in Habit.schedule):
//   "daily"                                  -> every day forever
//   "weekly:Mon,Wed,Fri"                     -> those weekdays only
//   "dates:2024-01-12,2024-01-15"             -> specific dates only
//   "dates:2024-01-12,2024-01-15;r=1"          -> specific dates + clones the
//                                                  same dates forward 1 month
//
// Future-dated habits (created with a "dates:" schedule where every date
// is in the future) must NOT appear in Today's list.
// ============================================================

const JS_DAY_TO_WEEKDAY: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

// Add N months to a YYYY-MM-DD; clamps the day to the target month's length.
export function addMonths(year: number, monthIdx: number, day: number, n: number): string | null {
  const d = new Date(year, monthIdx + n, 1);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const actualDay = Math.min(day, dim);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(actualDay).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Returns true if the habit's schedule says this YYYY-MM-DD is one of the
 * habit's active days. Respects weekly/dates/daily + the ;r=N repeat flag.
 *
 * `habitCreatedAt` is used to skip dates that are before the habit was created
 * (a habit created on Jan 5 shouldn't show a "missed" cell on Jan 1).
 */
export function isHabitScheduledOnDate(
  schedule: string | null | undefined,
  dateStr: string,
  habitCreatedAt?: Date | string | null
): boolean {
  const sched = schedule || "daily";
  if (!sched || sched === "daily" || sched === "month") return true;

  // Don't fire before the habit existed.
  if (habitCreatedAt) {
    const created = typeof habitCreatedAt === "string" ? new Date(habitCreatedAt + "T00:00:00") : new Date(habitCreatedAt);
    if (new Date(dateStr + "T00:00:00").getTime() < created.getTime() - 86_400_000) {
      return false;
    }
  }

  if (sched.startsWith("weekly:")) {
    const days = sched.slice(7).split(",").map((s) => s.trim());
    const dt = new Date(dateStr + "T00:00:00");
    const wd = JS_DAY_TO_WEEKDAY[dt.getDay()];
    return days.includes(wd);
  }

  if (sched.startsWith("dates:")) {
    const [datesPart, flagsPart] = sched.slice(6).split(";");
    const baseDates = datesPart.split(",").map((s) => s.trim()).filter(Boolean);
    if (baseDates.includes(dateStr)) return true;
    // Repeat flag r=N — also fire on the same day-of-month cloned forward.
    const rMatch = flagsPart?.match(/r=(\d+)/);
    if (rMatch) {
      const rN = Number(rMatch[1]);
      for (let m = 1; m <= rN; m++) {
        for (const bd of baseDates) {
          const [by, bm, bdd] = bd.split("-").map(Number);
          const cloned = addMonths(by, bm - 1, bdd, m);
          if (cloned && cloned === dateStr) return true;
        }
      }
    }
    return false;
  }

  // Unknown format — default to "daily" so the habit stays visible.
  return true;
}

/**
 * Returns the date strings that are "active" for TODAY for a habit, or null
 * if the habit doesn't fire today at all.
 */
export function firesToday(schedule: string, todayIso: string, createdAt?: Date | string | null): boolean {
  return isHabitScheduledOnDate(schedule, todayIso, createdAt);
}

import { prisma } from "@/lib/prisma";

/**
 * Central server-side clock (one source of truth for "now" + "today").
 *
 * Why this exists:
 *   - On serverless hosts (Vercel), the server runs in UTC. A habit you set
 *     at 9 AM local can look "missed" by the time it's 5 PM UTC because the
 *     server has no concept of your wall clock.
 *   - Solution: store the user's IANA timezone. Compute "today" by applying
 *     the offset to UTC `new Date()`.
 *   - Time-API fallback: if the user has no tz set, we ping a free time API
 *     ONCE per process to learn the rough UTC offset of the server's likely
 *     location (so a dev laptop in IST still auto-skips in IST). This is a
 *     best-effort fallback — the tz-from-user path is preferred.
 */

// -- in-process cache -------------------------------------------------------
const tzOffsetCache = new Map<string, number>(); // tz -> minutes ahead of UTC
let timeApiOffsetMin: number | null = null; // server-clock fallback offset

const TIME_API_URL = "https://timeapi.io/api/Time/current/zone?timeZone=UTC";
// Alternative if timeapi.io is unreachable:
const WORLDTIME_URL = "https://worldtimeapi.org/api/ip";

export async function getUserTimezone(userId: string): Promise<string | null> {
  const s = await prisma.userSettings.findUnique({ where: { userId } }).catch(() => null);
  return s?.timezone ?? null;
}

/**
 * Returns a Date that represents "now" in the user's timezone.
 * If no tz is set, falls back to the server clock adjusted by a one-shot
 * time-API lookup (cached for the process lifetime).
 */
export async function serverNow(userId: string): Promise<Date> {
  const tz = await getUserTimezone(userId);
  if (tz) return nowInZone(tz);
  if (timeApiOffsetMin === null) timeApiOffsetMin = await fetchServerOffset();
  // Apply the rough offset to the server UTC clock.
  const now = new Date();
  return new Date(now.getTime() + (timeApiOffsetMin ?? 0) * 60_000);
}

/** String date YYYY-MM-DD in the user's local "today". */
export async function userTodayStr(userId: string): Promise<string> {
  return toDateStr(await serverNow(userId));
}

/** Same as todayStr() but explicit about the timezone. */
export function nowInZone(tz: string): Date {
  // Intl lets us read the parts for a tz reliably without TZ DBs on Vercel.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  // Construct as if UTC then back out to ms — gives us a Date whose UTC fields
  // equal the wall-clock in the tz. Good enough for date comparisons.
  const iso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`;
  return new Date(iso);
}

export function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns local "HH:MM" in the user's tz (for reminder tick matching). */
export async function userNowHHMM(userId: string): Promise<string> {
  const d = await serverNow(userId);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}

/** Returns local hour-of-day (0-23) in the user's tz — used for morning/evening email windows. */
export async function userNowHour(userId: string): Promise<number> {
  return (await serverNow(userId)).getUTCHours();
}

// -- one-shot fallback: learn the server clock's offset to UTC ---------------
async function fetchServerOffset(): Promise<number> {
  try {
    // timeapi.io knows its own zone; we compare its reported UTC time with our Date.now()
    const r = await fetch(TIME_API_URL, { cache: "no-store" });
    if (r.ok) {
      const j: any = await r.json();
      const apiNow = new Date(j.datetime ?? j.dateTime ?? j.date_time).getTime();
      const diffMin = Math.round((apiNow - Date.now()) / 60_000);
      if (Number.isFinite(diffMin) && Math.abs(diffMin) < 60 * 14) return diffMin;
    }
  } catch { /* fall through to next */ }

  try {
    const r = await fetch(WORLDTIME_URL, { cache: "no-store" });
    if (r.ok) {
      const j: any = await r.json();
      // `utc_datetime` like "2024-01-01T12:00:00.123456+00:00"
      const apiNow = new Date(j.utc_datetime ?? j.utc_datetime).getTime();
      const diffMin = Math.round((apiNow - Date.now()) / 60_000);
      if (Number.isFinite(diffMin)) return diffMin;
    }
  } catch { /* ignore */ }

  return 0; // assume server clock ≈ UTC; user can override via Settings
}

export { COMMON_TIMEZONES } from "@/lib/timezones";

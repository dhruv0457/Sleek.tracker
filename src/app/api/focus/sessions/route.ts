/* GET /api/focus/sessions
   - ?last=10              → recent N sessions (capped at 10)                    [default]
   - ?window=5months       → ALL sessions within the last 5 calendar months,
                              grouped by month, with per-month + total trophy
                              aggregates and focus-badge unlock status.
*/

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { focusTrophies, computeFocusBadges } from "@/lib/trophies";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const windowParam = url.searchParams.get("window");

  // ─── 5-month window mode ──────────────────────────────────────
  if (windowParam === "5months") {
    const now = new Date();
    // Start of month, 5 months ago (includes the current month, so we see ~5 calendar months)
    const start = new Date(now.getFullYear(), now.getMonth() - 4, 1, 0, 0, 0, 0);

    const sessions = await prisma.focusSession.findMany({
      where: { userId: session.userId, createdAt: { gte: start } },
      orderBy: { createdAt: "desc" },
      select: { id: true, durationSec: true, completed: true, createdAt: true },
    });

    // Group sessions by YYYY-MM
    const byMonth: Record<string, { date: string; sessions: typeof sessions; earned: number; lost: number; completedCount: number; discardCount: number; minutes: number }> = {};
    for (const s of sessions) {
      const ym = s.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[ym]) {
        byMonth[ym] = { date: ym, sessions: [], earned: 0, lost: 0, completedCount: 0, discardCount: 0, minutes: 0 };
      }
      const bucket = byMonth[ym];
      bucket.sessions.push(s);
      const minutes = Math.max(0, Math.floor(s.durationSec / 60));
      bucket.minutes += minutes;
      if (s.completed) {
        bucket.completedCount += 1;
        bucket.earned += focusTrophies(minutes);
      } else {
        bucket.discardCount += 1;
        bucket.lost += focusTrophies(minutes);
      }
    }

    const months = Object.values(byMonth).sort((a, b) => (a.date < b.date ? 1 : -1));
    const totalEarned = months.reduce((s, m) => s + m.earned, 0);
    const totalLost = months.reduce((s, m) => s + m.lost, 0);
    const completedTotal = months.reduce((s, m) => s + m.completedCount, 0);

    return NextResponse.json({
      mode: "5months",
      months,
      totals: {
        sessions: sessions.length,
        earned: totalEarned,
        lost: totalLost,
        net: totalEarned - totalLost,
        completedSessions: completedTotal,
        completedSessionCount: completedTotal // alias for client clarity
      },
      focusBadges: computeFocusBadges(completedTotal),
    });
  }

  // ─── Default: last-N recent mode ─────────────────────────────
  const last = Math.min(10, Math.max(1, Number(url.searchParams.get("last") || 10)));

  const sessions = await prisma.focusSession.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: last,
    select: { id: true, durationSec: true, completed: true, createdAt: true },
  });

  return NextResponse.json({ sessions });
}

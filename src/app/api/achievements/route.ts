import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { computeAchievements, computeTotalTrophies, type TrophyCalcInput } from "@/lib/trophies";

export const dynamic = "force-dynamic";

/**
 * Achievements are unlocked by badge milestones (not by trophies).
 * This route returns the TREE-TIMELINE nodes: which achievement tiers the
 * user has reached, and which is the next locked one.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [badgesRow, aiV, habitsRaw] = await Promise.all([
    prisma.badge.findMany({ where: { userId: session.userId } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId, passed: true } }),
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } })
  ]);

  const badgeCount = badgesRow.length;
  const { unlocked, next } = computeAchievements(badgeCount);

  // Also returns current trophy total so the tree header can display it.
  type HR = typeof habitsRaw[number];
  const totalCheckins = habitsRaw.flatMap((h: HR) => h.checkins).filter((c: any) => c.completed).length;
  const perfectDays = 0; // computed in badges route — approximate here for speed; the real count is in the full stats route
  const trophyCalc: TrophyCalcInput = {
    totalCheckins,
    totalFocusMinutes: 0,
    aiVerifiedCount: aiV.length,
    perfectDays
  };
  const trophies = computeTotalTrophies(trophyCalc);

  return NextResponse.json({
    unlocked,
    next,
    badgeCount,
    trophies
  });
}
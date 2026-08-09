import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isOwner } from "@/lib/owner";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { max: 20, windowMs: 60_000, keyPrefix: "leaderboard" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const rows = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true
    },
    orderBy: { email: "asc" },
    take: 250
  });

  const ownerEmail = process.env.OWNER_EMAIL;

  const trophies = await prisma.trophy.findMany({ select: { userId: true, count: true } });
  const tMap = new Map(trophies.map((t: typeof trophies[number]) => [t.userId, t.count]));

  // Badge count per user (distinct unlocked badges). 5 badges = 30 trophies.
  const badges = await prisma.badge.groupBy({ by: ["userId"], _count: { _all: true } });
  const bMap = new Map(badges.map((b: typeof badges[number]) => [b.userId, b._count._all]));

  const ranked = rows.map((u: typeof rows[number]) => {
      const displayName = u.name?.trim() || "Anonymous User";
      return {
        // `id` is exposed only so the client can produce stable React keys
        // and identify "isMe"/"isOwner" rows; it is a non-guessable cuid and is
        // not personally identifiable. `email` is NOT returned.
        id: u.id,
        name: displayName,
        avatar: u.avatar,
        trophies: tMap.get(u.id) ?? 0,
        badges: bMap.get(u.id) ?? 0,
        isMe: u.id === session.userId,
        isOwner: ownerEmail ? u.email === ownerEmail : false
      };
    })
    .sort((a: { trophies: number }, b: { trophies: number }) => b.trophies - a.trophies);

  const myRank = ranked.findIndex((r: { isMe: boolean }) => r.isMe) + 1;

  return NextResponse.json({ leaderboard: ranked, myRank });
}
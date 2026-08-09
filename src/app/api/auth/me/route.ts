import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { trialDaysLeft } from "@/lib/tier";
import { rateLimit, RL_WRITE } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const rl = rateLimit(req, { ...RL_WRITE, keyPrefix: "auth-me" });
  if (!rl.ok) {
    return NextResponse.json({ user: null }, { status: 429 });
  }

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ user: null });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { settings: true }
    });
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        locality: user.locality,
        tier: user.tier,
        trialDaysLeft: trialDaysLeft({ tier: user.tier as any, trialEndAt: user.trialEndAt }),
        settings: user.settings || {
          multitaskingDefault: false,
          emailsMorning: true,
          emailsEvening: true,
          pushEnabled: true,
          autoSkipOn: true,
          weekStartMon: true,
          theme: "light"
        }
      }
    });
  } catch (e) {
    console.error("[auth/me] DB error:", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

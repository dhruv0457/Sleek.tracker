import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo } from "@/lib/tier";
import { rateLimit, RL_WRITE } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

const NAME_RE = /^[\p{L}\p{M}0-9\s\-_'",.!?():]{1,140}$/u;

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: { checkins: { orderBy: { date: "desc" } } }
  });
  return NextResponse.json({ habits });
}

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit writes — blocks scripted habit-flooding / NoSQL probes.
  const rl = rateLimit(req, { ...RL_WRITE, keyPrefix: "habits-post" });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name || !NAME_RE.test(name)) {
    return NextResponse.json({ error: "Name invalid (max 140 chars, letters/digits/punct)" }, { status: 400 });
  }

  const user = await getUserInfo(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const total = await prisma.habit.count({ where: { userId: session.userId } });
  const maxHabits = user.tier === "ultra_pro" ? Infinity : user.tier === "basic_pro" ? 20 : 5;
  if (total >= maxHabits) {
    return NextResponse.json({
      error: `You've reached the limit of ${maxHabits} habits on your plan. Upgrade to Basic Pro (20) or Ultra Pro (unlimited).`
    }, { status: 400 });
  }

  const habit = await prisma.habit.create({
    data: {
      userId: session.userId,
      name,
      description: body.description ? String(body.description).slice(0, 500) : null,
      color: typeof body.color === "string" ? body.color.slice(0, 20) : "#22a558",
      targetMins: typeof body.targetMins === "number" && body.targetMins > 0 && body.targetMins < 1440 ? body.targetMins : 30,
      intensityTarget: [80, 90, 100].includes(body.intensityTarget) ? body.intensityTarget : 100,
      requiresCamera: Boolean(body.requiresCamera),
      schedule: typeof body.schedule === "string" ? body.schedule.slice(0, 200) : "daily"
    }
  });
  return NextResponse.json({ habit });
}

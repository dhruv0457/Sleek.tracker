import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo, canUseAIInsights } from "@/lib/tier";
import { rateLimit, RL_AI } from "@/lib/rateLimit";
import { nvidiaChat } from "@/lib/nvidia";
import { checkCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function userContextJson(habits: any[], aiV: any[]): string {
  const intensityByDay: Record<string, number[]> = {};
  const countsByDay: Record<string, { done: number; total: number; multitask: number; skipped: number; missed: number }> = {};
  for (const h of habits) {
    if (!Array.isArray(h.checkins)) continue;
    for (const c of h.checkins as any[]) {
      if (!countsByDay[c.date]) countsByDay[c.date] = { done: 0, total: 0, multitask: 0, skipped: 0, missed: 0 };
      countsByDay[c.date].total++;
      if (c.completed) countsByDay[c.date].done++;
      if (c.multitasking) countsByDay[c.date].multitask++;
      if (c.status === "skipped") countsByDay[c.date].skipped++;
      if (c.status === "missed") countsByDay[c.date].missed++;
      if (c.intensity > 0) (intensityByDay[c.date] ||= []).push(c.intensity);
    }
  }
  const dates = Object.keys(countsByDay).sort();
  const totals = {
    habits: habits.length,
    totalDone: habits.flatMap((h: any) => (h.checkins as any[] || [])).filter((c: any) => c.completed).length,
    aiVerificationsPassed: aiV.filter((v) => v.passed).length,
    byWeekday: weekdaySummary(countsByDay),
    recent14Days: dates.slice(-14).map((d) => ({
      date: d,
      weekday: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }),
      done: countsByDay[d].done,
      total: countsByDay[d].total,
      multitask: countsByDay[d].multitask,
      skipped: countsByDay[d].skipped,
      missed: countsByDay[d].missed,
      avgIntensity: intensityByDay[d]?.length
        ? Math.round(intensityByDay[d].reduce((a, b) => a + b, 0) / intensityByDay[d].length)
        : 0
    }))
  };
  return JSON.stringify(totals);
}

function weekdaySummary(countsByDay: Record<string, { done: number; total: number }>): Record<string, { done: number; total: number }> {
  const byWd: Record<string, { done: number; total: number }> = {};
  for (const [d, v] of Object.entries(countsByDay)) {
    const wd = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    byWd[wd] = byWd[wd] || { done: 0, total: 0 };
    byWd[wd].done += v.done;
    byWd[wd].total += v.total;
  }
  return byWd;
}

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { ...RL_AI, keyPrefix: "ai-chat" });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're asking too quickly. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const user = await getUserInfo(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Tier-based daily quota: free=4, basic_pro=10, ultra_pro=unlimited
  const today = new Date().toISOString().slice(0, 10);
  const todayMsgs = await prisma.aiMessage.count({
    where: { userId: session.userId, role: "user", createdAt: { gte: new Date(today) } }
  });

  const tier = user.tier;
  const maxMsgs = tier === "ultra_pro" ? Infinity : tier === "basic_pro" ? 10 : 4;
  if (todayMsgs >= maxMsgs) {
    return NextResponse.json({
      error: `Daily AI chat limit reached (${maxMsgs} messages). ${tier === "free" ? "Upgrade to Basic Pro for 10/day or Ultra Pro for unlimited." : "Upgrade to Ultra Pro for unlimited chats."}`
    }, { status: 403 });
  }

  if (!canUseAIInsights(user)) {
    return NextResponse.json(
      { error: "AI Insights is a premium feature. Upgrade to Ultra Pro ($4/mo) or use it during your trial." },
      { status: 403 }
    );
  }

  if (!process.env.NVIDIA_API_KEY) {
    return NextResponse.json({ error: "Server not configured: NVIDIA_API_KEY missing. Add it to .env." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const userMsg = String(body.message || "").trim().slice(0, 4000);
  if (!userMsg) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const [habits, aiV, history] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId }, take: 50 }),
    prisma.aiMessage.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "asc" }, take: 10 })
  ]);

  const contextJson = userContextJson(habits as any, aiV);
  const systemPrompt = `You are an AI Habit Coach embedded in the "sleek" application.
Read the JSON data below describing the user's habit logs, intensity scores (0-100), and multitasking toggles.
Keep answers focused on their actual data: be concise, supportive, and grounded in numbers.
If they ask about a specific day or week, use the JSON. Do NOT invent data.
If their data is sparse, acknowledge that and suggest starting small.

USER_DATA_JSON:
${contextJson}`;

  // Build multi-turn messages
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt }
  ];
  for (const m of history.slice(-6)) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: userMsg });

  const { text: aiText, ok, errors } = await nvidiaChat(messages as any, {
    temperature: 0.3,
    maxTokens: 600
  });

  if (!ok) {
    console.error("NIM chat fallbacks exhausted — all models failed");
    return NextResponse.json({ error: `AI unavailable — all models failed.` }, { status: 503 });
  }

  // Persist user + model messages
  await Promise.all([
    prisma.aiMessage.create({ data: { userId: session.userId, role: "user", content: userMsg } }),
    prisma.aiMessage.create({ data: { userId: session.userId, role: "model", content: aiText } })
  ]).catch(() => null);

  return NextResponse.json({ reply: aiText });
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const msgs = await prisma.aiMessage.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    take: 50
  });
  return NextResponse.json({ messages: msgs });
}
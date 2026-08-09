import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo, canUseAIVerifier } from "@/lib/tier";
import { rateLimit, RL_VERIFIER } from "@/lib/rateLimit";
import { matchPhotoToHabit, verifyHabitPhoto, clarifyHabitPhoto } from "@/lib/nvidiaVision";
import { checkCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserInfo(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!canUseAIVerifier(user)) {
    return NextResponse.json({ error: "AI Work Verifier is a premium feature. Upgrade to $2 or $4 tier." }, { status: 403 });
  }

  const rl = rateLimit(req, { ...RL_VERIFIER, keyPrefix: "ai-vision" });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many verifications — wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "verify");

  // --- Action: CONFIRM (user clicked ✅) ---
  if (action === "confirm") {
    const habitId = String(body.habitId || "");
    const date = String(body.date || "");
    if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Missing habitId or invalid date" }, { status: 400 });
    }
    const h = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!h || h.userId !== session.userId) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    await prisma.aIVerification.create({
      data: { userId: session.userId, habitId, date, label: "PASS", confidence: 1, passed: true, blurry: false, imageDataUrl: null }
    }).catch(() => null);

    await prisma.checkIn.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, completed: true, status: "done", locked: true, minutes: h.targetMins, intensity: 100 },
      update: {}
    }).catch(() => null);

    return NextResponse.json({ confirmed: true, habitName: h.name });
  }

  // --- Action: REJECT (user clicked ❌ on a suggestion) ---
  if (action === "reject") {
    const habitId = String(body.habitId || "");
    const date = String(body.date || "");
    if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Missing habitId or invalid date" }, { status: 400 });
    }

    await prisma.aIVerification.create({
      data: { userId: session.userId, habitId, date, label: "FAIL", confidence: 0, passed: false, blurry: false, imageDataUrl: null }
    }).catch(() => null);

    return NextResponse.json({ rejected: true });
  }

  // --- Action: VERIFY (initial photo scan against all pending tasks) ---
  if (action === "verify") {
    const imageDataUrl = typeof body.imageDataUrl === "string" && body.imageDataUrl.length < 200_000
      ? body.imageDataUrl
      : null;
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Missing or invalid image." }, { status: 400 });
    }

    const date = String(body.date || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    // Gather ALL habits scheduled today that require camera verification
    // and are NOT yet completed.
    const allHabits = await prisma.habit.findMany({
      where: { userId: session.userId, requiresCamera: true },
      include: { checkins: { where: { date } } }
    });

    // Filter to habits scheduled today + not completed
    const { isHabitScheduledOnDate } = await import("@/lib/schedule");
    const todayStr = date;

    const pending: { id: string; name: string }[] = [];
    for (const h of allHabits) {
      const scheduled = isHabitScheduledOnDate(h.schedule, todayStr, h.createdAt);
      if (!scheduled) continue;
      const checkin = h.checkins[0];
      if (checkin && checkin.completed) continue;
      pending.push({ id: h.id, name: h.name });
    }

    if (pending.length === 0) {
      return NextResponse.json({ error: "No pending camera tasks for today." }, { status: 400 });
    }

    // If only one task, use single-shot verify
    if (pending.length === 1) {
      const v = await verifyHabitPhoto(pending[0].name, imageDataUrl);
      return NextResponse.json({
        singleMatch: true,
        match: v.passed ? { habitId: pending[0].id, habitName: pending[0].name, confidence: v.confidence || "high" } : null,
        reason: v.reason,
        description: v.description || "",
        needsClarification: v.ambiguous && !v.passed,
        totalPending: 1,
        remaining: v.passed ? [] : pending.map(p => p.name),
      });
    }

    // Multi-habit match
    const m = await matchPhotoToHabit(imageDataUrl, pending.map(p => p.name));

    if (!m.matched) {
      return NextResponse.json({
        match: null,
        reason: m.reason || "Photo doesn't match any pending task.",
        description: m.description || "",
        needsClarification: false,
        totalPending: pending.length,
        remaining: pending.map(p => p.name),
      });
    }

    const habit = pending.find(p => p.name === m.habitName) || pending[0];
    return NextResponse.json({
      match: { habitId: habit.id, habitName: habit.name, confidence: m.confidence || "medium" },
      reason: m.reason,
      description: m.description || "",
      // When the model says it's split between candidates, we show
      // a clarification pop-up BEFORE auto-confirming.
      needsClarification: !!m.needsClarification,
      confidence: m.confidence || "medium",
      totalPending: pending.length,
      remaining: pending.filter(p => p.name !== m.habitName).map(p => p.name),
    });
  }

  // --- Action: CLARIFY (user answered No on the "Is this a [habit]?" popup) ---
  // Re-analyze the photo with the rejected guess excluded.
  if (action === "clarify") {
    const imageDataUrl = typeof body.imageDataUrl === "string" && body.imageDataUrl.length < 200_000
      ? body.imageDataUrl
      : null;
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Missing or invalid image." }, { status: 400 });
    }
    const date = String(body.date || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const rejectedName = String(body.rejectedName || "");
    if (!rejectedName) {
      return NextResponse.json({ error: "Missing rejectedName for clarification pass." }, { status: 400 });
    }

    // Rebuild pending list
    const allHabits = await prisma.habit.findMany({
      where: { userId: session.userId, requiresCamera: true },
      include: { checkins: { where: { date } } },
    });
    const { isHabitScheduledOnDate } = await import("@/lib/schedule");
    const pending: { id: string; name: string }[] = [];
    for (const h of allHabits) {
      if (!isHabitScheduledOnDate(h.schedule, date, h.createdAt)) continue;
      const c = h.checkins[0];
      if (c && c.completed) continue;
      pending.push({ id: h.id, name: h.name });
    }
    const remainingNames = pending.filter(p => p.name !== rejectedName).map(p => p.name);

    const m = await clarifyHabitPhoto(imageDataUrl, rejectedName, remainingNames);
    if (!m.matched) {
      return NextResponse.json({
        match: null,
        reason: m.reason,
        description: m.description || "",
        needsClarification: false,
        totalPending: pending.length,
        remaining: remainingNames,
      });
    }
    const habit = pending.find(p => p.name === m.habitName);
    return NextResponse.json({
      match: habit ? { habitId: habit.id, habitName: habit.name, confidence: m.confidence || "medium" } : null,
      reason: m.reason,
      description: m.description || "",
      needsClarification: false,
      confidence: m.confidence || "medium",
      totalPending: pending.length,
      remaining: pending.filter(p => p.name !== m.habitName).map(p => p.name),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
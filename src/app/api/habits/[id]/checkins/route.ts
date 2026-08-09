import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

const VALID_STATUSES = ["pending", "done", "missed", "skipped", "multitask"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const habit = await prisma.habit.findUnique({ where: { id }, include: { checkins: true } });
  if (!habit || habit.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ habit, checkins: habit.checkins });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const { id } = await params;

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, { max: 30, windowMs: 60_000, keyPrefix: "checkins" });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const date = String(body.date || "");

  // Camera-required habits can only be completed via AI camera verification.
  // Reject manual / slider completes. AI verifier and auto-skip flows pass
  // manualOverride: true / are server-authed and bypass this gate.
  if (habit.requiresCamera && !body.manualOverride) {
    return NextResponse.json(
      { error: "This task requires camera verification. Use the camera button." },
      { status: 403 }
    );
  }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "Invalid date (YYYY-MM-DD)" }, { status: 400 });

  const existing = await prisma.checkIn.findUnique({ where: { habitId_date: { habitId: id, date } } });
  if (existing?.locked || existing?.status === "skipped" || existing?.status === "missed" || existing?.completed) {
    return NextResponse.json(
      { error: "This check-in is locked (immutability rule). Delete the habit and recreate it to correct." },
      { status: 403 }
    );
  }

  const completed = Boolean(body.completed);
  const multitasking = Boolean(body.multitasking);
  let intensity = typeof body.intensity === "number" ? Math.max(0, Math.min(100, Math.round(body.intensity))) : (completed ? 100 : 0);
  if (multitasking) intensity = Math.round(intensity * 0.8);
  // minutes must be a finite, non-negative, sensible integer — otherwise a
  // client could push 1e308 / -99 / NaN here and corrupt trophy/sum stats.
  const rawMinutes = typeof body.minutes === "number" ? body.minutes : (completed ? habit.targetMins : 0);
  const minutes = Number.isFinite(rawMinutes)
    ? Math.max(0, Math.min(24 * 60, Math.round(rawMinutes)))
    : (completed ? habit.targetMins : 0);
  const rawStatus = typeof body.status === "string" && VALID_STATUSES.includes(body.status) ? body.status : (completed ? "done" : "pending");
  const status = multitasking && completed ? "multitask" : rawStatus;
  const isTerminal = status === "done" || status === "missed" || status === "skipped" || status === "multitask";

  const updated = await prisma.checkIn.upsert({
    where: { habitId_date: { habitId: id, date } },
    create: {
      habitId: id, date, completed, intensity, multitasking, status,
      locked: isTerminal,
      minutes,
      note: body.note ? String(body.note).slice(0, 500) : null
    },
    update: {
      completed, intensity, multitasking, status, locked: isTerminal,
      minutes,
      note: body.note !== undefined ? (body.note ? String(body.note).slice(0, 500) : null) : undefined
    }
  });
  return NextResponse.json({ checkin: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const date = String(url.searchParams.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date required" }, { status: 400 });

  const existing = await prisma.checkIn.findUnique({ where: { habitId_date: { habitId: id, date } } });
  if (existing?.locked || existing?.status === "skipped" || existing?.status === "missed" || existing?.completed) {
    return NextResponse.json({ error: "Locked. Use the habit Delete button to remove entire habit." }, { status: 403 });
  }
  await prisma.checkIn.deleteMany({ where: { habitId: id, date } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
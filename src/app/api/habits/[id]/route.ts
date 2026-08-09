import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const NAME_RE = /^[\p{L}\p{M}0-9\s\-_'",.!?():]{1,140}$/u;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? String(body.name).trim() : "";
if (name && !NAME_RE.test(name)) {
  return NextResponse.json({ error: "Name invalid (max 140 chars, letters/digits/punct)" }, { status: 400 });
}

const updated = await prisma.habit.update({
    where: { id },
    data: {
      name: name || undefined,
      description: typeof body.description === "string" ? body.description.slice(0, 500) || null : undefined,
      targetMins: typeof body.targetMins === "number" && body.targetMins > 0 && body.targetMins < 1440 ? body.targetMins : undefined,
      intensityTarget: [80, 90, 100].includes(body.intensityTarget) ? body.intensityTarget : undefined,
      requiresCamera: typeof body.requiresCamera === "boolean" ? body.requiresCamera : undefined,
      schedule: typeof body.schedule === "string" ? body.schedule.slice(0, 200) : undefined
    }
  });
  return NextResponse.json({ habit: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
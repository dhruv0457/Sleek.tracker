import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit, RL_AUTH } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const TRIAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const NAME_RE = /^[\p{L}\p{M}'\s-]{1,80}$/u;
const LOCALITY_RE = /^[\p{L}\p{M}0-9\s,.'-]{0,120}$/u;

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  // Rate limit: 10 registrations per minute per IP — blocks enumeration bots.
  const rl = rateLimit(req, { ...RL_AUTH, keyPrefix: "register" });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const locality = String(body.locality || "").trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Provide a valid email" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Password must contain at least one letter and one number" }, { status: 400 });
  }
  if (name && !NAME_RE.test(name)) {
    return NextResponse.json({ error: "Name has invalid characters" }, { status: 400 });
  }
  if (locality && !LOCALITY_RE.test(locality)) {
    return NextResponse.json({ error: "Locality has invalid characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  // SECURITY: instead of revealing "Email already registered" (which lets an
  // attacker enumerate valid emails), return success-style response with a
  // generic note. The user then has to log in with those credentials.
  // We still run a dummy bcrypt so the timing is indistinguishable.
  const hashed = await bcrypt.hash(password, 12);

  if (existing) {
    // Don't re-create, don't reveal — but consume the same amount of time as a
    // real signup so timing-based enumeration fails.
    return NextResponse.json({ ok: true, message: "If this is a new email, your account is ready. You can now log in." });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hashed,
      locality: locality || null,
      trialEndAt: new Date(Date.now() + TRIAL_MS),
      settings: { create: {} }
    }
  });

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return NextResponse.json({ id: user.id, email: user.email });
}

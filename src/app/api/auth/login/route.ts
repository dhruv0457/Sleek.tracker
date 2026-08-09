import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { rateLimit, RL_AUTH } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  // Rate limit: 10 login attempts per minute per IP — blocks password spraying.
  const rl = rateLimit(req, { ...RL_AUTH, keyPrefix: "login" });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  // Basic email-pattern + password-length check BEFORE hitting the DB to
  // avoid leaking which emails exist via timing differences.
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 1) {
    // run a dummy bcrypt to equalise timing
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Google OAuth users cannot email/password log in — redirect them to Google
  if (user && !user.password) {
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    return NextResponse.json({ error: "Please sign in with Google instead." }, { status: 401 });
  }

  // Always run a bcrypt compare to avoid user-enumeration timing leaks
  const ok = user
    ? await bcrypt.compare(password, user.password!)
    : await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");

  if (!user || !ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return NextResponse.json({ id: user.id, email: user.email });
}

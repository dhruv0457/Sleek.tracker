import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const rl = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "reset-pw" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  const newPassword = String(body.password || "");

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: "Email, code, and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8 || newPassword.length > 200) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: "Password must contain at least one letter and one number." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.resetCode || !user.resetCodeExpiresAt) {
    return NextResponse.json({ error: "No reset code was requested." }, { status: 400 });
  }

  if (new Date() > user.resetCodeExpiresAt) {
    return NextResponse.json({ error: "Reset code has expired. Request a new one." }, { status: 400 });
  }

  if (!user.resetCode || !constantTimeEqual(code, user.resetCode)) {
    return NextResponse.json({ error: "Incorrect code. Check your email and try again." }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashed,
      resetCode: null,
      resetCodeExpiresAt: null,
    },
  });

  // Auto-login after reset
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return NextResponse.json({ ok: true, message: "Password reset. You are now logged in." });
}

// Constant-time string equality — defends against timing side-channels that
// could otherwise recover the 6-digit reset code one character at a time.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still walk both strings so the elapsed time does not leak the length
    // mismatch verdict to an early-bailout observer.
    let acc = a.length ^ b.length;
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) acc |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return acc === 0 && a.length === b.length;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
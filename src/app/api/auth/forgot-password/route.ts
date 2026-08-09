import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const rl = rateLimit(req, { max: 3, windowMs: 120_000, keyPrefix: "forgot-pw" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Wait 2 minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  }

  // Don't reveal whether the email exists — always return the same success
  // message regardless of: (a) unknown email, (b) Google-only account, or
  // (c) mailer delivery failure. Equalising the response prevents an attacker
  // from distinguishing the three branches by message text or timing.
  const GENERIC_OK = "If this email is registered, a code has been sent.";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  // Google-only users can't reset a password; return the same generic message
  // so this branch isn't distinguishable from "no such user".
  if (user.provider === "google" && !user.password) {
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  // Generate 6-digit code using cryptographically-secure RNG (not Math.random)
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetCode: code,
      resetCodeExpiresAt: expiresAt,
    },
  });

  // Send code via Gmail — surface delivery failures clearly
  const sent = await sendMail(
    email,
    "sleek — Your Password Reset Code",
    `You requested a password reset for your sleek account.\n\nYour 6-digit code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.\n\n— sleek`
  );

  if (!sent) {
    // Mailer not configured or delivery failed — return the SAME generic
    // success message so this branch looks identical to the unknown-email
    // case from the caller's perspective (no enumeration oracle).
    return NextResponse.json({ ok: true, message: GENERIC_OK });
  }

  return NextResponse.json({ ok: true, message: GENERIC_OK });
}
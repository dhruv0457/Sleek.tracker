import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";
import { rateLimit, RL_WRITE } from "@/lib/rateLimit";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

const PLAN_TIERS: Record<string, "basic_pro" | "ultra_pro"> = {
  basic_pro: "basic_pro",
  ultra_pro: "ultra_pro",
};

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  }

  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(req, { ...RL_WRITE, max: 5, windowMs: 60_000, keyPrefix: "rzp-verify" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "");
  const paymentId = String(body.paymentId || "");
  const signature = String(body.signature || "");
  const plan = String(body.plan || "");

  if (!orderId || !paymentId || !signature || !plan) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  if (!PLAN_TIERS[plan]) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // CRITICAL: Verify the signature server-side. This prevents tampering.
  // A hacker cannot fake a payment or change the amount because Razorpay's
  // signature is computed from the actual order id + payment id + secret key.
  const isValid = verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Payment verification failed. Possible tampering detected." }, { status: 400 });
  }

  // Fetch the order from Razorpay to verify the amount matches the plan
  // (double-check: signature is valid AND amount is correct)
  try {
    const Razorpay = (await import("razorpay")).default;
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
    const order = await instance.orders.fetch(orderId);

    const expectedAmount = plan === "basic_pro" ? 200 : 400;
    if (Number(order.amount) !== expectedAmount) {
      console.error(`Amount mismatch! Expected ${expectedAmount}, got ${order.amount}`);
      return NextResponse.json({ error: "Payment amount mismatch. Contact support." }, { status: 400 });
    }

    // Verify the order belongs to this user
    const orderUserId = (order.notes as any)?.userId;
    if (orderUserId !== session.userId) {
      console.error(`User mismatch! Order belongs to ${orderUserId}, session is ${session.userId}`);
      return NextResponse.json({ error: "Payment verification failed." }, { status: 403 });
    }

    // Verify payment status
    const payment = await instance.payments.fetch(paymentId);
    if (payment.status !== "captured") {
      return NextResponse.json({ error: "Payment not captured. Please complete the payment." }, { status: 400 });
    }
  } catch (e: any) {
    console.error("Razorpay fetch failed:", e);
    return NextResponse.json({ error: "Could not verify payment. Please contact support." }, { status: 503 });
  }

  // All checks passed — upgrade the user's tier
  const tier = PLAN_TIERS[plan];
  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { tier },
    });

    return NextResponse.json({
      ok: true,
      tier,
      message: `Welcome to ${tier === "ultra_pro" ? "Ultra Pro" : "Basic Pro"}! All premium features unlocked.`,
    });
  } catch (e: any) {
    console.error("Tier update failed:", e);
    return NextResponse.json({ error: "Payment received but account update failed. Contact support with your payment ID." }, { status: 500 });
  }
}

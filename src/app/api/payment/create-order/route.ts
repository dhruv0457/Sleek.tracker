import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";
import { rateLimit, RL_WRITE } from "@/lib/rateLimit";
import { createRazorpayOrder, RAZORPAY_KEY_ID } from "@/lib/razorpay";

const PLAN_AMOUNTS: Record<string, number> = {
  basic_pro: 200, // $2.00 = 200 paise
  ultra_pro: 400, // $4.00 = 400 paise
};

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  }

  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(req, { ...RL_WRITE, max: 5, windowMs: 60_000, keyPrefix: "rzp-order" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || "");
  if (plan !== "basic_pro" && plan !== "ultra_pro") {
    return NextResponse.json({ error: "Invalid plan. Choose basic_pro or ultra_pro." }, { status: 400 });
  }

  const amount = PLAN_AMOUNTS[plan];
  if (!amount) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  try {
    const receipt = `rcpt_${Date.now()}_${session.userId.slice(0, 8)}`;
    const order = await createRazorpayOrder({
      plan: plan as "basic_pro" | "ultra_pro",
      amount,
      receipt,
      userId: session.userId,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (e: any) {
    console.error("Razorpay order creation failed:", e);
    return NextResponse.json({ error: "Payment service unavailable. Please try again later." }, { status: 503 });
  }
}
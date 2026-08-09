import Razorpay from "razorpay";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function getInstance(): Razorpay {
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

export interface CreateOrderInput {
  plan: "basic_pro" | "ultra_pro";
  amount: number; // in smallest currency unit (paise)
  receipt: string;
  userId: string;
}

export async function createRazorpayOrder(input: CreateOrderInput) {
  const instance = getInstance();
  const order = await instance.orders.create({
    amount: input.amount,
    currency: "USD",
    receipt: input.receipt,
    notes: {
      userId: input.userId,
      plan: input.plan,
    },
  });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

export { RAZORPAY_KEY_ID };
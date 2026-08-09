/* POST /api/payment/free-upgrade
   Instantly upgrade the authenticated user's tier to "basic_pro" or "ultra_pro"
   without payment. Requires confirmation from the client. */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

const VALID_TIERS = new Set(["basic_pro", "ultra_pro"]);

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = typeof body.plan === "string" ? body.plan : null;
  if (!plan || !VALID_TIERS.has(plan)) {
    return NextResponse.json({ error: `Invalid plan: ${plan}. Choose "basic_pro" or "ultra_pro".` }, { status: 400 });
  }

  // Confirmation must come from the client (to prevent accidental upgrades)
  if (!body.confirmed) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { tier: plan } });

  return NextResponse.json({
    ok: true,
    tier: plan,
    message: `Upgraded to ${plan === "basic_pro" ? "Pro" : "Ultra"} successfully. Enjoy!`,
  });
}
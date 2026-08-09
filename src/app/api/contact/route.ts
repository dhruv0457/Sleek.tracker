import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isOwner } from "@/lib/owner";
import { rateLimit } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });

  const rl = rateLimit(req, { max: 3, windowMs: 60_000, keyPrefix: "contact" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many messages. Wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { fromName, fromEmail, subject, message } = body;

  if (!fromName || !fromEmail || !message) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(fromEmail)) {
    return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  }
  if (String(message).length > 5000) {
    return NextResponse.json({ error: "Message too long (max 5000 chars)" }, { status: 400 });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : null;

  const sanitizedName = String(fromName).replace(/[<>"'`]/g, "").slice(0, 100);
  const sanitizedSubject = String(subject || "(no subject)").replace(/[<>"'`]/g, "").slice(0, 150);
  const sanitizedMessage = String(message).replace(/[<>"'`]/g, "").slice(0, 5000);

  await prisma.contact.create({
    data: {
      userId: owner?.id || null,
      fromName: sanitizedName,
      fromEmail: String(fromEmail).trim().slice(0, 120),
      subject: sanitizedSubject,
      message: sanitizedMessage
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.contact.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json({ messages });
}
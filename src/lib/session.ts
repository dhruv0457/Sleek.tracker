import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters long in production.");
  }
  console.warn("[session] SESSION_SECRET is weak/missing — using a dev-only fallback. Change before deploying.");
}

export interface SessionData {
  userId?: string;
  email?: string;
}

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET || "dev-only-change-this-to-a-long-random-string-at-least-32-chars-long",
  cookieName: "habittrack_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30
  }
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await getSession();
  if (!session.userId || !session.email) throw new Error("UNAUTHORIZED");
  return { id: session.userId, email: session.email };
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";

// Step 1: kick off Google OAuth. Requires an active session (the callback
// binds the returned token to that userId) and emits a random `state`
// cookie that the callback verifies to prevent OAuth CSRF / code injection.
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", process.env.NEXT_PUBLIC_URL || "http://localhost:3000"));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/gworkspace/callback`;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local." }, { status: 503 });
  }

  // High-entropy opaque state — bound to this user's session via the cookie.
  // The callback rejects any response whose state does not match this value.
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("gworkspace_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes is enough for a consent flow
  });

  const scope = encodeURIComponent("https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent&include_granted_scopes=true`;
  return NextResponse.redirect(url);
}

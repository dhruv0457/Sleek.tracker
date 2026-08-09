import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_code", req.url));
  }

  // Retrieve code verifier from cookie
  const codeVerifier = req.cookies.get("oauth_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_verifier", req.url));
  }

  // Exchange code for tokens with Google
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_token_failed", req.url));
  }

  const tokens = await tokenResponse.json();
  if (!tokens.id_token || !tokens.access_token) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_token", req.url));
  }

  // Get user info from Google
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_userinfo_failed", req.url));
  }

  const oauthUser = await userInfoResponse.json();
  const email = oauthUser.email?.toLowerCase();
  if (!email || !oauthUser.email_verified) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_email", req.url));
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: oauthUser.name ?? null,
      avatar: oauthUser.picture ?? null,
      provider: "google",
    },
    create: {
      email,
      name: oauthUser.name ?? null,
      avatar: oauthUser.picture ?? null,
      provider: "google",
      password: null,
      trialEndAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      settings: { create: {} },
    },
  });

  // Create session
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  // Clear the code verifier cookie
  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.delete("oauth_code_verifier");

  return response;
}
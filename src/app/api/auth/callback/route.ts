import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  console.log("[OAuth Callback] Received:", { code: !!code, error, state });

  if (error) {
    console.error("[OAuth Callback] OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  if (!code) {
    console.error("[OAuth Callback] No code received");
    return NextResponse.redirect(new URL("/login?error=oauth_no_code", req.url));
  }

  // Retrieve code verifier from cookie
  const codeVerifier = req.cookies.get("oauth_code_verifier")?.value;
  console.log("[OAuth Callback] Code verifier from cookie:", !!codeVerifier);
  if (!codeVerifier) {
    console.error("[OAuth Callback] No code verifier cookie");
    return NextResponse.redirect(new URL("/login?error=oauth_no_verifier", req.url));
  }

  // Verify required env vars
  const requiredEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  };
  
  for (const [key, value] of Object.entries(requiredEnv)) {
    if (!value) {
      console.error(`[OAuth Callback] Missing env var: ${key}`);
      return NextResponse.redirect(new URL(`/login?error=oauth_config_missing_${key}`, req.url));
    }
  }

  console.log("[OAuth Callback] Exchanging code for tokens...");

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

  console.log("[OAuth Callback] Token response status:", tokenResponse.status);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[OAuth Callback] Token exchange failed:", errorText);
    return NextResponse.redirect(new URL("/login?error=oauth_token_failed", req.url));
  }

  const tokens = await tokenResponse.json();
  console.log("[OAuth Callback] Tokens received:", { 
    hasAccessToken: !!tokens.access_token, 
    hasIdToken: !!tokens.id_token 
  });

  if (!tokens.access_token) {
    console.error("[OAuth Callback] No access token in response");
    return NextResponse.redirect(new URL("/login?error=oauth_no_token", req.url));
  }

  // Get user info from Google
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  console.log("[OAuth Callback] Userinfo response status:", userInfoResponse.status);

  if (!userInfoResponse.ok) {
    const errorText = await userInfoResponse.text();
    console.error("[OAuth Callback] Userinfo fetch failed:", errorText);
    return NextResponse.redirect(new URL("/login?error=oauth_userinfo_failed", req.url));
  }

  const oauthUser = await userInfoResponse.json();
  console.log("[OAuth Callback] User info received:", { email: oauthUser.email, verified: oauthUser.email_verified });

  const email = oauthUser.email?.toLowerCase();
  if (!email || !oauthUser.email_verified) {
    console.error("[OAuth Callback] Email not verified or missing");
    return NextResponse.redirect(new URL("/login?error=oauth_no_email", req.url));
  }

  // Upsert user in database
  try {
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
    console.log("[OAuth Callback] User upserted:", user.id);
  } catch (dbError) {
    console.error("[OAuth Callback] Database error:", dbError);
    return NextResponse.redirect(new URL("/login?error=oauth_db_failed", req.url));
  }

  // Create session
  try {
    const session = await getSession();
    // Need to re-fetch user to get ID
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error("[OAuth Callback] User not found after upsert");
      return NextResponse.redirect(new URL("/login?error=oauth_user_missing", req.url));
    }
    session.userId = user.id;
    session.email = user.email;
    await session.save();
    console.log("[OAuth Callback] Session saved for user:", user.id);
  } catch (sessionError) {
    console.error("[OAuth Callback] Session error:", sessionError);
    return NextResponse.redirect(new URL("/login?error=oauth_session_failed", req.url));
  }

  // Clear the code verifier cookie
  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.delete("oauth_code_verifier");

  console.log("[OAuth Callback] Success, redirecting to dashboard");
  return response;
}
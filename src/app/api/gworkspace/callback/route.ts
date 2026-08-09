import { NextRequest, NextResponse } from "next/server";
import { setGWorkspaceToken } from "@/lib/gworkspace";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  // Verify state to prevent OAuth CSRF hijacking
  const cookieStore = await cookies();
  const storedState = cookieStore.get("gworkspace_oauth_state")?.value;
  cookieStore.delete("gworkspace_oauth_state");
  const params = new URL(req.url).searchParams;
  const state = params.get("state");
  if (!storedState || !state || storedState !== state) {
    return NextResponse.redirect(new URL("/dashboard?gworkspace_error=csrf", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/gworkspace/callback`;
  const code = params.get("code");
  const err = params.get("error");

  if (err) return NextResponse.redirect(new URL("/dashboard?gworkspace_error=denied", req.url));
  if (!code || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Invalid OAuth callback" }, { status: 400 });
  }

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: "authorization_code"
      })
    });
    if (!r.ok) {
      console.error("Token exchange failed, status", r.status);
      return NextResponse.json({ error: "Google token exchange failed" }, { status: 502 });
    }
    const tokenJson = await r.json();
    await setGWorkspaceToken({
      access: tokenJson.access_token,
      refresh: tokenJson.refresh_token,
      scope: tokenJson.scope,
      ts: Date.now(),
      userId: session.userId,
    });
    return NextResponse.redirect(new URL("/dashboard?gworkspace=connected", req.url));
  } catch (e: any) {
    console.error("OAuth callback threw", e?.message ?? "unknown");
    return NextResponse.json({ error: "OAuth callback failed" }, { status: 500 });
  }
}
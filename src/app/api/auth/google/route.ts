import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { rateLimit, RL_AUTH } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { ...RL_AUTH, keyPrefix: "google-oauth" });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: "Failed to initiate Google sign-in" }, { status: 500 });
  }

  // The session cookie won't survive a cross-site redirect properly.
  // We must set it on the response before redirecting to Google.
  // The supabase client already set PKCE cookies via the cookieStore;
  // those are on the response by the time we return this redirect.
  return NextResponse.redirect(data.url);
}
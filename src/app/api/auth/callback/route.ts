import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
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

  const supabase = await createClient();
  const { data: oauthTokens, error: tokenError } = await supabase.auth.exchangeCodeForSession(code);
  if (tokenError || !oauthTokens?.user) {
    return NextResponse.redirect(new URL("/login?error=oauth_token_failed", req.url));
  }

  const oauthUser = oauthTokens.user;
  const email = oauthUser.email?.toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_email", req.url));
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: oauthUser.user_metadata?.full_name ?? oauthUser.user_metadata?.name ?? null,
      avatar: oauthUser.user_metadata?.avatar_url ?? null,
      provider: "google",
    },
    create: {
      email,
      name: oauthUser.user_metadata?.full_name ?? oauthUser.user_metadata?.name ?? null,
      avatar: oauthUser.user_metadata?.avatar_url ?? null,
      provider: "google",
      password: null,
      trialEndAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      settings: { create: {} },
    },
  });

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  // iron-session v8 writes the encrypted cookie automatically to the
  // underlying response via the cookie-store proxy. A 307/302 redirect
  // will carry those Set-Cookie headers as long as we use a new Response
  // rather than NextResponse.redirect — some Next.js builds strip
  // manually-added headers from redirect helper objects.
  return Response.redirect(new URL("/dashboard", req.url), 302);
}
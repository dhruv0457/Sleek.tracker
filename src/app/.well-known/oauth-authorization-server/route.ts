import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    issuer: "https://sleek-tracker.vercel.app",
    authorization_endpoint: "https://sleek-tracker.vercel.app/api/auth/oauth/authorize",
    token_endpoint: "https://sleek-tracker.vercel.app/api/auth/oauth/token",
    jwks_uri: "https://sleek-tracker.vercel.app/.well-known/jwks.json",
    scopes_supported: ["read:habits", "write:habits", "offline_access"],
    response_types_supported: ["code", "token", "id_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"]
  });
}

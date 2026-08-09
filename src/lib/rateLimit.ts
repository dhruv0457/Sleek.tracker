// ============================================================
// In-memory rate limiter for API routes.
// Uses a sliding-window token-bucket per IP+route-key. Works in
// serverless (state lives per warm instance; cold starts reset the
// window — acceptable for the habit tracker's traffic pattern).
//
// Attack vectors this mitigates:
//   - Brute-force password spraying on /api/auth/login
//   - Account enumeration via /api/auth/register
//   - AI prompt flooding on /api/insights/chat
//   - Arbitrary API route abuse (NoSQL injection probes, etc.)
// ============================================================

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup — expire stale buckets every 5 minutes so the map
// never grows unbounded in long-running serverless containers.
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (now - b.lastRefill > 600_000) buckets.delete(key);
  }
  // Hard cap — cull extra entries if over 5000 (prevent DOS via IP rotation)
  if (buckets.size > 5000) {
    const cutoff = now - 600_000;
    for (const [key, b] of buckets) {
      if (b.lastRefill < cutoff) buckets.delete(key);
    }
  }
}

interface RateLimitOptions {
    /** Maximum tokens (requests) allowed in the window. */
    max: number;
    /** Window size in ms. */
    windowMs: number;
    /** Identifier prefix — defaults to the route path. */
    keyPrefix?: string;
}

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * Call from any API route handler. Returns `{ ok: false }` when the
 * caller has exceeded the quota — in that case the route should return
 * HTTP 429 with a Retry-After header.
 *
 *   const rl = rateLimit(req, { max: 5, windowMs: 60_000 });
 *   if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
 */
export function rateLimit(
    req: Request,
    opts: RateLimitOptions
): RateLimitResult {
    maybeCleanup();

    // Identify the caller by IP (fall back to a forwarded header on Vercel).
    const fwd = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = (realIp || (fwd ? fwd.split(",")[0].trim() : "unknown")).trim();

    const routeKey = opts.keyPrefix || new URL(req.url).pathname;
    const key = `${routeKey}:${ip}`;

    const now = Date.now();
    const refillRate = opts.max / opts.windowMs; // tokens per ms

    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { tokens: opts.max, lastRefill: now };
        buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time (token bucket).
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(opts.max, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    // Not enough tokens — compute when the next one will be available.
    const msUntilNext = Math.ceil((1 - bucket.tokens) / refillRate);
    return { ok: false, remaining: 0, retryAfterMs: msUntilNext };
}

// ============================================================
// Preset rate-limit profiles used across the app.
// ============================================================

export const RL_AUTH = { max: 10, windowMs: 60_000 };      // 10/min for login + register
export const RL_AI = { max: 12, windowMs: 60_000 };         // 12/min for Gemini chat
export const RL_WRITE = { max: 60, windowMs: 60_000 };      // 60/min for habit/checkin writes
export const RL_VERIFIER = { max: 8, windowMs: 60_000 };    // 8/min for AI verifier POSTs

/** Helper: returns a 429 Response with proper headers. */
export function tooManyRequests(retryAfterMs: number, message = "Too many requests — slow down."): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 429,
        headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
    });
}

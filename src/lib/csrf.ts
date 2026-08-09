function getAllowedOrigins(): string[] {
  const urls: string[] = [];
  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_URL"]) {
    const v = process.env[key as keyof NodeJS.ProcessEnv] as string | undefined;
    if (v) {
      try { urls.push(new URL(v).origin); } catch {}
    }
  }
  // Always allow localhost dev origins so dev servers on any port don't get
  // 403'd by a stale NEXT_PUBLIC_APP_URL=http://localhost:3000 entry.
  if (process.env.NODE_ENV !== "production") {
    urls.push("http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001");
  }
  return Array.from(new Set(urls));
}

function originOf(url: string): string | null {
  try { return new URL(url).origin; } catch { return null; }
}

export function checkCsrf(req: Request): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return true; // nothing configured → skip

  const origin = req.headers.get("origin");
  let candidate: string | null = origin;

  if (!candidate) {
    // Same-origin fetch() from the browser may omit Origin but always sends Referer.
    const referer = req.headers.get("referer");
    if (!referer) return true; // no header to compare → trust (browser clients always send one for same-origin)
    candidate = originOf(referer);
  }

  if (!candidate) return true; // couldn't parse → don't block
  return allowed.includes(candidate);
}

import { cookies } from "next/headers";

interface GWorkspaceToken {
  access: string;
  refresh?: string;
  scope?: string;
  ts: number;
  userId?: string;
}

const MAX_AGE = 55 * 60;

function encodeToken(token: GWorkspaceToken): string {
  const secret = process.env.SESSION_SECRET || "change-this";
  const payload = JSON.stringify(token);
  const xored = [...payload].map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ secret.charCodeAt(i % secret.length))
  ).join("");
  return Buffer.from(xored).toString("base64");
}

function decodeToken(encoded: string): GWorkspaceToken | null {
  const secret = process.env.SESSION_SECRET || "change-this";
  try {
    const xored = Buffer.from(encoded, "base64").toString("utf-8");
    const payload = [...xored].map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ secret.charCodeAt(i % secret.length))
    ).join("");
    const obj = JSON.parse(payload);
    if (!obj.access || !obj.ts) return null;
    if (Date.now() - obj.ts > MAX_AGE * 1000) return null;
    return obj as GWorkspaceToken;
  } catch {
    return null;
  }
}

export async function setGWorkspaceToken(token: GWorkspaceToken): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("gworkspace_token", encodeToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getGWorkspaceToken(expectedUserId?: string): Promise<GWorkspaceToken | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("gworkspace_token");
  if (!cookie?.value) return null;
  const token = decodeToken(cookie.value);
  if (!token) return null;
  // Reject the token if it was issued to a different user — defends against
  // cookie replay after the user logs out / logs in as someone else.
  if (expectedUserId && token.userId && token.userId !== expectedUserId) return null;
  return token;
}

export async function deleteGWorkspaceToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("gworkspace_token");
}
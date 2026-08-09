import { prisma } from "@/lib/prisma";

export type Tier = "free" | "basic_pro" | "ultra_pro";

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  locality: string | null;
  tier: Tier;
  trialEndAt: Date | null;
}

export async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar, bio: u.bio,
    locality: u.locality, tier: u.tier as Tier, trialEndAt: u.trialEndAt
  };
}

/** True if user is on a paid tier OR inside their 2-day trial. */
export function hasPremiumAccess(user: { tier: Tier; trialEndAt: Date | null }): boolean {
  if (user.tier === "basic_pro" || user.tier === "ultra_pro") return true;
  if (user.trialEndAt && new Date() < user.trialEndAt) return true;
  return false;
}

/** Gate the camera / AI verifier feature (basic_pro OR ultra_pro OR trial). */
export function canUseAIVerifier(user: { tier: Tier; trialEndAt: Date | null }): boolean {
  return hasPremiumAccess(user);
}

/** Gate AI Insights LLM chat (ultra_pro OR trial). */
export function canUseAIInsights(user: { tier: Tier; trialEndAt: Date | null }): boolean {
  if (user.tier === "ultra_pro") return true;
  if (user.trialEndAt && new Date() < user.trialEndAt) return true;
  return false;
}

/** Gate Google Workspace exports (ultra_pro OR trial). */
export function canExportWorkspace(user: { tier: Tier; trialEndAt: Date | null }): boolean {
  return canUseAIInsights(user);
}

/** Gate automated Gmail sending (basic_pro OR ultra_pro OR trial). */
export function canUseAutoEmail(user: { tier: Tier; trialEndAt: Date | null }): boolean {
  return hasPremiumAccess(user);
}

/** Days remaining in trial (zero if not in trial or trial expired). */
export function trialDaysLeft(user: { tier: Tier; trialEndAt: Date | null }): number {
  if (!user.trialEndAt) return 0;
  const ms = user.trialEndAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

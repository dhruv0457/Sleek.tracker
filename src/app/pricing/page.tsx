import { getSession } from "@/lib/session";
import { getUserInfo } from "@/lib/tier";
import { PricingPageClient } from "./page.client";

export default async function PricingPageServer() {
  const session = await getSession();
  let userInfo = null;
  if (session.userId) {
    userInfo = await getUserInfo(session.userId);
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: "var(--bg)" }}>
      <PricingPageClient
        currentTier={userInfo?.tier || "free"}
        isLoggedIn={!!session.userId}
      />
    </div>
  );
}
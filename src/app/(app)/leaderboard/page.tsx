import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LeaderboardPageClient } from "@/components/focus/LeaderboardPage";

export const metadata = { title: "Leaderboard — sleek" };

export default async function LeaderboardRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <LeaderboardPageClient />;
}
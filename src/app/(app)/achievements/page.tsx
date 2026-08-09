import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AchievementsPageClient } from "@/components/focus/AchievementsPage";

export const metadata = { title: "Achievements — sleek" };

export default async function AchievementsRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <AchievementsPageClient />;
}
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { StatsPageClient } from "@/components/focus/StatsPage";

export const metadata = { title: "Statistics — sleek" };

export default async function StatsRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <StatsPageClient />;
}
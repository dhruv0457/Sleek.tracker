import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { runAutoSkip } from "@/lib/autoskip";
import { DashboardOverview } from "@/components/DashboardOverview";

export const metadata = { title: "Overview — sleek" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Run auto-skip before the client fetches habits so the dashboard reflects
  // any auto-skipped checkins for the day.
  await runAutoSkip(session.userId);

  return <DashboardOverview />;
}

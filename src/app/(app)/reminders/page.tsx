import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RemindersPageClient } from "@/components/focus/RemindersPage";

export const metadata = { title: "Reminders — sleek" };

export default async function RemindersRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <RemindersPageClient />;
}
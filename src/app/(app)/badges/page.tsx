import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BadgesPageClient } from "@/components/focus/BadgesPage";

export const metadata = { title: "Badges — sleek" };

export default async function BadgesRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <BadgesPageClient />;
}
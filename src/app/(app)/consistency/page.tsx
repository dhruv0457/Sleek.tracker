import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ConsistencyPageClient } from "@/components/focus/ConsistencyPage";

export const metadata = { title: "Consistency — sleek" };

export default async function ConsistencyRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <ConsistencyPageClient />;
}

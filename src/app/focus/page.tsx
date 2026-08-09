import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import FocusPageClient from "@/components/focus/PixelForestFocus";

export const metadata = { title: "Focus Zone — sleek" };

export default async function FocusRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <FocusPageClient />;
}
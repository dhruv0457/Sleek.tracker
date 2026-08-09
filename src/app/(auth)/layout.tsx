import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already-authenticated users have no business on the login/register pages;
  // bounce them to the dashboard. (Mirror of the (app) guard.)
  const session = await getSession();
  if (session.userId) redirect("/dashboard");
  return <>{children}</>;
}

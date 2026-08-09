import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TasksPageClient } from "@/components/focus/TasksPage";

export const metadata = { title: "Tasks — sleek" };

export default async function TasksRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return <TasksPageClient />;
}
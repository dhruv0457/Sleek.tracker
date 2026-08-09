import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const c = cookieStore.get("habittrack_session");
  redirect(c ? "/dashboard" : "/landing");
}
import { redirect } from "next/navigation";

// Settings now lives in a single unified popup launched from the dashboard
// (ProfileChip → SettingsModal), so the standalone /settings page is gone.
// Keep the route as a redirect so existing links/bookmarks still work.
export default function SettingsRoute() {
  redirect("/dashboard");
}

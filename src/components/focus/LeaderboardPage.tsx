"use client";

import { LeaderboardPanel } from "@/components/panels/LeaderboardPanel";

export function LeaderboardPageClient() {
  return (
    <div className="p-6 lg:p-8 max-w-[1100px] w-full mx-auto">
      <LeaderboardPanel />
    </div>
  );
}

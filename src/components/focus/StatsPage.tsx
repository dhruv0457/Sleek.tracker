"use client";

import { StatsPanel } from "@/components/panels/StatsPanel";

export function StatsPageClient() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] w-full mx-auto">
      <StatsPanel />
    </div>
  );
}

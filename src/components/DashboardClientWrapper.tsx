"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })), {
  ssr: false,
});

export default function DashboardClientWrapper({
  habits,
  habitsForToday,
  checkinsByDate,
  ...rest
}: any) {
  return (
    <Dashboard
      habits={habits}
      habitsForToday={habitsForToday}
      checkinsByDate={checkinsByDate}
      {...rest}
    />
  );
}
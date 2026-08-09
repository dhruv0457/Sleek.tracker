"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPanel } from "@/components/panels/CalendarPanel";
import type { HabitData } from "@/components/types";
import { MONTHS_LONG, pad, mondayIndex } from "@/lib/utils";

function currentMonthName() {
  const now = new Date();
  return `${MONTHS_LONG[now.getMonth()]} ${now.getFullYear()}`;
}

export function ConsistencyPageClient() {
  const [habits, setHabits] = useState<HabitData[]>([]);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/habits");
    const d = await r.json();
    if (d.error === "Unauthorized") {
      window.location.href = "/login";
      return;
    }
    setHabits(
      (d.habits || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        color: h.color,
        targetMins: h.targetMins,
        intensityTarget: h.intensityTarget ?? 100,
        requiresCamera: !!h.requiresCamera,
        schedule: h.schedule,
        checkins: (h.checkins || []).map((c: any) => ({
          date: c.date,
          completed: c.completed,
          minutes: c.minutes,
          status: c.status,
          locked: c.locked,
          intensity: c.intensity ?? 0,
          multitasking: !!c.multitasking,
          note: c.note ?? null,
        })),
      }))
    );
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
      <CalendarPanel habits={habits} monthName={currentMonthName()} onChanged={refresh} />
    </div>
  );
}

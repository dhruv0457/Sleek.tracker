"use client";

import { useCallback, useEffect, useState } from "react";
import { HabitPanel } from "@/components/panels/HabitPanel";
import type { HabitData } from "@/components/types";

export function TasksPageClient() {
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
    <div className="p-6 lg:p-8 max-w-[1200px] w-full mx-auto">
      <HabitPanel habits={habits} onChanged={refresh} />
    </div>
  );
}

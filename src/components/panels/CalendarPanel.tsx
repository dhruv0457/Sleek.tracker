"use client";

import { EverydayGrid } from "./EverydayGrid";
import type { HabitData } from "@/components/types";

interface CalendarPanelProps {
  habits: HabitData[];
  monthName: string;
  onChanged: () => void;
  onAddHabit?: () => void;
}

export function CalendarPanel({ habits, onAddHabit }: CalendarPanelProps) {
  return (
    <div className="space-y-5 animate-fade-up">
      <EverydayGrid habits={habits} onAddHabit={onAddHabit || (() => {})} />
    </div>
  );
}

export interface HabitData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetMins: number;
  intensityTarget: number;
  requiresCamera: boolean;
  schedule: string;
  checkins: {
    date: string;
    completed: boolean;
    minutes: number;
    status?: string;
    locked?: boolean;
    intensity?: number;
    multitasking?: boolean;
    note?: string | null;
  }[];
}

export interface MonthCell {
  date: string | null;
  day: number | null;
  doneCount: number;
  total: number;
  minutes: number;
  intensityAvg: number;
}

export interface HabitMonthSummary {
  id: string;
  name: string;
  color: string;
  checks: number;
  minutes: number;
  targetMins: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
  total: number;
  minutes: number;
  intensity: number;
  multitasking: boolean;
  level: number;
  status?: string;
}

export interface TrophyData {
  id: string;
  label: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  description: string;
  color: string;
  earned: boolean;
}

export interface BadgeData {
  id: string;
  badgeId: string;
  label: string;
  line: string;
  level: number;
  earned: boolean;
  unlockedAt: string | null;
}

export interface DashboardProps {
  habits: HabitData[];
  /** Only habits whose schedule fires TODAY — drives the Today check-in cards.
   *  Future-dated or non-scheduled-today habits live in `habits` for the
   *  consistency grid but should not appear as today's tasks. */
  habitsForToday?: HabitData[];
  checkinsByDate: Record<string, Record<string, { completed: boolean; minutes: number; intensity?: number; multitasking?: boolean }>>;
  monthCells: MonthCell[];
  habitMonthSummary: HabitMonthSummary[];
  streak: { current: number; best: number };
  dailyMinutes: { date: string; minutes: number }[];
  completedToday: number;
  today: string;
  monthName: string;
  heatmapYear: Record<string, HeatmapCell[]>;
  totalCheckins: number;
  totalMinutes: number;
  perfectDays: number;
}

export interface UserFull {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  locality: string | null;
  tier: "free" | "basic_pro" | "ultra_pro";
  trialDaysLeft: number;
  settings?: {
    multitaskingDefault: boolean;
    emailsMorning: boolean;
    emailsEvening: boolean;
    pushEnabled: boolean;
    autoSkipOn: boolean;
    weekStartMon: boolean;
    theme: "light" | "dark";
  } | null;
}

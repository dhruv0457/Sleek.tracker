import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateStr(d: Date): string {
  return todayStr(d);
}

export function last365Days(end: Date = new Date()): Date[] {
  const days: Date[] = [];
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  let cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthDays(year: number, monthIdx: number): Date[] {
  const result: Date[] = [];
  const last = new Date(year, monthIdx + 1, 0).getDate();
  for (let day = 1; day <= last; day++) result.push(new Date(year, monthIdx, day));
  return result;
}

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_MIN = ["S", "M", "T", "W", "T", "F", "S"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Monday-first variants (for calendar grids that start on Monday)
export const WEEKDAYS_SHORT_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_MIN_MON = ["M", "T", "W", "T", "F", "S", "S"];

// Convert JS getDay() (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
export function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

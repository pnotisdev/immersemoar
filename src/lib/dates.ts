import { TZDate } from "@date-fns/tz";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";

/** "2026-09-15" for the given instant, in the user's timezone. */
export function dayKey(date: Date, tz: string): string {
  const d = new TZDate(date, tz);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Midnight (start) of the given "YYYY-MM-DD" in the user's timezone, as a UTC instant. */
export function dayStart(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, tz).getTime());
}

/** Exclusive end (next midnight) of a "YYYY-MM-DD" in tz. */
export function dayEnd(key: string, tz: string): Date {
  return addDays(dayStart(key, tz), 1);
}

export type RangePreset = "today" | "week" | "month" | "year" | "7d" | "30d" | "365d" | "all";

export interface DateRange {
  /** inclusive */
  from: Date;
  /** exclusive */
  to: Date;
  label: string;
}

/** Resolve a preset to concrete UTC instants using the user's timezone. */
export function presetRange(preset: RangePreset, tz: string, now = new Date()): DateRange {
  const n = new TZDate(now, tz);
  const toDate = (d: Date) => new Date(d.getTime());
  switch (preset) {
    case "today":
      return { from: toDate(startOfDay(n)), to: toDate(addDays(startOfDay(n), 1)), label: "Today" };
    case "week": {
      const s = startOfWeek(n, { weekStartsOn: 1 });
      return { from: toDate(s), to: toDate(addDays(s, 7)), label: "This week" };
    }
    case "month":
      return { from: toDate(startOfMonth(n)), to: toDate(addDays(startOfDay(endOfMonth(n)), 1)), label: "This month" };
    case "year":
      return { from: toDate(startOfYear(n)), to: toDate(addDays(startOfDay(endOfYear(n)), 1)), label: "This year" };
    case "7d":
      return { from: toDate(startOfDay(subDays(n, 6))), to: toDate(addDays(startOfDay(n), 1)), label: "Last 7 days" };
    case "30d":
      return { from: toDate(startOfDay(subDays(n, 29))), to: toDate(addDays(startOfDay(n), 1)), label: "Last 30 days" };
    case "365d":
      return { from: toDate(startOfDay(subDays(n, 364))), to: toDate(addDays(startOfDay(n), 1)), label: "Last 365 days" };
    case "all":
      return { from: new Date(0), to: toDate(endOfDay(n)), label: "All time" };
  }
}

/** Every "YYYY-MM-DD" from `from` up to (excluding) `to`, in tz. */
export function eachDayKey(from: Date, to: Date, tz: string): string[] {
  const keys: string[] = [];
  let cursor = startOfDay(new TZDate(from, tz));
  const end = new TZDate(to, tz);
  while (cursor < end) {
    keys.push(dayKey(cursor, tz));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/** For <input type="datetime-local">: local wall-clock string in tz, no seconds. */
export function toLocalInputValue(date: Date, tz: string): string {
  const d = new TZDate(date, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of toLocalInputValue: interpret "YYYY-MM-DDTHH:mm" as wall-clock in tz. */
export function fromLocalInputValue(value: string, tz: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, tz).getTime());
}

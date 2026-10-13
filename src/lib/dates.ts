// All calendar logic uses Asia/Jakarta (UTC+7, no DST).
const OFFSET_MS = 7 * 60 * 60 * 1000;
export const TIMEZONE = "Asia/Jakarta";

export type MonthKey = `${number}-${string}`; // "2026-10"

export function currentMonth(now = new Date()): MonthKey {
  const local = new Date(now.getTime() + OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** UTC instants bounding the month in Jakarta time: [start, end). */
export function monthRange(month: MonthKey): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - OFFSET_MS),
  };
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: MonthKey): string {
  const { start } = monthRange(month);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: TIMEZONE }).format(
    start,
  );
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

/** "YYYY-MM-DD" in Jakarta for a date input. */
export function toDateInput(value: Date = new Date()): string {
  return new Date(value.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A date input ("YYYY-MM-DD") becomes that day at the current Jakarta time-of-day (or noon). */
export function fromDateInput(value: string, now = new Date()): Date {
  if (value === toDateInput(now)) return now;
  return new Date(`${value}T12:00:00+07:00`);
}

export function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

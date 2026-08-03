/**
 * Conversions between the `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings the forms
 * and the API pass around, and the `Date` objects the calendar works in.
 *
 * Everything here is deliberately **local time**. `new Date("2025-01-05")` is
 * parsed as UTC midnight, which renders as the 4th anywhere west of Greenwich —
 * so a delivery date picked in the calendar would come back a day early.
 */

/** Parse `YYYY-MM-DD` (or the date half of a datetime) as a local date. */
export function parseDateValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a local date back to `YYYY-MM-DD`. */
export function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The `HH:mm` half of a `YYYY-MM-DDTHH:mm` value, or a fallback. */
export function timePart(value: string | undefined, fallback = "00:00"): string {
  const time = value?.slice(11, 16);
  return time && /^\d{2}:\d{2}$/.test(time) ? time : fallback;
}

/** Today at local midnight — the boundary `min`/`max` bounds compare against. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

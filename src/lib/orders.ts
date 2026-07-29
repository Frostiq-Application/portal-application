import type { OrderStatus } from "@/types";
import { formatTimeLabel } from "@/lib/branch";

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  placed: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  confirmed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  preparing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  out_for_delivery: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * Accent colour per status as a raw hex — used to tint the active tab's icon,
 * underline and count pill so each queue stage reads as its own colour.
 */
export const ORDER_STATUS_ACCENT: Record<OrderStatus, string> = {
  placed: "#f97316", // orange
  confirmed: "#6366f1", // indigo
  preparing: "#f59e0b", // amber
  ready: "#14b8a6", // teal
  out_for_delivery: "#a855f7", // purple
  delivered: "#10b981", // emerald
  cancelled: "#94a3b8", // slate
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Forward (non-cancel) transitions, matching the backend OMS pipeline. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed"],
  confirmed: ["preparing"],
  preparing: ["ready"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const CANCELLABLE: OrderStatus[] = ["placed", "confirmed", "preparing"];

export const ORDER_STATUS_FILTERS: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

// ------------------------------------------------------------- delivery day --

/**
 * Delivery-day tabs. The queue's real question is "what do we make first", and
 * that is answered by the delivery date far more than by anything else, so the
 * day is a first-class filter rather than a date box people have to type into.
 * "other" covers both past dates and anything beyond the day after tomorrow —
 * so no order can hide between the tabs.
 */
export type OrderDateBucket =
  | "all"
  | "today"
  | "tomorrow"
  | "overmorrow"
  | "other";

export const DATE_BUCKET_ITEMS: { value: OrderDateBucket; label: string }[] = [
  { value: "all", label: "All days" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "overmorrow", label: "Day after" },
  { value: "other", label: "Other days" },
];

export type OrderSortBy = "schedule" | "slot" | "total" | "created";
export type SortDir = "asc" | "desc";

/**
 * Today as YYYY-MM-DD in the *browser's* timezone.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that is UTC, so a shop in IST
 * would see its evening orders fall into "tomorrow" after 5:30pm.
 */
export function isoToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

/** "Today" / "Tomorrow" / "Day after" / "Yesterday" — null for anything else. */
export function relativeDayLabel(iso: string, today: string): string | null {
  const diff = daysBetween(today, iso);
  switch (diff) {
    case 0:
      return "Today";
    case 1:
      return "Tomorrow";
    case 2:
      return "Day after";
    case -1:
      return "Yesterday";
    default:
      return null;
  }
}

/** "in 5 days" / "5 days ago" — the distance the short labels don't cover. */
export function dayDistanceLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (Number.isNaN(diff)) return "";
  if (diff > 0) return `in ${diff} days`;
  if (diff < 0) return `${-diff} days ago`;
  return "";
}

/** "2026-07-29" -> "Wed, 29 Jul". */
export function shortDayDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The delivery window as staff would say it out loud: "10:00 AM – 12:00 PM",
 * or just the start when the shop only recorded one. Null means the order has
 * no slot at all, which the table renders as "Any time" rather than a blank.
 */
export function formatSlotRange(
  start?: string | null,
  end?: string | null,
): string | null {
  if (!start) return null;
  const from = formatTimeLabel(start.slice(0, 5));
  if (!end) return from;
  return `${from} – ${formatTimeLabel(end.slice(0, 5))}`;
}

/**
 * An order is late when its delivery day has passed and it is still in the
 * pipeline — worth flagging on the row, since those are the ones that hurt.
 */
export function isOverdue(
  scheduledDate: string,
  status: OrderStatus,
  today: string,
): boolean {
  if (status === "delivered" || status === "cancelled") return false;
  return daysBetween(today, scheduledDate) < 0;
}

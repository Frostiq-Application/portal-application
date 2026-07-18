import type { OrderStatus } from "@/types";

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

import type { OrderStatus } from "@/types";

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  placed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  confirmed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  preparing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  out_for_delivery: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
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

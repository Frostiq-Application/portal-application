import type {
  BillingCycle,
  PaymentMethodType,
  SubscriptionStatus,
} from "@/types";

/** Human labels for status pills. */
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  suspended: "Suspended",
};

/** Tailwind tone classes for the status pill (light + dark). */
export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
  suspended:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const BILLING_CYCLE_SHORT: Record<BillingCycle, string> = {
  monthly: "mo",
  quarterly: "qtr",
  annual: "yr",
};

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodType, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

/** Window (in days) within which an upcoming renewal is considered "due soon". */
export const DUE_SOON_DAYS = 7;

export type RenewalUrgency = "overdue" | "soon" | "upcoming" | "none";

export interface RenewalInfo {
  /** Whole days until renewal; negative = overdue. `null` when N/A (cancelled/expired). */
  days: number | null;
  urgency: RenewalUrgency;
  /** e.g. "in 5 days", "Overdue by 2 days", "Today". */
  label: string;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Compute renewal timing from a subscription's status + nextBillingDate. */
export function getRenewalInfo(
  status: SubscriptionStatus,
  nextBillingDate: string | null,
): RenewalInfo {
  if (status === "cancelled" || status === "expired" || !nextBillingDate) {
    return { days: null, urgency: "none", label: "—" };
  }
  const target = new Date(nextBillingDate + "T00:00:00").getTime();
  if (Number.isNaN(target)) {
    return { days: null, urgency: "none", label: "—" };
  }
  const days = Math.round((target - startOfToday()) / 86_400_000);

  if (days < 0) {
    const n = Math.abs(days);
    return {
      days,
      urgency: "overdue",
      label: `Overdue by ${n} day${n === 1 ? "" : "s"}`,
    };
  }
  if (days === 0) return { days, urgency: "soon", label: "Renews today" };
  if (days <= DUE_SOON_DAYS) {
    return { days, urgency: "soon", label: `Renews in ${days} days` };
  }
  return { days, urgency: "upcoming", label: `Renews in ${days} days` };
}

/** Pill tone classes keyed by renewal urgency (light + dark). */
export const RENEWAL_TONE: Record<RenewalUrgency, string> = {
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  soon: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  upcoming:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  none: "bg-muted text-muted-foreground",
};

/** Short pill label with a leading dot glyph for the row. */
export function renewalDot(urgency: RenewalUrgency): string {
  switch (urgency) {
    case "overdue":
      return "🔴";
    case "soon":
      return "🟠";
    case "upcoming":
      return "🟢";
    default:
      return "⚪";
  }
}

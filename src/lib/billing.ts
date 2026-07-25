import type { SubscriptionStatus } from "@/types";
import type { PaymentStatus, PaymentType, Quote } from "@/types/billing";

/** Human labels for the lifecycle pill. */
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  grace: "Payment pending",
  locked: "Locked",
  cancelled: "Cancelled",
};

/**
 * Tone per status. Note `grace` is amber, not red: the storefront is still
 * live and orders are still coming in — it's a warning, not an outage.
 */
export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  grace: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  locked: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

/** One-line explanation of what each status means for the storefront. */
export const SUBSCRIPTION_STATUS_HELP: Record<SubscriptionStatus, string> = {
  trial:
    "Your storefront is fully live and taking real orders. Pick a plan before the trial ends to keep it that way — nothing is charged automatically.",
  active: "Everything's running normally.",
  grace:
    "Your storefront is still live so pending orders aren't disrupted — but payment is overdue.",
  locked:
    "Your storefront is offline. Paying restores it instantly; nothing has been deleted.",
  cancelled:
    "Your storefront is offline and your data is archived. Subscribe again to bring it back.",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  success: "Paid",
  failed: "Failed",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  first_payment: "First payment",
  renewal: "Renewal",
  upgrade_proration: "Upgrade (prorated)",
  addon_proration: "Add-on (prorated)",
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  too_expensive: "Too expensive",
  missing_features: "Missing features I need",
  switching_provider: "Switching to another provider",
  closing_business: "Closing or pausing the business",
  not_using_enough: "Not using it enough",
  technical_issues: "Technical issues",
  other: "Something else",
};

/** Readable label for a subscription event type in the timeline. */
export const EVENT_LABEL: Record<string, string> = {
  trial_started: "Trial started",
  trial_plan_switched: "Trial plan switched",
  checkout_started: "Checkout started",
  activated: "Activated",
  renewed: "Renewed",
  upgraded: "Upgraded",
  downgrade_scheduled: "Change scheduled",
  downgrade_undone: "Change undone",
  downgrade_applied: "Change applied",
  addon_purchased: "Add-on purchased",
  addon_removal_scheduled: "Add-on removal scheduled",
  addon_removal_undone: "Add-on removal undone",
  addon_removed: "Add-on removed",
  coupon_applied: "Coupon applied",
  payment_succeeded: "Payment succeeded",
  payment_failed: "Payment failed",
  grace_started: "Grace period started",
  locked: "Storefront locked",
  reactivated: "Reactivated",
  cancel_scheduled: "Cancellation scheduled",
  cancel_undone: "Cancellation undone",
  cancelled: "Cancelled",
  mandate_registered: "Autopay enabled",
  mandate_revoked: "Autopay revoked",
  items_archived: "Items archived",
  price_refreshed: "Price refreshed",
  plan_assigned: "Plan assigned",
  delete_ready: "Eligible for deletion",
  hard_deleted: "Data deleted",
  migrated: "Migrated to the new billing model",
};

/** Events that should read as a problem in the timeline. */
export const NEGATIVE_EVENTS = new Set([
  "payment_failed",
  "locked",
  "cancelled",
  "cancel_scheduled",
  "delete_ready",
  "hard_deleted",
  "grace_started",
]);

// -------------------------------------------------------------- formatting --

/** ₹1,23,456.00 — Indian digit grouping, always two decimals. */
export function inr(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** ₹1,499 — no decimals, for price cards where paise are noise. */
export function inrShort(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Whole days from now until `value`; negative when it's in the past. */
export function daysUntil(value?: string | Date | null): number {
  if (!value) return 0;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return 0;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** "in 12 days" / "3 days ago" / "today". */
export function relativeDays(value?: string | Date | null): string {
  const n = daysUntil(value);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
}

/**
 * The one-line summary under a plan card's price: what the cycle actually
 * costs and what it saves. The structural discount is always months free,
 * never a percentage, so it can never stack with a coupon (§5.2).
 */
export function cycleSavingsLabel(
  freeMonths: number,
  months: number,
): string | null {
  if (freeMonths <= 0) return null;
  const pct = Math.round((freeMonths / months) * 100);
  return `${freeMonths} month${freeMonths > 1 ? "s" : ""} free · save ${pct}%`;
}

// ---------------------------------------------------------------- Razorpay --

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (payload: unknown) => void) => void;
    };
  }
}

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

/** Load Razorpay's checkout script once, lazily. */
export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const el = document.createElement("script");
    el.src = RZP_SCRIPT;
    el.async = true;
    el.onload = () => resolve(true);
    el.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(el);
  });
  return scriptPromise;
}

export interface RazorpayResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Open Razorpay checkout and resolve with the signed result.
 *
 * Resolves `null` when the customer dismisses the modal — a cancelled payment
 * is a normal outcome, not an error, and must not surface as a red toast.
 * The signature is verified server-side; nothing here is trusted.
 */
export function openRazorpay(session: {
  razorpayKeyId: string;
  razorpayOrderId: string;
  amount: string;
  accountName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  description: string;
}): Promise<RazorpayResult | null> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Payment library failed to load. Check your connection."));
      return;
    }
    let settled = false;

    const rzp = new window.Razorpay({
      key: session.razorpayKeyId,
      order_id: session.razorpayOrderId,
      amount: Math.round(Number(session.amount) * 100),
      currency: "INR",
      name: "Frostique",
      description: session.description,
      prefill: {
        name: session.accountName,
        email: session.ownerEmail,
        contact: session.ownerPhone ?? undefined,
      },
      theme: { color: "#be123c" },
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        settled = true;
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          if (!settled) resolve(null);
        },
      },
    });

    rzp.on("payment.failed", (payload: unknown) => {
      settled = true;
      const description =
        (payload as { error?: { description?: string } })?.error?.description ??
        "Payment failed. No money has been taken.";
      reject(new Error(description));
    });

    rzp.open();
  });
}

/** Line items worth showing in a compact summary (skips zero rows). */
export function visibleQuoteLines(quote: Quote) {
  return quote.lines.filter((l) => Number(l.amount) !== 0);
}

// ---------------------------------------------------------------- download --

/** Mirrors the key `authSlice` persists to. */
const AUTH_STORAGE_KEY = "frostique-portal-auth";

function accessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken?: string }).accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Download an invoice PDF.
 *
 * Invoices are account-scoped on the server, so a plain `<a href>` would 401 —
 * the bearer token has to travel with the request. Fetch it as a blob and hand
 * that to the browser instead.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  fallbackName = "invoice.pdf",
): Promise<void> {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "http://localhost:3000/api/v1";
  const token = accessToken();

  const res = await fetch(`${base}/billing/invoices/${invoiceId}/download`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
    fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

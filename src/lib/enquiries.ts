import type { EnquiryStatus, EnquiryType } from "@/types";

/** Inbox order: unworked leads first, resolved ones last. */
export const ENQUIRY_STATUS_ORDER: EnquiryStatus[] = [
  "new",
  "contacted",
  "converted",
  "closed",
];

/** Human labels for the status badge and its menu. */
export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
};

/** Hex accents per status (aligned with the Orders / custom-cake palette). */
export const ENQUIRY_STATUS_ACCENT: Record<EnquiryStatus, string> = {
  new: "#3b82f6",
  contacted: "#f59e0b",
  converted: "#10b981",
  closed: "#64748b",
};

/** Tailwind tone classes for the status badge (light + dark). */
export const ENQUIRY_STATUS_TONE: Record<EnquiryStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  contacted: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  converted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

/** Human labels for the enquiry-type badge. */
export const ENQUIRY_TYPE_LABEL: Record<EnquiryType, string> = {
  general: "General Query",
  demo: "Book a Demo",
  custom_quote: "Custom Quotation",
  partnership: "Partnership",
  enterprise: "Enterprise",
  other: "Other",
};

/** Tailwind tone classes for the enquiry-type badge (light + dark). */
export const ENQUIRY_TYPE_TONE: Record<EnquiryType, string> = {
  general: "bg-muted text-muted-foreground",
  demo: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  custom_quote:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  partnership:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  // The highest-value lead on the page, so it gets the loudest badge.
  enterprise:
    "bg-foreground text-background",
  other: "bg-muted text-muted-foreground",
};

import type { EnquiryType } from "@/types";

/** Human labels for the enquiry-type badge. */
export const ENQUIRY_TYPE_LABEL: Record<EnquiryType, string> = {
  general: "General Query",
  demo: "Book a Demo",
  custom_quote: "Custom Quotation",
  partnership: "Partnership",
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
  other: "bg-muted text-muted-foreground",
};

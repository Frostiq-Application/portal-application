import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RENEWAL_TONE, getRenewalInfo } from "@/lib/subscriptions";
import type { Subscription } from "@/types";
import { Button } from "@/components/ui/button";

interface Props {
  subscriptions: Subscription[];
  accountName: (id: string) => string;
  onRecordPayment: (s: Subscription) => void;
  onOpen: (s: Subscription) => void;
}

/**
 * Surfaces subscriptions that are overdue or renewing within the due-soon
 * window at the top of the page, most urgent first, with a one-tap
 * "Record payment" affordance.
 */
export function RenewalAlerts({
  subscriptions,
  accountName,
  onRecordPayment,
  onOpen,
}: Props) {
  const atRisk = useMemo(() => {
    return subscriptions
      .map((s) => ({ s, r: getRenewalInfo(s.status, s.nextBillingDate) }))
      .filter(({ r }) => r.urgency === "overdue" || r.urgency === "soon")
      // Overdue (most negative) first, then soonest.
      .sort((a, b) => (a.r.days ?? 0) - (b.r.days ?? 0));
  }, [subscriptions]);

  if (atRisk.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5 dark:border-amber-900/50">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {atRisk.length} renewal{atRisk.length === 1 ? "" : "s"} need
          attention
        </span>
      </div>
      <ul className="divide-y divide-amber-200/70 dark:divide-amber-900/40">
        {atRisk.map(({ s, r }) => (
          <li
            key={s.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
              onClick={() => onOpen(s)}
            >
              {accountName(s.accountId)}
            </button>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                RENEWAL_TONE[r.urgency],
              )}
            >
              {r.label}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 bg-background"
              onClick={() => onRecordPayment(s)}
            >
              Record payment
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

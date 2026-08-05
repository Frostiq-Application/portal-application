import { Info, ShieldCheck } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/billing";
import type { Quote } from "@/types/billing";
import { Separator } from "@/components/ui/separator";

/**
 * The itemised amount preview shown before **every** charge (SH-08): plan,
 * add-ons, coupon, gateway fee and GST, with the exact total that will be
 * debited.
 *
 * The lines come straight from the server's quote — the client never re-derives
 * a total, so what's shown here and what's charged cannot drift apart.
 */
export function QuoteSummary({
  quote,
  className,
  title = "Amount due today",
  showApprovalNote = true,
}: {
  quote: Quote;
  className?: string;
  title?: string;
  showApprovalNote?: boolean;
}) {
  const lines = quote.lines.filter((l) => Number(l.amount) !== 0);

  return (
    <div className={cn("rounded-xl border bg-muted/30 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>

      <dl className="mt-3 space-y-2 text-sm">
        {lines.map((line) => {
          const amount = Number(line.amount);
          const isDiscount = amount < 0;
          return (
            <div key={line.key} className="flex items-start justify-between gap-3">
              <dt
                className={cn(
                  "min-w-0",
                  isDiscount
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {line.label}
                {line.qty > 1 && (
                  <span className="ml-1 text-xs opacity-70">× {line.qty}</span>
                )}
              </dt>
              <dd
                className={cn(
                  "shrink-0 tabular-nums font-medium",
                  isDiscount && "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {isDiscount ? `− ${inr(Math.abs(amount))}` : inr(amount)}
              </dd>
            </div>
          );
        })}
      </dl>

      <Separator className="my-3" />

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold tabular-nums">
          {inr(quote.totalAmount)}
        </span>
      </div>

      {!quote.gstApplicable && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" />
          GST is not applicable on this transaction.
        </p>
      )}

      {showApprovalNote && quote.requiresApproval && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            This amount is above the ₹15,000 RBI ceiling for automatic recurring
            debits, so each renewal will need your approval, even with autopay
            on. We'll email you when it's due.
          </span>
        </p>
      )}
    </div>
  );
}

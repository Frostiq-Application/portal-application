import { useMemo } from "react";
import { ArrowLeftRight, CreditCard, Receipt, XCircle } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import {
  BILLING_CYCLE_LABEL,
  BILLING_CYCLE_SHORT,
  PAYMENT_METHOD_LABEL,
  RENEWAL_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  getRenewalInfo,
} from "@/lib/subscriptions";
import { useSubscriptionPaymentsQuery } from "@/features/api/subscriptionsApi";
import type { Subscription } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  subscription: Subscription | null;
  accountName: string;
  planName: string;
  onOpenChange: (open: boolean) => void;
  onRecordPayment: (s: Subscription) => void;
  onChangePlan: (s: Subscription) => void;
  onCancel: (s: Subscription) => void;
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function SubscriptionDetailSheet({
  subscription: s,
  accountName,
  planName,
  onOpenChange,
  onRecordPayment,
  onChangePlan,
  onCancel,
}: Props) {
  const { data: payments, isLoading: paymentsLoading } =
    useSubscriptionPaymentsQuery(s?.id ?? "", { skip: !s });

  const renewal = useMemo(
    () => (s ? getRenewalInfo(s.status, s.nextBillingDate) : null),
    [s],
  );

  const totalPaid = useMemo(
    () => (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
    [payments],
  );

  return (
    <Sheet open={!!s} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {s && renewal && (
          <>
            <SheetHeader className="space-y-3 border-b p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate">{accountName}</SheetTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {planName} · {BILLING_CYCLE_LABEL[s.billingCycle]}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    SUBSCRIPTION_STATUS_TONE[s.status],
                  )}
                >
                  {SUBSCRIPTION_STATUS_LABEL[s.status]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold tracking-tight">
                  {money(s.priceAtSubscription)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{BILLING_CYCLE_SHORT[s.billingCycle]}
                  </span>
                </span>
                {renewal.urgency !== "none" && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      RENEWAL_TONE[renewal.urgency],
                    )}
                  >
                    {renewal.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => onRecordPayment(s)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record payment
                </Button>
                {s.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChangePlan(s)}
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Change plan
                  </Button>
                )}
                {s.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onCancel(s)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* Plan / billing facts */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-6">
              <Field label="Plan" value={planName} />
              <Field
                label="Billing cycle"
                value={BILLING_CYCLE_LABEL[s.billingCycle]}
              />
              <Field label="Start date" value={formatDate(s.startDate)} />
              <Field
                label="Next billing"
                value={formatDate(s.nextBillingDate)}
              />
              {s.trialEndsAt && (
                <Field label="Trial ends" value={formatDate(s.trialEndsAt)} />
              )}
              <Field
                label="Auto-renew"
                value={s.autoRenew ? "On" : "Off"}
              />
              {s.notes && (
                <div className="col-span-2">
                  <Field label="Notes" value={s.notes} />
                </div>
              )}
            </div>

            <Separator />

            {/* Payment history */}
            <div className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Payment history
                </h3>
                {!paymentsLoading && (payments?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {money(totalPaid)} collected
                  </span>
                )}
              </div>

              {paymentsLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : (payments?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No payments recorded yet.
                </div>
              ) : (
                <ol className="relative space-y-3 border-l pl-5">
                  {payments!.map((p) => (
                    <li key={p.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                      <div className="rounded-lg border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {money(p.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(p.paymentDate)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">{p.receiptNumber}</span>
                          <span>·</span>
                          <span>{PAYMENT_METHOD_LABEL[p.paymentMethod]}</span>
                          <span>·</span>
                          <span>
                            {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                          </span>
                        </div>
                        {p.referenceNote && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ref: {p.referenceNote}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

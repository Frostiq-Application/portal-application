import { useMemo } from "react";
import {
  Check,
  CreditCard,
  Mail,
  MessageCircle,
  Minus,
  Receipt,
} from "lucide-react";
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
import {
  useMySubscriptionQuery,
  useSubscriptionPaymentsQuery,
} from "@/features/api/subscriptionsApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { PlanFeatureKey } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const FEATURE_LABELS: { key: PlanFeatureKey; label: string }[] = [
  { key: "can_use_coupons", label: "Coupons" },
  { key: "can_use_analytics", label: "Analytics" },
  { key: "can_use_cms", label: "CMS / storefront content" },
  { key: "can_clone_catalog", label: "Catalog cloning" },
  { key: "priority_support", label: "Priority support" },
];

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function MySubscriptionPage() {
  const { entitlements } = useEntitlements();
  const { data: sub, isLoading, isError } = useMySubscriptionQuery();
  const { data: payments, isLoading: paymentsLoading } =
    useSubscriptionPaymentsQuery(sub?.id ?? "", { skip: !sub });

  const renewal = useMemo(
    () => (sub ? getRenewalInfo(sub.status, sub.nextBillingDate) : null),
    [sub],
  );
  const totalPaid = useMemo(
    () => (payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
    [payments],
  );

  const planName = entitlements?.planName ?? "—";
  const features = entitlements?.features ?? {};
  const support = entitlements?.support;

  return (
    <>
      <PageHeader
        title="Subscription"
        description="Your current plan, renewal, and payment history"
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      ) : isError || !sub || !renewal ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No subscription found for your account. Please contact the platform
            admin{support?.email ? ` at ${support.email}` : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Plan card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    {planName}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {BILLING_CYCLE_LABEL[sub.billingCycle]} billing
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    SUBSCRIPTION_STATUS_TONE[sub.status],
                  )}
                >
                  {SUBSCRIPTION_STATUS_LABEL[sub.status]}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold tracking-tight">
                  {money(sub.priceAtSubscription)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{BILLING_CYCLE_SHORT[sub.billingCycle]}
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

              {renewal.urgency === "overdue" && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  Your renewal is past due. Please complete payment with the
                  platform admin to avoid interruption.
                </div>
              )}
              {renewal.urgency === "soon" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                  Your plan renews soon. The platform admin will collect the next
                  payment.
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Started</span>
                  <span className="text-sm font-medium">
                    {formatDate(sub.startDate)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Next billing
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(sub.nextBillingDate)}
                  </span>
                </div>
                {sub.trialEndsAt && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Trial ends
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(sub.trialEndsAt)}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Plan features */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">What's included</h3>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {FEATURE_LABELS.map((f) => {
                    const on = Boolean(features[f.key]);
                    return (
                      <li
                        key={f.key}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          !on && "text-muted-foreground/60",
                        )}
                      >
                        {on ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground/40" />
                        )}
                        {f.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {(support?.email || support?.whatsapp) && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Need a plan change?
                    </span>
                    {support.email && (
                      <a
                        href={`mailto:${support.email}`}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {support.email}
                      </a>
                    )}
                    {support.whatsapp && (
                      <a
                        href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Payment history
                </CardTitle>
                {!paymentsLoading && (payments?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {money(totalPaid)} paid
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : (payments?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No payments yet.
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
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

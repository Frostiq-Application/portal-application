import { skipToken } from "@reduxjs/toolkit/query";
import { Mail, Phone, Store } from "@/components/ui/icons";
import { useAdminSubscriptionDetailQuery } from "@/features/api/billingAdminApi";
import {
  EVENT_LABEL,
  NEGATIVE_EVENTS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  PAYMENT_TYPE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  formatDateTime,
  inr,
  relativeDays,
} from "@/lib/billing";
import { cn, formatDate } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteSummary } from "./QuoteSummary";
import { AccountEntitlementsPanel } from "./AccountEntitlementsPanel";

/**
 * The platform admin's view of one subscription (SA-15/19).
 *
 * The timeline tab is the point of the whole screen: it answers "why is this
 * account locked?" without anyone having to reconstruct it from payment rows,
 * because the engine's automated transitions are recorded there alongside the
 * human ones.
 */
export function SubscriptionDetailSheet({
  subscriptionId,
  onOpenChange,
}: {
  subscriptionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useAdminSubscriptionDetailQuery(
    subscriptionId ?? skipToken,
  );

  const sub = data?.subscription;

  return (
    <Sheet open={subscriptionId != null} onOpenChange={onOpenChange}>
      {/* Wider than the usual sheet: the Features tab is a two-column list of
          every catalogue entry, and it turns unreadable below this. */}
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {data?.account?.name ?? "Subscription"}
            {sub && (
              <Badge className={SUBSCRIPTION_STATUS_TONE[sub.status]}>
                {SUBSCRIPTION_STATUS_LABEL[sub.status]}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {data?.plan
              ? `${data.plan.name} · ${sub?.billingCycle ?? ""}`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading || !data || !sub ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* ---- account ------------------------------------------- */}
              {data.account && (
                <div className="space-y-1.5 rounded-xl border p-4 text-sm">
                  <p className="flex items-center gap-2">
                    <Store className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs">
                      {data.account.appSlug}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {data.account.ownerEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {data.account.ownerPhone}
                  </p>
                  {data.account.gstin && (
                    <p className="text-muted-foreground">
                      GSTIN {data.account.gstin} · {data.account.billingState}
                    </p>
                  )}
                </div>
              )}

              {/* ---- lifecycle ----------------------------------------- */}
              <dl className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Renews</dt>
                  <dd>
                    {formatDate(sub.currentPeriodEnd)}{" "}
                    <span className="text-muted-foreground">
                      ({relativeDays(sub.currentPeriodEnd)})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Locked monthly price
                  </dt>
                  <dd className="tabular-nums">
                    {inr(sub.lockedMonthlyPrice)}
                  </dd>
                </div>
                {sub.trialEndsAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Trial ends</dt>
                    <dd>{formatDate(sub.trialEndsAt)}</dd>
                  </div>
                )}
                {sub.graceUntil && (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Grace until
                    </dt>
                    <dd className="text-amber-600 dark:text-amber-400">
                      {formatDate(sub.graceUntil)}
                    </dd>
                  </div>
                )}
                {sub.lockedUntil && (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Auto-cancels
                    </dt>
                    <dd className="text-destructive">
                      {formatDate(sub.lockedUntil)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Autopay</dt>
                  <dd>
                    {sub.autopayEnabled
                      ? sub.hasMandate
                        ? "On, mandate active"
                        : "On, mandate missing"
                      : "Off — manual payer"}
                  </dd>
                </div>
                {sub.dunningAttempt > 0 && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Dunning</dt>
                    <dd className="text-destructive">
                      Attempt {sub.dunningAttempt}
                      {sub.nextRetryAt &&
                        ` · next ${formatDate(sub.nextRetryAt)}`}
                    </dd>
                  </div>
                )}
                {sub.cancelReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Cancellation reason
                    </dt>
                    <dd className="capitalize">
                      {sub.cancelReason.replace(/_/g, " ")}
                    </dd>
                  </div>
                )}
                {sub.deleteReadyAt && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Data retention
                    </dt>
                    <dd>
                      Delete-ready {formatDate(sub.deleteReadyAt)} — nothing is
                      removed automatically.
                    </dd>
                  </div>
                )}
              </dl>

              <Tabs defaultValue="timeline">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="renewal">Next renewal</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4">
                  <ol className="space-y-3.5">
                    {data.timeline.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            NEGATIVE_EVENTS.has(e.eventType)
                              ? "bg-destructive"
                              : "bg-emerald-500",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {EVENT_LABEL[e.eventType] ?? e.eventType}
                            {!e.actorUserId && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                automated
                              </span>
                            )}
                          </p>
                          {e.summary && (
                            <p className="text-sm text-muted-foreground">
                              {e.summary}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(e.createdAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                    {data.timeline.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No events recorded yet.
                      </p>
                    )}
                  </ol>
                </TabsContent>

                <TabsContent value="payments" className="mt-4 space-y-2">
                  {data.payments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No payment attempts yet.
                    </p>
                  )}
                  {data.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {PAYMENT_TYPE_LABEL[p.type]}
                          {p.attemptNumber > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              retry {p.attemptNumber}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">
                            {inr(p.totalAmount)}
                          </span>
                          <Badge className={PAYMENT_STATUS_TONE[p.status]}>
                            {PAYMENT_STATUS_LABEL[p.status]}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(p.paidAt ?? p.createdAt)}
                        {p.paymentMethod && ` · ${p.paymentMethod}`}
                        {p.invoice && ` · ${p.invoice.invoiceNumber}`}
                      </p>
                      {p.failureReason && (
                        <p className="mt-1 text-xs text-destructive">
                          {p.failureReason}
                        </p>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="renewal" className="mt-4">
                  <QuoteSummary
                    quote={data.quote}
                    title={`Due ${formatDate(sub.currentPeriodEnd)}`}
                  />
                </TabsContent>

                <TabsContent value="features" className="mt-4">
                  {data.account ? (
                    <AccountEntitlementsPanel accountId={data.account.id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This subscription has no account attached.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  Gift,
  InfinityIcon,
  Loader2,
  PackagePlus,
  Receipt,
  Sparkles,
  TrendingUp,
  Zap,
} from "@/components/ui/icons";
import {
  useMyPaymentsQuery,
  useMyPlansQuery,
  useMySubscriptionQuery,
  useMyTimelineQuery,
  useStartFreeMutation,
  useStartTrialMutation,
  useSwitchFreePlanMutation,
  useUndoCancelMutation,
  useUndoScheduledChangeMutation,
} from "@/features/api/billingApi";
import { useMyEntitlementsQuery } from "@/features/api/entitlementsApi";
import {
  EVENT_LABEL,
  NEGATIVE_EVENTS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  PAYMENT_TYPE_LABEL,
  SUBSCRIPTION_STATUS_HELP,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  downloadInvoicePdf,
  formatDateTime,
  inr,
  inrShort,
} from "@/lib/billing";
import { cn, formatDate } from "@/lib/utils";
import type { CycleOption, PricingPlan, UsageRow } from "@/types/billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { StatusBanner } from "@/components/billing/StatusBanner";
import { PlanComparison } from "@/components/billing/PlanComparison";
import { ChangePlanSheet } from "@/components/billing/ChangePlanSheet";
import { AddonsSheet } from "@/components/billing/AddonsSheet";
import { CancelDialog } from "@/components/billing/CancelDialog";
import { QuoteSummary } from "@/components/billing/QuoteSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Shared empty-state block — the shadcn Empty primitive without its subparts. */
function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** A usage bar: live count against the **effective** limit (plan + add-ons). */
function UsageMeter({ row }: { row: UsageRow }) {
  const unlimited = row.isUnlimited || row.effective == null;
  const pct = unlimited
    ? 0
    : Math.min(100, Math.round((row.used / Math.max(1, row.effective!)) * 100));
  const atLimit = !unlimited && row.used >= row.effective!;
  const near = !unlimited && !atLimit && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{row.label}</span>
        <span
          className={cn(
            "text-sm tabular-nums",
            atLimit
              ? "font-semibold text-destructive"
              : near
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {row.used}
          {unlimited ? (
            <span className="ml-1 inline-flex items-baseline gap-1">
              / <InfinityIcon className="size-3.5 self-center" />
            </span>
          ) : (
            ` / ${row.effective}`
          )}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            unlimited
              ? "w-full bg-gradient-to-r from-primary/40 to-primary/10"
              : atLimit
                ? "bg-destructive"
                : near
                  ? "bg-amber-500"
                  : "bg-primary",
          )}
          style={unlimited ? undefined : { width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {row.trialCapped ? (
          <>Trial limit — your plan's full limit unlocks when you activate.</>
        ) : row.addonValue > 0 ? (
          <>
            {row.planValue} from your plan · +{row.addonValue} from add-ons
          </>
        ) : atLimit ? (
          <span className="text-destructive">
            You're at your limit — upgrade or add capacity to create more.
          </span>
        ) : (
          <>Included in your plan</>
        )}
      </p>
    </div>
  );
}

/**
 * The Shop Admin's subscription home (SH-17, SH-22).
 *
 * Three states, and they look genuinely different because they mean genuinely
 * different things: **no subscription** (pick a plan / start a trial),
 * **live** (the dashboard), and **needs attention** (grace or locked, where the
 * only thing that matters is paying).
 */
export function MySubscriptionPage() {
  const { data, isLoading, refetch } = useMySubscriptionQuery();
  const { data: entitlements } = useMyEntitlementsQuery();
  const { data: catalogue } = useMyPlansQuery();
  const { data: payments } = useMyPaymentsQuery();
  const { data: timeline } = useMyTimelineQuery();

  const [startFree, { isLoading: startingFree }] = useStartFreeMutation();
  const [startTrial, { isLoading: startingTrial }] = useStartTrialMutation();
  const [switchFreePlan] = useSwitchFreePlanMutation();
  const [undoChange, { isLoading: undoingChange }] =
    useUndoScheduledChangeMutation();
  const [undoCancel, { isLoading: undoingCancel }] = useUndoCancelMutation();

  const navigate = useNavigate();
  // Monthly, not yearly. The plan card above this grid states the monthly
  // price, and landing on yearly made the two disagree at a glance — a Growth
  // trial reading "₹2,499/mo" over a card reading "₹24,990/yearly". Monthly is
  // also the honest opening number; the longer cycles sell themselves on the
  // months-free badges.
  const [cycle, setCycle] = useState<string>("monthly");

  /** Checkout is a focused page now, not a drawer over the dashboard. */
  const goToCheckout = (planId: string, cycleCode: string) =>
    navigate(`/checkout?plan=${planId}&cycle=${cycleCode}`);
  const [changePlan, setChangePlan] = useState<PricingPlan | null>(null);
  const [addonsOpen, setAddonsOpen] = useState(false);
  // Deep-linkable: /my-subscription?tab=billing lands on billing history, which
  // is where the payment-receipt email and the limit banners point.
  const [tab, setTab] = useState(
    () => new URLSearchParams(window.location.search).get("tab") ?? "plans",
  );
  const [cancelOpen, setCancelOpen] = useState(false);

  const sub = data?.subscription ?? null;
  const cycles = catalogue?.cycles ?? [];
  const plans = catalogue?.plans ?? [];
  const activeCycle: CycleOption | null =
    cycles.find((c) => c.code === cycle) ?? cycles[0] ?? null;

  /** On the 7-day trial: no card taken, so add-ons and renewals don't apply. */
  const isTrial = sub?.status === "trial";
  /** On a ₹0 plan — add-ons are meaningless and switching is free. */
  const isOnFreePlan = Number(sub?.lockedMonthlyPrice ?? 0) === 0;

  const atRiskUsage = useMemo(
    () =>
      (data?.usage ?? []).filter(
        (u) => !u.isUnlimited && u.effective != null && u.used >= u.effective,
      ),
    [data?.usage],
  );

  /** The trial offer, valid only while there's no live subscription. */
  const trialOffer = data?.trialOffer ?? catalogue?.trialOffer ?? null;

  async function handleStartTrial(plan: PricingPlan) {
    try {
      await startTrial({ planId: plan.id }).unwrap();
      // No day count rather than a guessed one — the window is configured per
      // plan, so a hardcoded fallback here would eventually quote the wrong
      // number back to someone who just started a trial of a different length.
      toast.success(
        trialOffer
          ? `Your ${trialOffer.days}-day ${plan.name} trial has started.`
          : `Your ${plan.name} trial has started.`,
      );
      refetch();
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't start your trial.",
      );
    }
  }

  async function handleStartFree(plan: PricingPlan) {
    try {
      await startFree().unwrap();
      toast.success(`You're on ${plan.name} — your storefront is live.`);
      refetch();
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't set up your plan.",
      );
    }
  }

  /** Moving between ₹0 plans is free and instant; paid plans go via checkout. */
  async function handleFreeSwitch(plan: PricingPlan) {
    try {
      await switchFreePlan({ planId: plan.id }).unwrap();
      toast.success(`Switched to ${plan.name}.`);
      refetch();
    } catch (err) {
      toast.error(
        (err as { data?: { message?: string } })?.data?.message ??
          "Couldn't switch plan.",
      );
    }
  }

  async function handleDownload(invoiceId: string, number: string) {
    try {
      await downloadInvoicePdf(invoiceId, `${number}.pdf`);
    } catch {
      toast.error("Couldn't download that invoice. Try again in a moment.");
    }
  }

  // ---------------------------------------------------------------- loading --
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------- no subscription --
  if (!sub) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Choose your plan"
          description={
            trialOffer
              ? `Try ${trialOffer.planName} free for ${trialOffer.days} days — no card. Or start on a plan straight away.`
              : data?.freePlanAvailable
                ? "Start free — no card, no time limit. Your storefront is live from day one, and you upgrade only when you outgrow it."
                : "Pick a plan to get your storefront back online."
          }
        />

        {trialOffer && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <Gift className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="min-w-0 flex-1 text-sm">
                <strong className="font-semibold">
                  Try {trialOffer.planName} free for {trialOffer.days} days.
                </strong>{" "}
                No card, and it's the only plan we offer a trial on. When the{" "}
                {trialOffer.days} days are up you pick a plan to carry on —
                nothing is charged automatically.
              </p>
            </CardContent>
          </Card>
        )}

        {data?.freePlanAvailable && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <Sparkles className="size-5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-sm">
                <strong className="font-semibold">
                  Free forever, no card.
                </strong>{" "}
                Real orders, real customers, your own branded storefront.
                Nothing expires — move up whenever you need more room.
              </p>
            </CardContent>
          </Card>
        )}

        {activeCycle && (
          <PlanPicker
            plans={plans}
            cycles={cycles}
            cycle={activeCycle.code}
            onCycleChange={setCycle}
            showEnterprise
            trialOffer={trialOffer}
            ctaLabel={(p) =>
              p.id === trialOffer?.planId
                ? `Start ${trialOffer.days}-day free trial`
                : Number(p.priceMonthly) === 0
                  ? "Start free"
                  : "Choose plan"
            }
            onSelect={(plan) =>
              plan.id === trialOffer?.planId
                ? handleStartTrial(plan)
                : Number(plan.priceMonthly) === 0
                  ? handleStartFree(plan)
                  : goToCheckout(plan.id, activeCycle.code)
            }
          />
        )}

        {(startingFree || startingTrial) && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Setting up your storefront…
          </p>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------- subscribed --
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Your plan, usage and billing history."
      />

      {/* One banner, highest priority. See StatusBanner for why. */}
      <StatusBanner
        subscription={sub}
        scheduledChange={data?.scheduledChange}
        nextAmount={data?.nextRenewal?.quote.totalAmount}
        archiveDays={data?.settings.archiveDays}
        usage={data?.usage}
        onPay={() => goToCheckout(sub.planId, sub.billingCycle)}
        // Out of room isn't a payment problem — send them to the plan list
        // rather than to a checkout for the plan they already have.
        onUpgrade={() => setTab("plans")}
        onUndoCancel={async () => {
          try {
            await undoCancel().unwrap();
            toast.success("Cancellation undone — welcome back.");
          } catch {
            toast.error("Couldn't undo that.");
          }
        }}
        onUndoChange={async () => {
          try {
            await undoChange().unwrap();
            toast.success("Scheduled change undone.");
          } catch {
            toast.error("Couldn't undo that.");
          }
        }}
        undoingCancel={undoingCancel}
        undoingChange={undoingChange}
      />

      {/* ---- summary row --------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{sub.planName}</CardTitle>
                  <Badge className={SUBSCRIPTION_STATUS_TONE[sub.status]}>
                    {SUBSCRIPTION_STATUS_LABEL[sub.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.planTagline ?? SUBSCRIPTION_STATUS_HELP[sub.status]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">
                  {inrShort(sub.lockedMonthlyPrice)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Billed {sub.cycleName.toLowerCase()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {isTrial ? "Trial ends" : "Renews on"}
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(isTrial ? sub.trialEndsAt : sub.currentPeriodEnd)}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {sub.daysRemaining} days away
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Next amount</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {data?.nextRenewal
                    ? inr(data.nextRenewal.quote.totalAmount)
                    : "—"}
                </dd>
                {data?.coupon && data.coupon.cyclesLeft > 0 && (
                  <dd className="text-xs text-emerald-600 dark:text-emerald-400">
                    {data.coupon.code} · {data.coupon.cyclesLeft} cycle
                    {data.coupon.cyclesLeft > 1 ? "s" : ""} left
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Payment</dt>
                <dd className="mt-0.5 font-medium">
                  {sub.autopayEnabled && sub.hasMandate
                    ? "Autopay on"
                    : "Manual"}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {sub.autopayEnabled && sub.hasMandate
                    ? "Charged automatically"
                    : "You'll pay from here each cycle"}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              {/* Buying the plan you're already trialing is the single most
                  likely thing to want from this screen, and it used to be
                  reachable only through a banner that another banner could
                  outrank. It gets its own button. */}
              {isTrial && (
                <Button
                  size="sm"
                  onClick={() => goToCheckout(sub.planId, sub.billingCycle)}
                >
                  <Zap className="size-4" />
                  Activate {sub.planName}
                </Button>
              )}
              <Button
                size="sm"
                variant={isTrial ? "outline" : "default"}
                onClick={() => setTab("plans")}
                disabled={plans.length < 2}
              >
                <TrendingUp className="size-4" />
                {isTrial ? "See other plans" : "Change plan"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddonsOpen(true)}
              >
                <PackagePlus className="size-4" />
                Add capacity
              </Button>
              {!sub.cancelAtPeriodEnd && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.usage ?? []).map((row) => (
              <UsageMeter key={row.featureKey} row={row} />
            ))}
            {atRiskUsage.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => setAddonsOpen(true)}
              >
                <PackagePlus className="size-4" />
                Add more capacity
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Things this account holds that its plan doesn't list. Shown rather
            than left invisible so the plan comparison below never reads as a
            contradiction — and so support and the customer are looking at the
            same account. */}
        {(entitlements?.grantedExtras ?? []).length > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="size-4 text-emerald-600" />
                Added for your account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {entitlements!.grantedExtras.map((extra) => (
                <p key={extra.featureKey} className="text-sm">
                  <span className="font-medium">{extra.label}</span>
                  {extra.dataType === "count" && (
                    <span className="text-muted-foreground">
                      {extra.isUnlimited
                        ? " — unlimited"
                        : ` — ${extra.bonusValue} extra`}
                    </span>
                  )}
                  {extra.expiresAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      · until {formatDate(extra.expiresAt)}
                    </span>
                  )}
                </p>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Included on top of {sub.planName}, and unaffected by changing
                your plan.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---- tabs ---------------------------------------------------------- */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="billing">Billing history</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          {activeCycle && (
            <PlanPicker
              plans={plans}
              cycles={cycles}
              cycle={activeCycle.code}
              onCycleChange={setCycle}
              currentPlanId={
                sub.billingCycle === activeCycle.code ? sub.planId : null
              }
              // A trial is a plan you're using, not one you've bought — the
              // card has to stay buyable or the tier being trialed is the one
              // tier you can't pay for.
              currentIsTrial={isTrial}
              showEnterprise
              ctaLabel={(p, isCurrent) =>
                Number(p.priceMonthly) === 0
                  ? "Switch to Free"
                  : // On a trial nothing is being switched *from* — no money
                    // has been taken yet, so every paid plan is simply a
                    // choice, not an upgrade or a downgrade.
                    isTrial
                    ? isCurrent
                      ? "Activate this plan"
                      : "Choose this plan"
                    : Number(p.priceMonthly) > Number(sub.lockedMonthlyPrice)
                      ? "Upgrade"
                      : "Switch plan"
              }
              onSelect={(p) =>
                // Free ↔ free is instant and costless; anything paid goes
                // through the change flow so proration still applies.
                Number(p.priceMonthly) === 0 && isOnFreePlan
                  ? handleFreeSwitch(p)
                  : setChangePlan(p)
              }
            />
          )}

          <div className="mt-6">
            <PlanComparison
              plans={plans}
              cycle={activeCycle}
              currentPlanId={sub.planId}
              currentIsTrial={isTrial}
              onChoose={(p) =>
                Number(p.priceMonthly) === 0 && isOnFreePlan
                  ? handleFreeSwitch(p)
                  : setChangePlan(p)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="addons" className="mt-4">
          <Card>
            <CardContent className="py-5">
              {(data?.addons ?? []).length === 0 ? (
                <EmptyState
                  title="No add-ons yet"
                  description="Add-ons raise a limit without changing your plan — useful when you need one more branch but not a bigger tier."
                >
                  <Button
                    onClick={() => setAddonsOpen(true)}
                    disabled={isTrial}
                  >
                    <PackagePlus className="size-4" />
                    Browse add-ons
                  </Button>
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {data!.addons!.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {a.label} +{a.unitsAdded}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.quantity} step{a.quantity > 1 ? "s" : ""} ·{" "}
                          {inr(a.pricePerStep)}/step/month · added{" "}
                          {formatDate(a.addedAt)}
                        </p>
                      </div>
                      {a.removeAtPeriodEnd ? (
                        <Badge variant="outline" className="shrink-0">
                          Ends {formatDate(sub.currentPeriodEnd)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setAddonsOpen(true)}
                  >
                    <PackagePlus className="size-4" />
                    Manage add-ons
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          {data?.nextRenewal && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="size-4" />
                  Upcoming renewal — {formatDate(data.nextRenewal.date)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuoteSummary
                  quote={data.nextRenewal.quote}
                  title="What you'll be charged"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {(payments ?? []).length === 0 ? (
                <div className="px-6">
                  <EmptyState
                    title="No payments yet"
                    description="Your invoices will appear here once your first payment goes through."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments!.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(p.paidAt ?? p.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {PAYMENT_TYPE_LABEL[p.type]}
                            {p.attemptNumber > 1 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                retry {p.attemptNumber}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <span className="whitespace-nowrap">
                              {p.periodStart && p.periodEnd
                                ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
                                : "—"}
                            </span>
                            {p.capacity?.length > 0 && (
                              <p className="mt-0.5 max-w-56 text-xs">
                                {p.capacity
                                  .map(
                                    (c) =>
                                      `+${c.units} ${c.label.toLowerCase()}`,
                                  )
                                  .join(" · ")}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {inr(p.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={PAYMENT_STATUS_TONE[p.status]}>
                              {PAYMENT_STATUS_LABEL[p.status]}
                            </Badge>
                            {p.failureReason && (
                              <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
                                {p.failureReason}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.invoice ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleDownload(
                                    p.invoice!.id,
                                    p.invoice!.invoiceNumber,
                                  )
                                }
                              >
                                <Download className="size-3.5" />
                                {p.invoice.invoiceNumber}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="py-5">
              {(timeline ?? []).length === 0 ? (
                <EmptyState
                  title="Nothing yet"
                  description="Your subscription history will show up here."
                />
              ) : (
                <ol className="space-y-4">
                  {timeline!.map((e) => (
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
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- sheets ------------------------------------------------------- */}
      <ChangePlanSheet
        open={changePlan != null}
        onOpenChange={(o) => !o && setChangePlan(null)}
        plan={changePlan}
        cycle={activeCycle}
        currentPlanName={sub.planName}
        onDone={() => refetch()}
      />
      <AddonsSheet
        open={addonsOpen}
        onOpenChange={setAddonsOpen}
        addons={data?.addons ?? []}
        renewalDate={sub.currentPeriodEnd}
        // The notice this drives says "not during the trial" — which is what
        // the server enforces (`purchaseAddon` refuses TRIAL). It was being fed
        // the ₹0-plan flag instead, so trial accounts never saw it and Free
        // accounts saw a trial they weren't on.
        isTrial={isTrial}
        onDone={() => refetch()}
      />
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        periodEnd={sub.currentPeriodEnd}
        archiveDays={data?.settings.archiveDays}
        onDone={() => refetch()}
      />
    </div>
  );
}

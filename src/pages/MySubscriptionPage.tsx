import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Crown,
  Mail,
  MessageCircle,
  Minus,
  Receipt,
  Rocket,
  Sparkles,
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
import { usePublicPlansQuery } from "@/features/api/plansApi";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { Entitlements, Plan, PlanFeatureKey } from "@/types";
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

/** Visual identity per plan tier, matched by name with a sensible fallback. */
function planTier(name: string | null | undefined): {
  Icon: typeof Sparkles;
  chip: string;
  glow: string;
} {
  const n = (name ?? "").toLowerCase();
  if (n.includes("pro")) {
    return {
      Icon: Crown,
      chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
      glow: "from-amber-400/25 via-primary/10",
    };
  }
  if (n.includes("growth")) {
    return {
      Icon: Rocket,
      chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
      glow: "from-violet-400/25 via-primary/10",
    };
  }
  return {
    Icon: Sparkles,
    chip: "bg-primary/10 text-primary",
    glow: "from-primary/20 via-accent/10",
  };
}

/** Decorative layered-cake illustration for the plan hero. */
function CakeIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 150"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* candle + flame */}
      <path
        d="M80 22v16"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M80 6c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* top tier */}
      <rect x="48" y="40" width="64" height="28" rx="8" fill="currentColor" opacity="0.85" />
      <path
        d="M48 52c8 8 14-6 22 0s14-6 20 0 14-6 22 0"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* middle tier */}
      <rect x="32" y="70" width="96" height="32" rx="9" fill="currentColor" opacity="0.65" />
      <circle cx="52" cy="86" r="4" fill="white" fillOpacity="0.5" />
      <circle cx="80" cy="90" r="4" fill="white" fillOpacity="0.5" />
      <circle cx="108" cy="85" r="4" fill="white" fillOpacity="0.5" />
      {/* bottom tier */}
      <rect x="16" y="104" width="128" height="34" rx="10" fill="currentColor" opacity="0.45" />
      <path
        d="M16 116c10 10 18-8 28 0s18-8 26 0 18-8 28 0 18-8 26 0"
        stroke="white"
        strokeOpacity="0.4"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* plate */}
      <path
        d="M8 142h144"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ComparePlanCard({
  plan,
  isCurrent,
  isTopTier,
  currentPrice,
  support,
}: {
  plan: Plan;
  isCurrent: boolean;
  isTopTier: boolean;
  currentPrice: number | null;
  support?: Entitlements["support"];
}) {
  const price = Number(plan.priceMonthly);
  const direction =
    isCurrent || currentPrice == null || price === currentPrice
      ? null
      : price > currentPrice
        ? "upgrade"
        : "downgrade";
  const { Icon, chip, glow } = planTier(plan.name);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-background p-6 transition-all duration-300",
        isCurrent
          ? "border-primary/60 shadow-md ring-1 ring-primary/40"
          : "shadow-sm hover:-translate-y-1 hover:shadow-xl",
        isTopTier && !isCurrent && "border-amber-300/70 dark:border-amber-700/50",
      )}
    >
      {/* soft tier glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br to-transparent blur-2xl",
          glow,
        )}
      />

      {isTopTier && !isCurrent && (
        <span className="absolute right-0 top-0 rounded-bl-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Best value
        </span>
      )}

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              chip,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-base font-semibold">{plan.name}</h4>
            {isCurrent ? (
              <span className="text-xs font-medium text-primary">
                Your current plan
              </span>
            ) : direction === "upgrade" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="h-3 w-3" />
                Upgrade
              </span>
            ) : direction === "downgrade" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ArrowDown className="h-3 w-3" />
                Downgrade
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {plan.description && (
        <p className="relative mt-3 text-sm text-muted-foreground">
          {plan.description}
        </p>
      )}

      <div className="relative mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">
          {money(plan.priceMonthly)}
        </span>
        <span className="text-sm text-muted-foreground">/ month</span>
      </div>

      <ul className="relative mt-5 flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2.5">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          {plan.maxShops == null
            ? "Unlimited branches"
            : `Up to ${plan.maxShops} branch${plan.maxShops === 1 ? "" : "es"}`}
        </li>
        <li className="flex items-center gap-2.5">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          {plan.maxProductsPerShop == null
            ? "Unlimited products per branch"
            : `${plan.maxProductsPerShop} products per branch`}
        </li>
        {FEATURE_LABELS.map((f) => {
          const on = Boolean(plan.features?.[f.key]);
          return (
            <li
              key={f.key}
              className={cn(
                "flex items-center gap-2.5",
                !on && "text-muted-foreground/60",
              )}
            >
              {on ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Minus className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              {f.label}
            </li>
          );
        })}
      </ul>

      <div className="relative mt-auto pt-6">
        {isCurrent ? (
          <div className="flex h-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/5 text-sm font-medium text-primary">
            <Check className="mr-2 h-4 w-4" />
            Active
          </div>
        ) : direction === "upgrade" && (support?.email || support?.whatsapp) ? (
          <a
            href={
              support?.whatsapp
                ? `https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Hi! I'd like to upgrade my Frostique subscription to the ${plan.name} plan.`)}`
                : `mailto:${support?.email}?subject=${encodeURIComponent(`Upgrade to ${plan.name} plan`)}`
            }
            target={support?.whatsapp ? "_blank" : undefined}
            rel="noreferrer"
            className="flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary/80 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-105"
          >
            <Rocket className="mr-2 h-4 w-4" />
            Upgrade to {plan.name}
          </a>
        ) : (
          <div className="flex h-10 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Contact admin to switch
          </div>
        )}
      </div>
    </div>
  );
}

export function MySubscriptionPage() {
  const { entitlements } = useEntitlements();
  const { data: sub, isLoading, isError } = useMySubscriptionQuery();
  const { data: payments, isLoading: paymentsLoading } =
    useSubscriptionPaymentsQuery(sub?.id ?? "", { skip: !sub });
  const { data: publicPlans, isLoading: plansLoading } = usePublicPlansQuery();

  const renewal = useMemo(
    () => (sub ? getRenewalInfo(sub.status, sub.nextBillingDate) : null),
    [sub],
  );
  const totalPaid = useMemo(
    () => (payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
    [payments],
  );
  const comparePlans = useMemo(
    () =>
      [...(publicPlans ?? [])].sort(
        (a, b) => Number(a.priceMonthly) - Number(b.priceMonthly),
      ),
    [publicPlans],
  );
  // Monthly price of the current plan, for upgrade/downgrade badges. Falls
  // back to the subscribed price if the current plan is no longer public.
  const currentPlanPrice = useMemo(() => {
    if (!sub) return null;
    const current = comparePlans.find((p) => p.id === sub.planId);
    if (current) return Number(current.priceMonthly);
    return sub.billingCycle === "monthly"
      ? Number(sub.priceAtSubscription)
      : null;
  }, [comparePlans, sub]);

  const planName = entitlements?.planName ?? "—";
  const features = entitlements?.features ?? {};
  const support = entitlements?.support;
  const tier = planTier(planName);

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
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Plan hero card */}
            <Card className="relative overflow-hidden lg:col-span-2">
              {/* ambient gradient wash + illustration */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent",
                  tier.glow,
                )}
              />
              <div className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <CakeIllustration className="pointer-events-none absolute -bottom-4 right-4 hidden h-40 w-auto text-primary/25 sm:block" />

              <CardHeader className="relative pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm",
                        tier.chip,
                      )}
                    >
                      <tier.Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <CardTitle className="text-xl tracking-tight">
                        {planName}
                      </CardTitle>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {BILLING_CYCLE_LABEL[sub.billingCycle]} billing
                      </p>
                    </div>
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
              <CardContent className="relative space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-4xl font-bold tracking-tight">
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
                    Your plan renews soon. The platform admin will collect the
                    next payment.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Started
                    </span>
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
                  <h3 className="mb-2 text-sm font-semibold">
                    What's included
                  </h3>
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
                            {formatDate(p.periodStart)} →{" "}
                            {formatDate(p.periodEnd)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Plan comparison */}
          <div className="mt-10">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Plans
              </span>
              <h2 className="mt-3 text-xl font-bold tracking-tight">
                Grow your bakery with the right plan
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                Unlock more branches, products, and premium tools as you grow.
                Contact the platform admin anytime to switch.
              </p>
            </div>
            <div className="mt-6 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plansLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 rounded-2xl" />
                ))
              ) : comparePlans.length > 0 ? (
                comparePlans.map((plan, i) => (
                  <ComparePlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrent={plan.id === sub.planId}
                    isTopTier={i === comparePlans.length - 1 && comparePlans.length > 1}
                    currentPrice={currentPlanPrice}
                    support={support}
                  />
                ))
              ) : (
                <p className="col-span-full rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No other plans are available right now.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

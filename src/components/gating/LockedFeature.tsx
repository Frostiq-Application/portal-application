import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Crown, Rocket, Sparkles } from "@/components/ui/icons";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useAuth } from "@/hooks/useAuth";
import { useMyPlansQuery } from "@/features/api/billingApi";
import { featureLabel, inrShort } from "@/lib/billing";
import type { PlanFeatureKey } from "@/types";
import type { PricingPlan } from "@/types/billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Returns the rendered icon rather than the component type. Binding a component
 * to a variable and rendering `<Icon />` makes the element type change with the
 * plan name, which remounts the subtree; an element keeps the type static.
 */
function tierIcon(name: string, className: string) {
  const n = name.toLowerCase();
  if (n.includes("pro") || n.includes("enterprise"))
    return <Crown className={className} />;
  if (n.includes("growth")) return <Rocket className={className} />;
  return <Sparkles className={className} />;
}

/**
 * Shown in place of a feature the current plan doesn't include — reached by
 * clicking a locked sidebar item, or by hitting a gated URL directly.
 *
 * This used to say "contact your administrator to upgrade", which was true when
 * only a platform admin could record a payment. Self-serve billing makes that
 * advice wrong: the owner can unlock this themselves in a couple of minutes. So
 * the screen now does the selling — it names the cheapest plan that actually
 * includes the feature, shows what else comes with it, and links to checkout.
 */
export function LockedFeature({
  title = "Not in your plan",
  featureLabel: label,
  feature,
}: {
  title?: string;
  featureLabel?: string;
  /** The gate that failed — used to find the cheapest plan that unlocks it. */
  feature?: PlanFeatureKey;
}) {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();
  const { role } = useAuth();
  const isOwner = role === "account_super_admin";
  const { data: catalogue, isLoading } = useMyPlansQuery(undefined, {
    skip: !isOwner,
  });

  // The cheapest plan that actually turns this feature on. Recommending one
  // that doesn't include it would be worse than recommending nothing.
  const unlocking: PricingPlan[] = (catalogue?.plans ?? [])
    .filter((p) => (feature ? p.flags[feature] === true : true))
    .filter((p) => p.id !== entitlements?.planId)
    .sort((a, b) => Number(a.priceMonthly) - Number(b.priceMonthly));

  const recommended = unlocking[0] ?? null;
  const displayLabel =
    label ?? (feature ? featureLabel(feature) : "This feature");

  return (
    <div>
      <PageHeader title={title} description={displayLabel} />

      <div className="mx-auto max-w-xl space-y-4">
        <Card className="overflow-hidden p-0">
          <div className="flex items-start gap-4 border-b bg-muted/40 p-6">
            {/* Crown, matching the sidebar marker that leads here — and it
                frames the feature as something to reach for rather than
                something withheld. */}
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
              <Crown className="size-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">
                {displayLabel} isn't included in{" "}
                {entitlements?.planName ?? "your plan"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOwner
                  ? "It unlocks the moment you upgrade — your catalogue, orders and customers all stay exactly as they are."
                  : "Ask your account owner to upgrade the plan; it unlocks immediately for everyone on the team."}
              </p>
            </div>
          </div>

          {isOwner && (
            <CardContent className="p-6">
              {isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : recommended ? (
                <RecommendedPlan
                  plan={recommended}
                  currentFlags={(entitlements?.features ?? {}) as Record<string, boolean | undefined>}
                  onUpgrade={() => navigate("/my-subscription?tab=plans")}
                />
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    No plan currently includes this feature. Get in touch and
                    we'll sort something out.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/my-subscription")}
                  >
                    View my subscription
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {isOwner && unlocking.length > 1 && (
          <p className="text-center text-sm text-muted-foreground">
            {unlocking.length - 1} other plan
            {unlocking.length - 1 === 1 ? " also includes" : "s also include"} it
            —{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => navigate("/my-subscription?tab=plans")}
            >
              compare them all
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}

/** The upsell card: cheapest unlocking plan, its price, and what it adds. */
function RecommendedPlan({
  plan,
  currentFlags,
  onUpgrade,
}: {
  plan: PricingPlan;
  currentFlags: Record<string, boolean | undefined>;
  onUpgrade: () => void;
}) {
  // Only show what's genuinely *new* — repeating features they already have
  // makes the upgrade look smaller than it is.
  const newFlags = Object.entries(plan.flags)
    .filter(([key, on]) => on && currentFlags[key] !== true)
    .map(([key]) => key);

  const yearly = plan.cyclePrices.find((c) => c.code === "yearly");

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            {tierIcon(plan.name, "size-4")}
          </span>
          <div>
            {/* A div, not a p: Badge renders a div, and a div inside a p is
                invalid HTML that React warns about at runtime. */}
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              {plan.name}
              <Badge variant="secondary">Recommended</Badge>
            </div>
            {plan.tagline && (
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums">
            {inrShort(plan.priceMonthly)}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
          {yearly && (
            <p className="text-xs text-muted-foreground">
              {inrShort(yearly.perMonth)}/mo billed yearly
            </p>
          )}
        </div>
      </div>

      {newFlags.length > 0 && (
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {newFlags.slice(0, 6).map((key) => (
            <li
              key={key}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {featureLabel(key)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.limits
          .filter((l) => l.isUnlimited || l.value > 0)
          .map((l) => (
            <span
              key={l.featureKey}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {l.isUnlimited ? "Unlimited" : l.value} {l.label.toLowerCase()}
            </span>
          ))}
      </div>

      <Button className="mt-5 w-full" onClick={onUpgrade}>
        Upgrade to {plan.name}
        <ArrowRight className="size-4" />
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        You'll only pay the prorated difference for the days left in your current
        period.
      </p>
    </div>
  );
}

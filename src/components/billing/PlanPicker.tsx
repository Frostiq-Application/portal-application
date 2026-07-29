import { useState } from "react";
import { ArrowRight, Check, Crown, Gift, Minus, Rocket, Sparkles } from "@/components/ui/icons";
import { EnterpriseEnquiryDialog } from "@/components/billing/EnterpriseEnquiryDialog";
import { cn } from "@/lib/utils";
import { featureLabel, inrShort } from "@/lib/billing";
import type { CycleOption, PricingPlan, TrialOffer } from "@/types/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Visual identity per tier, matched by name with a neutral fallback. */
function tierLook(name: string) {
  const n = name.toLowerCase();
  if (n.includes("pro") || n.includes("enterprise"))
    return {
      Icon: Crown,
      chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
      ring: "ring-amber-400/50",
    };
  if (n.includes("growth"))
    return {
      Icon: Rocket,
      chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
      ring: "ring-violet-400/50",
    };
  return {
    Icon: Sparkles,
    chip: "bg-primary/10 text-primary",
    ring: "ring-primary/40",
  };
}

/**
 * The Monthly / Semiannual / Yearly toggle (SH-01).
 *
 * Cycles come from the API, not a hardcoded list — a new promo cycle is one row
 * in `billing_cycles` and appears here with no code change (SA-10).
 */
export function CycleToggle({
  cycles,
  value,
  onChange,
}: {
  cycles: CycleOption[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
      {cycles.map((c) => {
        const active = c.code === value;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => onChange(c.code)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
            {c.savingsLabel && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {c.savingsLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface PlanPickerProps {
  plans: PricingPlan[];
  cycles: CycleOption[];
  cycle: string;
  onCycleChange: (code: string) => void;
  /** The plan the account is on now — rendered as "Current plan". */
  currentPlanId?: string | null;
  selectedPlanId?: string | null;
  onSelect: (plan: PricingPlan) => void;
  ctaLabel?: (plan: PricingPlan, isCurrent: boolean) => string;
  /**
   * The free-trial offer, when this account can still take it. Exactly one
   * card gets the trial line — the grid decides nothing itself, so the offer
   * can move tier without touching this component.
   */
  trialOffer?: TrialOffer | null;
  /** Show the static Enterprise "Contact us" card (SH-01). */
  showEnterprise?: boolean;
  compact?: boolean;
  /**
   * How many boolean features to list per card. Defaults to a readable few —
   * pass `Infinity` where the card *is* the pitch and nothing should be
   * hidden behind a comparison table, as during signup.
   */
  maxFeatures?: number;
}

/**
 * The pricing grid (SH-01). Every cycle price is derived from the plan's single
 * monthly price — nothing here computes a discount percentage, because the
 * structural saving is always expressed as months free.
 */
export function PlanPicker({
  plans,
  cycles,
  cycle,
  onCycleChange,
  currentPlanId,
  selectedPlanId,
  onSelect,
  ctaLabel,
  trialOffer,
  showEnterprise = false,
  compact = false,
  maxFeatures,
}: PlanPickerProps) {
  const featureCap = maxFeatures ?? (compact ? 3 : 6);
  const activeCycle = cycles.find((c) => c.code === cycle);

  // Columns follow the number of plans rather than a fixed three. Hardcoding
  // three meant a fourth plan wrapped onto its own row and looked like an
  // afterthought — which is exactly the wrong impression for the tier you most
  // want people to consider.
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const allFlagKeys = [
    ...new Set(plans.flatMap((p) => Object.keys(p.flags))),
  ].sort((a, b) => featureLabel(a).localeCompare(featureLabel(b)));
  const count = plans.length;
  const columns =
    count >= 5
      ? "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
      : count === 4
        // 4-up only once there's genuinely room. Inside a 1400px shell with a
        // 340px sidebar the content column is ~980px — four cards there are
        // ~230px each, which is too narrow for a price and a feature list. A
        // 2×2 grid below that reads far better than four cramped columns.
        ? "sm:grid-cols-2 2xl:grid-cols-4"
        : count === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2";
  // Four across is tight — drop the price a size so it still fits on a laptop.
  const dense = count >= 4;
  // The Enterprise brief ticks against what we actually ship, not a hardcoded
  // list — so a feature added to the catalogue shows up there for free.
  const enterpriseFeatures = allFlagKeys.map((key) => ({
    key,
    label: featureLabel(key),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CycleToggle cycles={cycles} value={cycle} onChange={onCycleChange} />
        {activeCycle && activeCycle.freeMonths > 0 && (
          <p className="text-sm text-muted-foreground">
            Pay for {activeCycle.payableMonths} months, get {activeCycle.months}.
          </p>
        )}
      </div>

      <div className={cn("grid items-stretch gap-4", columns)}>
        {/* The union of every feature any plan offers, so each card can show
            what it lacks as well as what it has — a column of nothing but
            ticks makes every tier look identical. */}
        {plans.map((plan) => {
          const price = plan.cyclePrices.find((p) => p.code === cycle);
          const isCurrent = plan.id === currentPlanId;
          const isSelected = plan.id === selectedPlanId;
          // Two tiers carry a badge now and they say different things. Only the
          // popular one takes the inverted card — two dark cards side by side
          // read as two recommendations. The other is marked in violet, which
          // is loud enough to notice and quiet enough not to compete.
          const isPopular = /popular/i.test(plan.badge ?? "");
          const featured = isPopular && !isCurrent;
          const premium = Boolean(plan.badge) && !isPopular && !isCurrent;
          const { Icon, chip, ring } = tierLook(plan.name);
          const flags = Object.entries(plan.flags).filter(([, on]) => on);
          // The offer is per account, not per plan: `plan.trialDays` says a
          // trial exists, `trialOffer` says this account can still have it.
          const trialDays =
            trialOffer?.planId === plan.id ? trialOffer.days : 0;
          const missing = allFlagKeys.filter((k) => plan.flags[k] !== true);

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border transition-all",
                dense ? "p-4" : "p-5",
                featured
                  ? "border-transparent bg-foreground text-background shadow-lg"
                  : "bg-card",
                premium &&
                  "border-violet-400/60 bg-violet-50/60 shadow-md dark:border-violet-500/40 dark:bg-violet-950/20",
                isSelected && `ring-2 ${ring} border-transparent`,
                !isSelected && !featured && "hover:border-foreground/20",
              )}
            >
              {plan.badge && (
                <Badge
                  className={cn(
                    "absolute -top-2.5 right-4 shadow-sm",
                    featured && "bg-background text-foreground",
                    premium &&
                      "bg-violet-600 text-white hover:bg-violet-600 dark:bg-violet-500",
                  )}
                >
                  {plan.badge}
                </Badge>
              )}

              <div className="flex items-center gap-2.5">
                <span className={cn("rounded-lg p-2", chip)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.tagline && (
                    <p
                      className={cn(
                        "text-xs leading-snug",
                        featured
                          ? "text-background/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {plan.tagline}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span
                    className={cn(
                      "font-bold tracking-tight",
                      dense ? "text-2xl" : "text-3xl",
                    )}
                  >
                    {inrShort(price?.price ?? plan.priceMonthly)}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      featured ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    /
                    {activeCycle?.months === 1
                      ? "mo"
                      : activeCycle?.name.toLowerCase()}
                  </span>
                </div>
                {activeCycle && activeCycle.months > 1 && price && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      featured ? "text-background/60" : "text-muted-foreground",
                    )}
                  >
                    {inrShort(price.perMonth)}/month effective
                  </p>
                )}
                {/* Sits with the price, because that's the number it changes:
                    nothing is charged until the trial ends. */}
                {trialDays > 0 && (
                  <p
                    className={cn(
                      "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      featured
                        ? "bg-background/15 text-background"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    <Gift className="size-3.5" />
                    Free for {trialDays} days, no card
                  </p>
                )}
              </div>

              <ul
                className={cn(
                  "mt-4 flex-1 space-y-1.5",
                  dense ? "text-[13px]" : "text-sm",
                )}
              >
                {plan.limits.map((l) => (
                  <li key={l.featureKey} className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        featured
                          ? "text-emerald-400"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    />
                    <span
                      className={cn(
                        featured ? "text-background/80" : "text-muted-foreground",
                      )}
                    >
                      <strong
                        className={cn(
                          "font-medium",
                          featured ? "text-background" : "text-foreground",
                        )}
                      >
                        {l.isUnlimited ? "Unlimited" : l.value}
                      </strong>{" "}
                      {l.label.toLowerCase()}
                    </span>
                  </li>
                ))}
                {flags.slice(0, featureCap).map(([key]) => (
                  <li key={key} className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        featured
                          ? "text-emerald-400"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    />
                    <span
                      className={cn(
                        featured ? "text-background/80" : "text-muted-foreground",
                      )}
                    >
                      {featureLabel(key)}
                    </span>
                  </li>
                ))}
                {flags.length > featureCap && (
                  <li
                    className={cn(
                      "pl-5.5 text-xs",
                      featured ? "text-background/60" : "text-muted-foreground",
                    )}
                  >
                    +{flags.length - featureCap} more
                  </li>
                )}
                {/* What this tier doesn't include, greyed rather than hidden —
                    it's the clearest possible argument for the next tier up. */}
                {maxFeatures === Infinity &&
                  missing.map((key) => (
                    <li
                      key={key}
                      className={cn(
                        "flex items-center gap-2",
                        featured ? "text-background/35" : "text-muted-foreground/45",
                      )}
                    >
                      <Minus className="size-3.5 shrink-0" />
                      <span className="line-through">{featureLabel(key)}</span>
                    </li>
                  ))}
              </ul>

              <Button
                className={cn(
                  "mt-5 w-full",
                  featured &&
                    "bg-background text-foreground hover:bg-background/90",
                )}
                variant={isCurrent ? "outline" : isSelected ? "default" : "secondary"}
                disabled={isCurrent}
                onClick={() => onSelect(plan)}
              >
                {isCurrent
                  ? "Current plan"
                  : (ctaLabel?.(plan, isCurrent) ?? "Choose plan")}
              </Button>
            </div>
          );
        })}

      </div>

      {/* Enterprise gets its own full-width row rather than a fifth column.
          It isn't a tier you compare feature-by-feature — it's a conversation,
          and squeezing it into the grid invited exactly that comparison. */}
      {showEnterprise && (
        <>
          <button
            type="button"
            onClick={() => setEnterpriseOpen(true)}
            className="group flex w-full flex-col items-start gap-4 rounded-2xl border border-dashed bg-muted/30 p-6 text-left transition-all hover:border-solid hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Crown className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Enterprise</span>
                <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Custom pricing
                </span>
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Many branches, high volume, or something we don't build yet.
                Tell us what you need and we'll price it around your operation
                — including features we'd build for you.
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-sm font-medium transition-colors group-hover:bg-foreground group-hover:text-background">
              Talk to us
              <ArrowRight className="size-4" />
            </span>
          </button>

          <EnterpriseEnquiryDialog
            open={enterpriseOpen}
            onOpenChange={setEnterpriseOpen}
            features={enterpriseFeatures}
          />
        </>
      )}
    </div>
  );
}

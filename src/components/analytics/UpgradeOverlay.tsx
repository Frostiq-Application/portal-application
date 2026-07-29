import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Crown } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useMyPlansQuery } from "@/features/api/billingApi";
import { featureLabel } from "@/components/billing/PlanPicker";
import { inrShort } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanFeatureKey } from "@/types";

/**
 * The cheapest plan that actually turns `feature` on. Only the account owner
 * can load the catalogue (and only they can act on it), so everyone else gets
 * null and a "ask your owner" message instead of a price.
 */
function useUnlockingPlan(feature: PlanFeatureKey) {
  const { role } = useAuth();
  const { entitlements } = useEntitlements();
  const isOwner = role === "account_super_admin";
  // Every locked section on the page asks for this; RTK Query dedupes it to a
  // single request.
  const { data } = useMyPlansQuery(undefined, { skip: !isOwner });

  const plan =
    (data?.plans ?? [])
      .filter((p) => p.flags[feature] === true && p.id !== entitlements?.planId)
      .sort((a, b) => Number(a.priceMonthly) - Number(b.priceMonthly))[0] ??
    null;

  return { isOwner, plan };
}

/**
 * Covers a section whose feature isn't in the plan.
 *
 * The charts underneath are still rendered — from sample data (`previewData`),
 * never the API, which would 403 — and blurred. Showing the shape of a report
 * sells the upgrade far better than an empty "not available" card does, and it
 * keeps the page's layout identical on every plan.
 *
 * The blurred layer is `aria-hidden` + `pointer-events-none`: to a screen
 * reader, and to a mouse, the section is just the upgrade message.
 */
export function UpgradeOverlay({
  feature,
  title,
  description,
  className,
  children,
}: {
  /** The gate that failed — names the feature and finds the unlocking plan. */
  feature: PlanFeatureKey;
  /** Defaults to the plan-catalogue label for `feature`. */
  title?: string;
  description: string;
  className?: string;
  /** The real charts, fed with sample data. */
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { isOwner, plan } = useUnlockingPlan(feature);
  const label = title ?? featureLabel(feature);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl", className)}>
      <div
        aria-hidden
        className="pointer-events-none select-none blur-[5px] saturate-[0.6] [&_*]:!cursor-default"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-background/60 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card/95 p-6 text-center shadow-lg">
          {/* Crown, not a padlock — it matches the sidebar marker that leads
              here, and frames the feature as something to reach for. */}
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-amber-500/10">
            <Crown className="size-5 text-amber-500" />
          </div>

          <h3 className="font-semibold">{label} isn’t in your plan</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>

          {isOwner ? (
            plan ? (
              <>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/my-subscription?tab=plans")}
                >
                  Upgrade to {plan.name}
                  <ArrowRight className="size-4" />
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  From {inrShort(plan.priceMonthly)}/month · unlocks
                  immediately, with your data intact.
                </p>
              </>
            ) : (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/my-subscription?tab=plans")}
              >
                See plans
                <ArrowRight className="size-4" />
              </Button>
            )
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Ask your account owner to upgrade — it unlocks for the whole team
              at once.
            </p>
          )}

          <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground/70">
            Sample data shown
          </p>
        </div>
      </div>
    </div>
  );
}

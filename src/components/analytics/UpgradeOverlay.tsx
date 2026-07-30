import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Crown } from "@/components/ui/icons";
import { useUnlockingPlan } from "@/hooks/useUnlockingPlan";
import { featureLabel } from "@/lib/billing";
import { inrShort } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanFeatureKey } from "@/types";

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
      {/* Capped and faded out at the bottom: a locked report is a teaser, not a
          second copy of the page. Left at full height, three locked sections
          made the page scroll for thousands of pixels of blur. */}
      <div
        aria-hidden
        className="pointer-events-none max-h-[26rem] select-none overflow-hidden blur-[5px] saturate-[0.6] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] [&_*]:!cursor-default"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-background/40 p-4">
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

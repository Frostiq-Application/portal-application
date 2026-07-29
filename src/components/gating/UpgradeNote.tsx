import { useNavigate } from "react-router-dom";
import { ArrowRight, Crown } from "@/components/ui/icons";
import { useUnlockingPlan } from "@/hooks/useUnlockingPlan";
import { featureLabel } from "@/lib/billing";
import { cn } from "@/lib/utils";
import type { PlanFeatureKey } from "@/types";

/**
 * The compact sibling of `UpgradeOverlay`, for places too small to preview
 * anything — a drawer panel, a sidebar block, a single card.
 *
 * Same promise as the overlay: name the feature, name the cheapest plan that
 * unlocks it, and give the owner a way to buy it. It deliberately does **not**
 * say "contact your administrator", which stopped being true when billing went
 * self-serve — the owner can do this themselves in a couple of minutes.
 */
export function UpgradeNote({
  feature,
  title,
  description,
  className,
}: {
  feature: PlanFeatureKey;
  /** Defaults to the plan-catalogue label for `feature`. */
  title?: string;
  description: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const { isOwner, plan } = useUnlockingPlan(feature);
  const label = title ?? featureLabel(feature);

  return (
    <div className={cn("rounded-lg border border-dashed p-3", className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
          <Crown className="size-3.5 text-amber-500" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium">{label} isn’t in your plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

          {isOwner ? (
            <button
              type="button"
              onClick={() => navigate("/my-subscription?tab=plans")}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {plan ? `Upgrade to ${plan.name}` : "See plans"}
              <ArrowRight className="size-3" />
            </button>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Ask your account owner to upgrade.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

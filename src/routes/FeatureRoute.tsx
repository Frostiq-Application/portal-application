import { Outlet } from "react-router-dom";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/gating/LockedFeature";
import type { PlanFeatureKey } from "@/types";

/**
 * Route guard for plan-gated feature modules. If the current plan doesn't
 * unlock `feature`, the LockedFeature screen is shown instead of the page —
 * blocking direct-URL access as well as nav clicks.
 */
export function FeatureRoute({
  feature,
  featureLabel,
}: {
  feature: PlanFeatureKey;
  featureLabel?: string;
}) {
  const { isLoading, hasFeature } = useEntitlements();

  if (isLoading) return null;
  if (!hasFeature(feature)) {
    // Pass the failing gate through so the card can name the cheapest plan
    // that actually unlocks it, rather than a generic "upgrade" message.
    return <LockedFeature feature={feature} featureLabel={featureLabel} />;
  }
  return <Outlet />;
}

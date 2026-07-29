import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useMyPlansQuery } from "@/features/api/billingApi";
import type { PricingPlan } from "@/types/billing";
import type { PlanFeatureKey } from "@/types";

/**
 * The cheapest plan that actually turns `feature` on — the one an upsell should
 * name. Recommending a plan that doesn't include the feature would be worse
 * than recommending nothing.
 *
 * Only the account owner can load the catalogue (and only they can act on it),
 * so everyone else gets `plan: null` and should be pointed at their owner
 * rather than at a price.
 */
export function useUnlockingPlan(feature: PlanFeatureKey): {
  isOwner: boolean;
  plan: PricingPlan | null;
} {
  const { role } = useAuth();
  const { entitlements } = useEntitlements();
  const isOwner = role === "account_super_admin";
  // Several locked blocks can ask for this on one screen; RTK Query dedupes
  // them into a single request.
  const { data } = useMyPlansQuery(undefined, { skip: !isOwner });

  const plan =
    (data?.plans ?? [])
      .filter((p) => p.flags[feature] === true && p.id !== entitlements?.planId)
      .sort((a, b) => Number(a.priceMonthly) - Number(b.priceMonthly))[0] ?? null;

  return { isOwner, plan };
}

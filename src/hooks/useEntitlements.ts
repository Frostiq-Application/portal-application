import { skipToken } from "@reduxjs/toolkit/query";
import { useMyEntitlementsQuery } from "@/features/api/entitlementsApi";
import { useAuth } from "@/hooks/useAuth";
import type { Entitlements, PlanFeatureKey } from "@/types";

/** Roles whose access is gated by the brand's subscription plan. */
const GATED_ROLES = ["account_super_admin", "shop_admin"] as const;

export interface EntitlementsState {
  /** True while the entitlements query is in flight (gated roles only). */
  isLoading: boolean;
  /** True for platform super admin — never gated by a plan. */
  isExempt: boolean;
  /** Whether the brand has a usable subscription. Exempt roles are always true. */
  hasActiveSubscription: boolean;
  entitlements?: Entitlements;
  /** Check a single plan feature flag. Exempt roles always pass. */
  hasFeature: (key: PlanFeatureKey) => boolean;
}

export function useEntitlements(): EntitlementsState {
  const { role } = useAuth();
  const isExempt = !role || !GATED_ROLES.includes(role as never);

  const { data, isLoading, isFetching } = useMyEntitlementsQuery(
    isExempt ? skipToken : undefined,
  );

  const hasFeature = (key: PlanFeatureKey): boolean => {
    if (isExempt) return true;
    if (!data?.hasActiveSubscription) return false;
    return Boolean(data.features?.[key]);
  };

  return {
    isLoading: !isExempt && (isLoading || isFetching),
    isExempt,
    hasActiveSubscription: isExempt
      ? true
      : Boolean(data?.hasActiveSubscription),
    entitlements: data,
    hasFeature,
  };
}

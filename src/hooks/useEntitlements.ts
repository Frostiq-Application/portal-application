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
  /**
   * True when the account itself is deactivated (not "active": suspended,
   * rejected, or pending). Such accounts must contact the super admin — a plan
   * can't fix it. Exempt roles are never deactivated.
   */
  isAccountDeactivated: boolean;
  /**
   * True when the brand's latest subscription has expired. The brand can't
   * self-serve a renewal (only the platform admin records payments), so this is
   * a hard block — treated like a deactivated account, not a "pick a plan"
   * prompt. Exempt roles are never expired.
   */
  isSubscriptionExpired: boolean;
  entitlements?: Entitlements;
  /**
   * The brand identity to render in the app shell. For gated roles (account &
   * shop admins) this is their own account's name + logo, so the portal shows
   * the brand instead of the platform. Null for the exempt platform admin (who
   * sees the default platform branding) or before entitlements have loaded.
   */
  brand: {
    name: string;
    logoUrl: string | null;
    themeColor: string | null;
  } | null;
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
    isAccountDeactivated:
      !isExempt && data != null && data.accountStatus !== "active",
    isSubscriptionExpired:
      !isExempt && data != null && data.subscriptionStatus === "expired",
    entitlements: data,
    brand:
      !isExempt && data?.accountName
        ? {
            name: data.accountName,
            logoUrl: data.logoUrl,
            themeColor: data.themeColor,
          }
        : null,
    hasFeature,
  };
}

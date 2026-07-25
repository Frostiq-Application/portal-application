import { skipToken } from "@reduxjs/toolkit/query";
import { useMyEntitlementsQuery } from "@/features/api/entitlementsApi";
import { useAuth } from "@/hooks/useAuth";
import type { Entitlements, PlanFeatureKey } from "@/types";

/** Roles whose access is gated by the brand's subscription plan. */
const GATED_ROLES = ["account_super_admin", "shop_admin", "staff"] as const;

export interface EntitlementsState {
  /** True while the entitlements query is in flight (gated roles only). */
  isLoading: boolean;
  /** True for platform super admin — never gated by a plan. */
  isExempt: boolean;
  /** Whether the brand has a usable subscription. Exempt roles are always true. */
  hasActiveSubscription: boolean;
  /**
   * True only when a platform admin has suspended or rejected the account —
   * something the owner cannot fix themselves, so the gate points at support.
   *
   * Explicitly **not** true for `pending`, which just means signup isn't
   * finished; that routes to onboarding.
   */
  isAccountDeactivated: boolean;
  /**
   * True when the subscription is `locked` or `cancelled` — the storefront is
   * offline and feature modules are unavailable.
   *
   * Unlike the old `expired` state, this is **not** a dead end: the owner can
   * log in and pay, and paying restores service instantly. So the UI points
   * them at billing rather than at "contact your admin".
   */
  isSubscriptionExpired: boolean;
  /**
   * Payment is overdue but the storefront is still live (`grace`). Worth a
   * banner; never a block.
   */
  isInGracePeriod: boolean;
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
    // Only a *deactivation* counts — `suspended` and `rejected` are things a
    // platform admin did to an established account.
    //
    // `pending` deliberately does NOT: an account that hasn't finished signing
    // up isn't deactivated, it's mid-signup. Treating the two the same meant
    // choosing a paid plan bounced the owner to "your account is deactivated"
    // on the way to checkout, which is both wrong and alarming. OnboardingGate
    // routes pending accounts to the wizard instead.
    isAccountDeactivated:
      !isExempt &&
      data != null &&
      (data.accountStatus === "suspended" || data.accountStatus === "rejected"),
    isSubscriptionExpired:
      !isExempt &&
      data != null &&
      (data.subscriptionStatus === "locked" ||
        data.subscriptionStatus === "cancelled"),
    isInGracePeriod:
      !isExempt && data != null && data.subscriptionStatus === "grace",
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

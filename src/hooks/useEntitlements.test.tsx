import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AccountStatus, SubscriptionStatus } from "@/types";

/**
 * Account-status gating.
 *
 * The rule these protect, learned the hard way: **`pending` is not
 * `deactivated`.** Conflating them meant an owner who picked a paid plan during
 * signup was shown "your account is deactivated" on the way to checkout —
 * alarming, wrong, and a dead end in the middle of the payment funnel.
 *
 * `suspended` and `rejected` are deliberate admin actions against an
 * established account and *should* hit that gate. `pending` just means signup
 * isn't finished, and belongs in the onboarding wizard.
 */

const mockState = vi.hoisted(() => ({
  role: "account_super_admin" as string,
  data: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: mockState.role }),
}));
vi.mock("@/features/api/entitlementsApi", () => ({
  useMyEntitlementsQuery: () => ({
    data: mockState.data,
    isLoading: false,
    isFetching: false,
  }),
}));

const { useEntitlements } = await import("./useEntitlements");

function withAccount(
  accountStatus: AccountStatus,
  subscriptionStatus: SubscriptionStatus | null = "active",
) {
  mockState.role = "account_super_admin";
  mockState.data = {
    accountStatus,
    subscriptionStatus,
    hasActiveSubscription: subscriptionStatus === "active",
    hasSubscription: subscriptionStatus != null,
    features: {},
    accountName: "Test Bakery",
    logoUrl: null,
    themeColor: null,
    planId: null,
    planName: null,
    maxShops: null,
    shopsUsed: 0,
    maxProductsPerShop: null,
    maxTeamSeats: null,
    teamSeatsUsed: 0,
    support: { email: null, whatsapp: null },
  };
  return renderHook(() => useEntitlements()).result.current;
}

describe("isAccountDeactivated", () => {
  it("is false while an account is still signing up", () => {
    // The regression: a pending account is mid-onboarding, not deactivated.
    expect(withAccount("pending").isAccountDeactivated).toBe(false);
  });

  it("is false for a healthy active account", () => {
    expect(withAccount("active").isAccountDeactivated).toBe(false);
  });

  it("is true when a platform admin suspended the account", () => {
    expect(withAccount("suspended").isAccountDeactivated).toBe(true);
  });

  it("is true when the account was rejected", () => {
    expect(withAccount("rejected").isAccountDeactivated).toBe(true);
  });

  it("gates every brand role, floor roles included", () => {
    // Chefs and riders were left off the gated list when their roles shipped,
    // which quietly handed them features their brand hadn't paid for — a
    // kitchen with the realtime stream on a plan that doesn't include it.
    for (const role of [
      "account_super_admin",
      "shop_admin",
      "staff",
      "chef",
      "delivery_manager",
    ]) {
      mockState.role = role;
      mockState.data = undefined;
      const r = renderHook(() => useEntitlements()).result.current;
      expect(r.isExempt, `${role} should be plan-gated`).toBe(false);
      expect(r.hasFeature("can_use_realtime"), role).toBe(false);
    }
  });

  it("never deactivates the platform super admin", () => {
    mockState.role = "platform_super_admin";
    mockState.data = undefined;
    const r = renderHook(() => useEntitlements()).result.current;
    expect(r.isExempt).toBe(true);
    expect(r.isAccountDeactivated).toBe(false);
    expect(r.hasActiveSubscription).toBe(true);
  });
});

describe("subscription state", () => {
  it("treats locked and cancelled as a hard stop", () => {
    expect(withAccount("active", "locked").isSubscriptionExpired).toBe(true);
    expect(withAccount("active", "cancelled").isSubscriptionExpired).toBe(true);
  });

  it("does not hard-stop during grace — the storefront is still live", () => {
    const r = withAccount("active", "grace");
    expect(r.isSubscriptionExpired).toBe(false);
    expect(r.isInGracePeriod).toBe(true);
  });

  it("does not treat a paid, active subscription as in grace", () => {
    expect(withAccount("active", "active").isInGracePeriod).toBe(false);
  });
});

describe("hasFeature", () => {
  it("denies everything without a usable subscription", () => {
    mockState.role = "account_super_admin";
    mockState.data = {
      accountStatus: "active",
      subscriptionStatus: "locked",
      hasActiveSubscription: false,
      features: { can_use_cms: true },
      support: { email: null, whatsapp: null },
    };
    const r = renderHook(() => useEntitlements()).result.current;
    // The flag is present but the subscription isn't usable — access must
    // still be refused, or a locked account keeps its paid features.
    expect(r.hasFeature("can_use_cms")).toBe(false);
  });

  it("grants a flag the plan includes on a live subscription", () => {
    mockState.data = {
      accountStatus: "active",
      subscriptionStatus: "active",
      hasActiveSubscription: true,
      features: { can_use_cms: true },
      support: { email: null, whatsapp: null },
    };
    const r = renderHook(() => useEntitlements()).result.current;
    expect(r.hasFeature("can_use_cms")).toBe(true);
    expect(r.hasFeature("can_use_coupons")).toBe(false);
  });

  it("lets the platform admin through every gate", () => {
    mockState.role = "platform_super_admin";
    mockState.data = undefined;
    const r = renderHook(() => useEntitlements()).result.current;
    expect(r.hasFeature("can_use_cms")).toBe(true);
  });
});

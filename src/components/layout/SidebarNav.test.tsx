import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NAV_ITEMS, navForRole } from "@/config/nav";

/**
 * The sidebar's plan-gating contract (SH-23).
 *
 * The rule these tests protect: a plan-gated item is **shown locked, never
 * hidden**. Hiding it means the bakery never discovers the feature exists — and
 * a menu that silently grows after an upgrade is disorienting. The lock is the
 * upsell.
 */

const mockState = vi.hoisted(() => ({
  role: "account_super_admin" as string,
  granted: new Set<string>(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: mockState.role, isAuthenticated: true }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    hasFeature: (key: string) => mockState.granted.has(key),
    isExempt: mockState.role === "platform_super_admin",
    entitlements: undefined,
  }),
}));
vi.mock("@/app/hooks", () => ({
  useAppSelector: () => false,
  useAppDispatch: () => vi.fn(),
}));

// Import after the mocks so the component picks them up.
const { SidebarNav } = await import("./AppLayout");

const renderNav = () =>
  render(
    <MemoryRouter>
      <SidebarNav />
    </MemoryRouter>,
  );

describe("SidebarNav plan gating", () => {
  it("shows a gated item locked rather than hiding it", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set(); // nothing granted

    renderNav();

    // Coupons is gated on can_use_coupons and must still be visible.
    const coupons = screen.getByRole("link", { name: /coupons/i });
    expect(coupons).toBeInTheDocument();
    expect(coupons).toHaveAttribute("data-locked", "true");
    // The lock is announced, not just drawn.
    expect(coupons).toHaveAccessibleName(/not in your plan/i);
  });

  it("still routes a locked item to its page, where the upgrade card lives", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set();

    renderNav();

    // Clicking must navigate — FeatureRoute renders the upgrade card there.
    // A dead, unclickable item would leave nowhere to sell the upgrade.
    expect(screen.getByRole("link", { name: /coupons/i })).toHaveAttribute(
      "href",
      "/coupons",
    );
  });

  it("unlocks the item once the plan grants the feature", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set(["can_use_coupons"]);

    renderNav();

    const coupons = screen.getByRole("link", { name: /coupons/i });
    expect(coupons).not.toHaveAttribute("data-locked");
    expect(coupons).not.toHaveAccessibleName(/not in your plan/i);
  });

  it("locks every gated item when the plan grants nothing", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set();

    const { container } = renderNav();

    const gated = navForRole("account_super_admin").filter((i) => i.feature);
    expect(gated.length).toBeGreaterThan(0);

    const locked = container.querySelectorAll('[data-locked="true"]');
    expect(locked.length).toBe(gated.length);
  });

  it("never locks an ungated item", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set();

    renderNav();

    // Branches has no `feature` gate — it's limited by count, not unlocked.
    const branches = screen.getByRole("link", { name: /branches/i });
    expect(branches).not.toHaveAttribute("data-locked");
  });

  it("leaves the platform super admin ungated entirely", () => {
    mockState.role = "platform_super_admin";
    mockState.granted = new Set();

    const { container } = renderNav();

    // Plan gates are per-brand; the platform admin isn't plan-bound.
    expect(container.querySelectorAll('[data-locked="true"]').length).toBe(0);
  });
});

describe("nav config", () => {
  it("keeps every gated item pointed at a real feature key", () => {
    // A typo'd feature key would silently lock an item forever.
    const gated = NAV_ITEMS.filter((i) => i.feature);
    for (const item of gated) {
      expect(item.feature).toMatch(/^(can_|priority_)/);
    }
  });

  it("filters by role before anything else", () => {
    const staffPaths = navForRole("staff").map((i) => i.path);
    expect(staffPaths).toContain("/orders");
    // Billing is the owner's decision — staff never see it.
    expect(staffPaths).not.toContain("/my-subscription");
    expect(staffPaths).not.toContain("/billing-settings");
  });

  it("keeps platform billing screens off a brand owner's nav", () => {
    const ownerPaths = navForRole("account_super_admin").map((i) => i.path);
    expect(ownerPaths).toContain("/my-subscription");
    expect(ownerPaths).not.toContain("/subscription-coupons");
    expect(ownerPaths).not.toContain("/billing-settings");
    expect(ownerPaths).not.toContain("/subscriptions");
  });
});

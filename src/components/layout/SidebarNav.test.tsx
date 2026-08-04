import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NAV_ITEMS, navForRole } from "@/config/nav";
import { SidebarProvider } from "@/components/ui/sidebar";

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

// The nav reads sidebar state (to close the mobile drawer on navigation and to
// dim labels in the icon rail), so it needs the provider the same way it needs
// a router.
const renderNav = () =>
  render(
    <MemoryRouter>
      <SidebarProvider>
        <SidebarNav />
      </SidebarProvider>
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

  it("locks every gated top-level item when the plan grants nothing", () => {
    mockState.role = "account_super_admin";
    mockState.granted = new Set();

    const { container } = renderNav();

    // Sub-items are excluded on purpose — see the next test.
    const gated = navForRole("account_super_admin").filter(
      (i) => i.feature && !i.parent,
    );
    expect(gated.length).toBeGreaterThan(0);

    const locked = container.querySelectorAll('[data-locked="true"]');
    expect(locked.length).toBe(gated.length);
  });

  it("hides a sub-item entirely when its parent feature is locked", () => {
    // A sub-item is a part of its parent, not a feature of its own. Selling one
    // add-on through two crowned rows is noise, and the child's page is
    // unreachable anyway while the parent feature is off.
    const child = navForRole("account_super_admin").find((i) => i.parent);
    expect(child).toBeDefined();

    mockState.role = "account_super_admin";
    mockState.granted = new Set();
    const { unmount } = renderNav();
    expect(
      screen.queryByRole("link", { name: new RegExp(child!.label, "i") }),
    ).toBeNull();
    unmount();

    // ...and appears once the plan carries the parent feature.
    mockState.granted = new Set([child!.feature!]);
    renderNav();
    expect(
      screen.getByRole("link", { name: new RegExp(child!.label, "i") }),
    ).toHaveAttribute("href", child!.path);
  });

  it("sells the floor boards rather than hiding them", () => {
    // Kitchen and Delivery are a plan module (Growth Plus & Pro). A brand on a
    // lower tier still runs orders from the queue, so the boards have to read
    // as something to buy — the same rule as every other gated module.
    mockState.role = "account_super_admin";
    mockState.granted = new Set();
    const { unmount } = renderNav();

    for (const label of [/kitchen/i, /delivery/i]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "data-locked",
        "true",
      );
    }
    unmount();

    mockState.granted = new Set(["can_use_floor_boards"]);
    renderNav();
    for (const label of [/kitchen/i, /delivery/i]) {
      expect(
        screen.getByRole("link", { name: label }),
      ).not.toHaveAttribute("data-locked");
    }
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

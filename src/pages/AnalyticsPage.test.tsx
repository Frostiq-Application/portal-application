import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The Analytics page's plan contract.
 *
 * The rule these tests protect: **every report is on the page on every plan**.
 * One the plan doesn't include still renders its charts — from sample data,
 * behind an upgrade overlay — because an owner who never sees a report never
 * buys it. The two things that must never happen are a locked report going
 * missing, and a locked report calling its endpoint (which 403s).
 */

const mockState = vi.hoisted(() => ({
  role: "account_super_admin" as string,
  granted: new Set<string>(),
  branchId: "shop-1",
  calls: { shop: 0, wishlist: 0, account: 0 },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: mockState.role, isAuthenticated: true }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    hasFeature: (key: string) => mockState.granted.has(key),
    isExempt: false,
    entitlements: { planId: "plan-starter", planName: "Starter" },
  }),
}));
vi.mock("@/app/hooks", () => ({
  useAppSelector: () => mockState.branchId,
  useAppDispatch: () => vi.fn(),
}));
vi.mock("@/components/ShopSelect", () => ({
  ShopSelect: () => <div data-testid="shop-select" />,
}));
vi.mock("@/features/api/analyticsApi", () => ({
  useShopAnalyticsQuery: () => {
    mockState.calls.shop += 1;
    return { data: undefined, isLoading: true, isFetching: false };
  },
  useWishlistAnalyticsQuery: () => {
    mockState.calls.wishlist += 1;
    return { data: undefined, isLoading: true, isFetching: false };
  },
  useAccountAnalyticsQuery: () => {
    mockState.calls.account += 1;
    return { data: undefined, isLoading: true, isFetching: false };
  },
}));
vi.mock("@/features/api/billingApi", () => ({
  useMyPlansQuery: () => ({
    data: {
      plans: [
        {
          id: "plan-growth",
          name: "Growth",
          priceMonthly: "1499",
          flags: { can_use_analytics: true, can_use_wishlist_analytics: true },
        },
        {
          id: "plan-pro",
          name: "Pro",
          priceMonthly: "2999",
          flags: {
            can_use_analytics: true,
            can_use_wishlist_analytics: true,
            can_use_advanced_analytics: true,
          },
        },
      ],
    },
    isLoading: false,
  }),
}));

const { AnalyticsPage } = await import("./AnalyticsPage");

const renderPage = () =>
  render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockState.role = "account_super_admin";
  mockState.granted = new Set();
  mockState.branchId = "shop-1";
  mockState.calls = { shop: 0, wishlist: 0, account: 0 };
});

describe("AnalyticsPage", () => {
  it("shows every report on a plan that includes none of them", () => {
    renderPage();

    expect(screen.getByText(/branch performance/i)).toBeInTheDocument();
    expect(screen.getByText(/wishlist insights/i)).toBeInTheDocument();
    expect(screen.getByText(/brand overview/i)).toBeInTheDocument();
    // …and each one is covered by its own upgrade overlay.
    expect(screen.getAllByText(/isn.t in your plan/i)).toHaveLength(3);
  });

  it("never calls a gated endpoint for a locked report", () => {
    renderPage();

    // These 403 without the feature; the preview is drawn from sample data.
    expect(mockState.calls).toEqual({ shop: 0, wishlist: 0, account: 0 });
  });

  it("names the cheapest plan that unlocks the report", () => {
    mockState.granted = new Set(["can_use_analytics"]);
    renderPage();

    // Wishlist is in both Growth and Pro — recommend the cheaper one.
    expect(
      screen.getByRole("button", { name: /upgrade to growth/i }),
    ).toBeInTheDocument();
    // Cross-branch is Pro-only.
    expect(
      screen.getByRole("button", { name: /upgrade to pro/i }),
    ).toBeInTheDocument();
  });

  it("fetches live data for the reports the plan includes", () => {
    mockState.granted = new Set([
      "can_use_analytics",
      "can_use_wishlist_analytics",
      "can_use_advanced_analytics",
    ]);
    renderPage();

    expect(mockState.calls.shop).toBeGreaterThan(0);
    expect(mockState.calls.wishlist).toBeGreaterThan(0);
    expect(mockState.calls.account).toBeGreaterThan(0);
    expect(screen.queryByText(/isn.t in your plan/i)).not.toBeInTheDocument();
  });

  it("asks a branch admin to talk to the owner instead of showing a price", () => {
    mockState.role = "shop_admin";
    renderPage();

    expect(screen.getAllByText(/ask your account owner/i)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /upgrade to/i })).toBeNull();
    // Cross-branch reporting isn't a branch admin's screen at all.
    expect(screen.queryByText(/brand overview/i)).toBeNull();
  });

  it("asks for a branch before fetching an unlocked branch report", () => {
    mockState.granted = new Set(["can_use_analytics"]);
    mockState.branchId = "all";
    renderPage();

    expect(screen.getAllByText(/select a branch/i).length).toBeGreaterThan(0);
    expect(mockState.calls.shop).toBe(0);
  });
});

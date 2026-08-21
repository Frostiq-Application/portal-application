import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * The subscription page's escape hatch.
 *
 * Every lockout screen hands the owner a button that points at
 * `/my-subscription` — a route that lives *inside* the gate doing the locking.
 * So that page, and only that page, renders bare when the shell would otherwise
 * swallow it.
 *
 * The bug these tests protect against: that exemption was unconditional, so an
 * owner on a perfectly healthy plan also got the bare page. You could reach
 * Subscription from the sidebar and then find no sidebar to leave by.
 */

const mockState = vi.hoisted(() => ({
  role: "account_super_admin" as string,
  hasActiveSubscription: true,
  isSubscriptionExpired: false,
  isAccountDeactivated: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    role: mockState.role,
    isAuthenticated: true,
    user: { name: "Ada Shop" },
  }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    isLoading: false,
    isExempt: mockState.role === "platform_super_admin",
    hasActiveSubscription: mockState.hasActiveSubscription,
    isAccountDeactivated: mockState.isAccountDeactivated,
    isSubscriptionExpired: mockState.isSubscriptionExpired,
    isInGracePeriod: false,
    entitlements: undefined,
    brand: { name: "Cake Shop", logoUrl: null, themeColor: null },
    hasFeature: () => true,
  }),
}));
vi.mock("@/app/hooks", () => ({
  useAppSelector: () => false,
  useAppDispatch: () => vi.fn(),
}));
vi.mock("@/hooks/useSessionSync", () => ({ useSessionSync: () => undefined }));
// Both open SSE connections on mount — nothing this file is about.
vi.mock("@/components/orders/OrderNotifications", () => ({
  OrderNotifications: () => null,
}));
vi.mock("@/components/enquiries/EnquiryNotifications", () => ({
  EnquiryNotifications: () => null,
}));
// Queries the release log through RTK Query, which needs a store this file
// deliberately doesn't build.
vi.mock("@/components/versions/WhatsNewDialog", () => ({
  WhatsNewDialog: () => null,
}));
// The user menu shows the current version, which is an RTK Query call.
vi.mock("@/features/api/versionsApi", () => ({
  useLatestVersionQuery: () => ({ data: null }),
}));

const { AppLayout } = await import("./AppLayout");

/** The shell's own landmark — present only when the sidebar rendered. */
const sidebar = () => document.querySelector("[data-sidebar='sidebar']");

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={path} element={<div>page body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockState.role = "account_super_admin";
  mockState.hasActiveSubscription = true;
  mockState.isSubscriptionExpired = false;
  mockState.isAccountDeactivated = false;
});

describe("the app shell on /my-subscription", () => {
  it("keeps the sidebar for an owner whose plan is healthy", () => {
    renderAt("/my-subscription");
    expect(screen.getByText("page body")).toBeVisible();
    expect(sidebar()).not.toBeNull();
  });

  it("drops the shell only when the shell itself is the lockout", () => {
    // The gate that would otherwise render instead of this page is exactly the
    // one the page exists to clear, so here the bare render is the point.
    mockState.hasActiveSubscription = false;
    renderAt("/my-subscription");
    expect(screen.getByText("page body")).toBeVisible();
    expect(sidebar()).toBeNull();
  });

  it("drops the shell for a locked subscription too", () => {
    mockState.isSubscriptionExpired = true;
    renderAt("/my-subscription");
    expect(screen.getByText("page body")).toBeVisible();
    expect(sidebar()).toBeNull();
  });

  it("still lets a deactivated account fall through to its own gate", () => {
    // Suspended or rejected by us — no payment fixes it, so the subscription
    // page must not become a way around that screen.
    mockState.isAccountDeactivated = true;
    renderAt("/my-subscription");
    expect(screen.queryByText("page body")).toBeNull();
  });

  it("leaves every other page in the shell", () => {
    renderAt("/orders");
    expect(sidebar()).not.toBeNull();
  });
});

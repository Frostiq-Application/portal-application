import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Who gets the app shell, and who gets a blocking screen.
 *
 * The escape hatch below is a hole in the gate, not a rule about a route, and
 * that distinction is the whole test. Written as one it read "owners on
 * /my-subscription render bare", which is true of a locked-out account and
 * equally true of a perfectly healthy one — so every owner who opened their own
 * subscription page lost the sidebar, on an Active plan, with nothing wrong.
 *
 * The shell is the default. Only a real lockout takes it away.
 *
 * And a lockout has to be something the server actually said. When the
 * entitlements call fails we know nothing, so every flag below reads false and
 * the account looks brand new — which is how an API outage came to greet
 * paying owners with "choose a plan to get started".
 */

const mockState = vi.hoisted(() => ({
  role: "account_super_admin" as string,
  isExempt: false,
  isLoading: false,
  isError: false,
  hasActiveSubscription: true,
  isAccountDeactivated: false,
  isSubscriptionExpired: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    role: mockState.role,
    isAuthenticated: true,
    user: { name: "Asha Rao" },
  }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    ...mockState,
    hasFeature: () => true,
    error: undefined,
    refetch: () => {},
    entitlements: undefined,
    brand: undefined,
  }),
}));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => true }) }));
vi.mock("@/app/hooks", () => ({
  useAppSelector: () => false,
  useAppDispatch: () => vi.fn(),
}));

// The shell's live-data children each open a connection; none of them is what
// is under test here. `useSessionSync` is the same thing in hook form: it
// re-reads /auth/me through RTK Query, which wants the real store behind a
// Provider, and the gate decides nothing from it.
vi.mock("@/hooks/useSessionSync", () => ({ useSessionSync: () => {} }));
vi.mock("@/components/orders/OrderNotifications", () => ({
  OrderNotifications: () => null,
}));
vi.mock("@/components/enquiries/EnquiryNotifications", () => ({
  EnquiryNotifications: () => null,
}));

// Stand-ins for the two blocking screens, so a test asserts which one rendered
// rather than matching whatever copy they carry this week.
vi.mock("@/components/gating/NoSubscriptionGate", () => ({
  NoSubscriptionGate: () => <div data-testid="no-subscription-gate" />,
}));
vi.mock("@/components/gating/AccountDeactivatedGate", () => ({
  AccountDeactivatedGate: () => <div data-testid="deactivated-gate" />,
}));
vi.mock("@/components/gating/ServerErrorGate", () => ({
  ServerErrorGate: () => <div data-testid="server-error-gate" />,
}));

const { AppLayout } = await import("./AppLayout");

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={path} element={<div data-testid="page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

/** The sidebar is the shell — if it rendered, the account got the app. */
const hasShell = () =>
  document.querySelector('[data-sidebar="sidebar"]') !== null;

beforeEach(() => {
  mockState.role = "account_super_admin";
  mockState.isExempt = false;
  mockState.isLoading = false;
  mockState.isError = false;
  mockState.hasActiveSubscription = true;
  mockState.isAccountDeactivated = false;
  mockState.isSubscriptionExpired = false;
});

describe("AppLayout — an account in good standing", () => {
  it("keeps the shell on the subscription page", () => {
    renderAt("/my-subscription");
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(hasShell()).toBe(true);
  });

  it("keeps the shell everywhere else too", () => {
    renderAt("/orders");
    expect(hasShell()).toBe(true);
  });
});

describe("AppLayout — a locked-out account", () => {
  it("lets the owner through to the page that sells them a plan", () => {
    mockState.hasActiveSubscription = false;
    renderAt("/my-subscription");
    // Bare on purpose: the shell is the thing being locked, and this is the one
    // page that can undo the lock.
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByTestId("no-subscription-gate")).not.toBeInTheDocument();
    expect(hasShell()).toBe(false);
  });

  it("blocks the owner anywhere else", () => {
    mockState.hasActiveSubscription = false;
    renderAt("/orders");
    expect(screen.getByTestId("no-subscription-gate")).toBeInTheDocument();
  });

  it("blocks everyone who cannot buy, even on the subscription page", () => {
    mockState.hasActiveSubscription = false;
    mockState.role = "shop_admin";
    renderAt("/my-subscription");
    expect(screen.getByTestId("no-subscription-gate")).toBeInTheDocument();
  });

  it("treats an expired subscription the same as a missing one", () => {
    mockState.isSubscriptionExpired = true;
    renderAt("/orders");
    expect(screen.getByTestId("no-subscription-gate")).toBeInTheDocument();
  });
});

describe("AppLayout — an account we couldn't ask about", () => {
  it("reports the failure instead of inventing a lockout", () => {
    mockState.isError = true;
    // Exactly what a failed call leaves behind: every flag at its default.
    mockState.hasActiveSubscription = false;
    renderAt("/orders");

    expect(screen.getByTestId("server-error-gate")).toBeInTheDocument();
    expect(screen.queryByTestId("no-subscription-gate")).not.toBeInTheDocument();
  });

  it("does not send the owner to buy a plan they may already have", () => {
    mockState.isError = true;
    mockState.hasActiveSubscription = false;
    renderAt("/my-subscription");

    // The bare-checkout escape hatch is for a *known* lockout. Here the plan
    // page can't load either, so the honest screen wins.
    expect(screen.getByTestId("server-error-gate")).toBeInTheDocument();
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
  });

  it("leaves the platform admin alone — they are never gated", () => {
    mockState.isError = true;
    mockState.isExempt = true;
    mockState.role = "platform_super_admin";
    renderAt("/orders");

    expect(screen.queryByTestId("server-error-gate")).not.toBeInTheDocument();
    expect(hasShell()).toBe(true);
  });
});

describe("AppLayout — a deactivated account", () => {
  it("gets the screen no payment can clear, even as the owner", () => {
    mockState.isAccountDeactivated = true;
    mockState.hasActiveSubscription = false;
    renderAt("/my-subscription");
    expect(screen.getByTestId("deactivated-gate")).toBeInTheDocument();
  });
});

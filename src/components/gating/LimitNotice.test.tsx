import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderHook } from "@testing-library/react";
import { LimitCounter, LimitNotice } from "./LimitNotice";
import { useLimitState } from "@/hooks/useLimitState";

// The notice branches on role, so stub the auth hook rather than standing up a
// whole store for a presentational test.
const mockRole = vi.hoisted(() => ({ current: "account_super_admin" as string }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: mockRole.current }),
}));

const wrap = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("useLimitState", () => {
  it("treats a null limit as unlimited and never warns", () => {
    const { result } = renderHook(() => useLimitState(9999, null));
    expect(result.current).toMatchObject({
      limit: null,
      atLimit: false,
      nearLimit: false,
      remaining: null,
    });
  });

  it("is at the limit when usage equals it", () => {
    const { result } = renderHook(() => useLimitState(12, 12));
    expect(result.current.atLimit).toBe(true);
    expect(result.current.remaining).toBe(0);
  });

  it("is still at the limit when usage somehow exceeds it", () => {
    // Can happen after a downgrade lands before archiving finishes.
    const { result } = renderHook(() => useLimitState(15, 12));
    expect(result.current.atLimit).toBe(true);
    expect(result.current.remaining).toBe(0);
  });

  it("warns at 80% of a large limit", () => {
    const { result } = renderHook(() => useLimitState(40, 50));
    expect(result.current.nearLimit).toBe(true);
    expect(result.current.atLimit).toBe(false);
  });

  it("does not warn below 80% when more than one slot remains", () => {
    const { result } = renderHook(() => useLimitState(30, 50));
    expect(result.current.nearLimit).toBe(false);
  });

  it("warns on the last remaining slot even on a small limit", () => {
    // 1 of 2 is only 50%, but one branch left genuinely matters.
    const { result } = renderHook(() => useLimitState(1, 2));
    expect(result.current.nearLimit).toBe(true);
  });
});

describe("LimitNotice", () => {
  it("renders nothing when the limit is unlimited", () => {
    const state = { used: 500, limit: null, atLimit: false, nearLimit: false, remaining: null };
    const { container } = wrap(
      <LimitNotice state={state} label="products" unit="products" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when comfortably under the limit", () => {
    const state = { used: 2, limit: 50, atLimit: false, nearLimit: false, remaining: 48 };
    const { container } = wrap(
      <LimitNotice state={state} label="products" unit="products" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("raises an alert at the limit and offers both ways out", () => {
    const state = { used: 12, limit: 12, atLimit: true, nearLimit: false, remaining: 0 };
    wrap(<LimitNotice state={state} label="products in this branch" unit="products" />);

    // role=alert so screen readers announce it, not just sighted users.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-limit-state", "at");
    expect(alert).toHaveTextContent("You've used all 12 products on your plan");

    // Both routes out: a bigger plan, or capacity without changing tier.
    expect(screen.getByRole("button", { name: /upgrade plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add capacity/i })).toBeInTheDocument();
  });

  it("uses a softer status role when merely near the limit", () => {
    const state = { used: 1, limit: 2, atLimit: false, nearLimit: true, remaining: 1 };
    wrap(<LimitNotice state={state} label="branches" unit="branches" />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("data-limit-state", "near");
    // "branches" must singularise to "branch", not "branche".
    expect(notice).toHaveTextContent("1 branch left on your plan");
  });

  it("hides the add-on button when the feature isn't add-onable", () => {
    const state = { used: 5, limit: 5, atLimit: true, nearLimit: false, remaining: 0 };
    wrap(
      <LimitNotice
        state={state}
        label="branches"
        unit="branches"
        addonAvailable={false}
      />,
    );
    expect(screen.getByRole("button", { name: /upgrade plan/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add capacity/i })).toBeNull();
  });

  it("does not offer purchase buttons to a shop admin, who cannot buy", () => {
    mockRole.current = "shop_admin";
    const state = { used: 12, limit: 12, atLimit: true, nearLimit: false, remaining: 0 };
    wrap(<LimitNotice state={state} label="products" unit="products" />);

    expect(screen.queryByRole("button", { name: /upgrade plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add capacity/i })).toBeNull();
    expect(
      screen.getByText(/ask your account owner to upgrade/i),
    ).toBeInTheDocument();

    mockRole.current = "account_super_admin";
  });
});

describe("LimitCounter", () => {
  it("shows used over the effective limit", () => {
    const state = { used: 8, limit: 12, atLimit: false, nearLimit: false, remaining: 4 };
    wrap(<LimitCounter state={state} unit="products" />);
    expect(screen.getByText("8 / 12 products")).toBeInTheDocument();
  });

  it("renders nothing when unlimited", () => {
    const state = { used: 8, limit: null, atLimit: false, nearLimit: false, remaining: null };
    const { container } = wrap(<LimitCounter state={state} unit="products" />);
    expect(container).toBeEmptyDOMElement();
  });
});

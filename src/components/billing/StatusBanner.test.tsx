import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatusBanner } from "./StatusBanner";
import type { ScheduledChange, SubscriptionSummary } from "@/types/billing";
import type { SubscriptionStatus } from "@/types";

/**
 * Banner priority.
 *
 * The dashboard can have four things to say at once. Showing all four produced
 * a wall of amber where "your storefront is offline" sat below "your trial ends
 * in 20 days". These tests pin the ordering so that never regresses.
 */

const noop = vi.fn();

const sub = (over: Partial<SubscriptionSummary> = {}): SubscriptionSummary =>
  ({
    id: "s1",
    status: "active" as SubscriptionStatus,
    planId: "p1",
    planName: "Growth",
    planTagline: null,
    billingCycle: "yearly",
    cycleName: "Yearly",
    lockedMonthlyPrice: "2499.00",
    trialEndsAt: null,
    currentPeriodStart: "2026-01-01T00:00:00Z",
    currentPeriodEnd: "2026-12-31T00:00:00Z",
    graceUntil: null,
    lockedUntil: null,
    autopayEnabled: false,
    hasMandate: false,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    deleteReadyAt: null,
    dunningAttempt: 0,
    nextRetryAt: null,
    daysRemaining: 100,
    ...over,
  }) as SubscriptionSummary;

const change: ScheduledChange = {
  id: "c1",
  changeType: "plan_downgrade",
  targetPlanId: "p0",
  targetPlanName: "Starter",
  targetCycle: "monthly",
  targetCycleName: "Monthly",
  keepSelections: {},
  newAddons: [],
  effectiveAt: "2026-12-31T00:00:00Z",
};

const show = (s: SubscriptionSummary, scheduled?: ScheduledChange | null) =>
  render(
    <MemoryRouter>
      <StatusBanner
        subscription={s}
        scheduledChange={scheduled}
        nextAmount="24990.00"
        archiveDays={90}
        onPay={noop}
        onUndoCancel={noop}
        onUndoChange={noop}
      />
    </MemoryRouter>,
  );

describe("StatusBanner priority", () => {
  it("shows nothing when everything is healthy", () => {
    const { container } = show(sub());
    expect(container).toBeEmptyDOMElement();
  });

  it("puts an offline storefront above everything else", () => {
    // All four conditions at once — locked must win.
    show(
      sub({
        status: "locked",
        lockedUntil: "2026-02-01T00:00:00Z",
        cancelAtPeriodEnd: true,
        trialEndsAt: "2026-02-01T00:00:00Z",
      }),
      change,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your storefront is offline",
    );
    expect(screen.queryByText(/plan change scheduled/i)).toBeNull();
    expect(screen.queryByText(/subscription is cancelling/i)).toBeNull();
  });

  it("ranks an overdue payment above a scheduled change", () => {
    show(sub({ status: "grace", graceUntil: "2026-02-01T00:00:00Z" }), change);
    expect(screen.getByRole("status")).toHaveTextContent("Payment needed");
  });

  it("uses alert semantics only for the genuinely urgent case", () => {
    show(sub({ status: "locked" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // A scheduled change is informational — announcing it as an alert would
    // cry wolf on a screen reader.
    const { container } = render(
      <MemoryRouter>
        <StatusBanner
          subscription={sub()}
          scheduledChange={change}
          onPay={noop}
          onUndoCancel={noop}
          onUndoChange={noop}
        />
      </MemoryRouter>,
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it("says how many other updates were demoted rather than hiding them", () => {
    show(sub({ status: "grace", cancelAtPeriodEnd: true }), change);
    expect(screen.getByText(/\+2 other updates/i)).toBeInTheDocument();
  });

  it("omits the count when only one thing applies", () => {
    show(sub({ status: "grace" }));
    expect(screen.queryByText(/other update/i)).toBeNull();
  });

  it("escalates the trial banner's tone in the final days", () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const { container } = show(sub({ status: "trial", trialEndsAt: soon }));
    expect(container.firstElementChild).toHaveAttribute(
      "data-banner-tone",
      "warn",
    );

    const later = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const { container: c2 } = show(sub({ status: "trial", trialEndsAt: later }));
    expect(c2.firstElementChild).toHaveAttribute("data-banner-tone", "info");
  });

  it("lets a pending cancellation outrank a distant trial reminder", () => {
    const later = new Date(Date.now() + 20 * 86_400_000).toISOString();
    show(sub({ status: "trial", trialEndsAt: later, cancelAtPeriodEnd: true }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your subscription is cancelling",
    );
  });

  it("offers the payment amount on the action button", () => {
    show(sub({ status: "grace" }));
    expect(
      screen.getByRole("button", { name: /pay ₹24,990\.00/i }),
    ).toBeInTheDocument();
  });
});

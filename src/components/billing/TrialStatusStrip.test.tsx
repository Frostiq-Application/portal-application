import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SubscriptionDashboard, UsageRow } from "@/types/billing";

/**
 * The dashboard strip.
 *
 * The countdown and the capacity warning both existed already — on the billing
 * page, which a bakery opens roughly never. This puts one of them on the screen
 * people actually use, so what it must get right is *which* one: a lapsing
 * trial takes the capacity question with it, so the deadline always wins.
 *
 * It must also stay quiet. A strip that renders on a healthy account every day
 * is furniture, and furniture gets ignored — including on the day it matters.
 */

const mockState = vi.hoisted(() => ({
  data: undefined as SubscriptionDashboard | undefined,
}));

vi.mock("@/features/api/billingApi", () => ({
  useMySubscriptionQuery: () => ({ data: mockState.data }),
}));

import { TrialStatusStrip } from "./TrialStatusStrip";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const usage = (over: Partial<UsageRow> = {}): UsageRow => ({
  featureKey: "max_products_per_shop",
  label: "Products per branch",
  used: 10,
  planValue: 50,
  addonValue: 0,
  effective: 50,
  isUnlimited: false,
  trialCapped: false,
  ...over,
});

const dashboard = (
  over: Partial<SubscriptionDashboard> = {},
): SubscriptionDashboard =>
  ({
    subscription: {
      id: "s1",
      status: "active",
      planId: "p1",
      planName: "Growth",
      billingCycle: "monthly",
      trialEndsAt: null,
      ...(over.subscription ?? {}),
    },
    coupon: null,
    usage: over.usage,
  }) as SubscriptionDashboard;

beforeEach(() => {
  mockState.data = undefined;
});

const show = () =>
  render(
    <MemoryRouter>
      <TrialStatusStrip />
    </MemoryRouter>,
  );

describe("staying out of the way", () => {
  it("renders nothing before the subscription has loaded", () => {
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an account with no subscription", () => {
    mockState.data = { subscription: null } as SubscriptionDashboard;
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on a healthy paid account with room to spare", () => {
    mockState.data = dashboard({ usage: [usage({ used: 10, effective: 50 })] });
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the trial countdown", () => {
  it("counts the days left", () => {
    mockState.data = dashboard({
      subscription: { status: "trial", trialEndsAt: inDays(9) } as never,
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("9 days left in your trial");
  });

  it('says "1 day", not "1 days"', () => {
    mockState.data = dashboard({
      subscription: { status: "trial", trialEndsAt: inDays(1) } as never,
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("1 day left");
  });

  it("says so on the last day rather than counting to zero", () => {
    mockState.data = dashboard({
      subscription: { status: "trial", trialEndsAt: new Date().toISOString() } as never,
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Your trial ends today");
  });

  it("never counts below zero once the deadline has passed", () => {
    mockState.data = dashboard({
      subscription: { status: "trial", trialEndsAt: inDays(-4) } as never,
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Your trial ends today");
  });

  it("outranks a full limit, because the deadline takes it with it", () => {
    mockState.data = dashboard({
      subscription: { status: "trial", trialEndsAt: inDays(2) } as never,
      usage: [usage({ used: 50, effective: 50 })],
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("left in your trial");
    expect(screen.getByRole("status")).not.toHaveTextContent("used");
  });
});

describe("the capacity nudge", () => {
  it("stays quiet below four-fifths full", () => {
    mockState.data = dashboard({ usage: [usage({ used: 39, effective: 50 })] });
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it("warns once four-fifths of the allowance is gone", () => {
    mockState.data = dashboard({ usage: [usage({ used: 40, effective: 50 })] });
    show();
    expect(screen.getByRole("status")).toHaveTextContent(
      "40 of 50 products per branch used",
    );
  });

  it("changes its wording once there is no room at all", () => {
    mockState.data = dashboard({ usage: [usage({ used: 50, effective: 50 })] });
    show();
    expect(screen.getByRole("status")).toHaveTextContent(
      "You've used all 50 products per branch",
    );
    expect(screen.getByRole("button")).toHaveTextContent("Upgrade");
  });

  it("ignores unlimited rows, which are never nearly full", () => {
    mockState.data = dashboard({
      usage: [usage({ used: 9000, effective: null, isUnlimited: true })],
    });
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores a zero allowance rather than dividing by it", () => {
    // A misconfigured plan shouldn't render "0 of 0 used" forever.
    mockState.data = dashboard({ usage: [usage({ used: 0, effective: 0 })] });
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });

  it("reports the tightest limit when several are close", () => {
    mockState.data = dashboard({
      usage: [
        usage({ label: "Products per branch", used: 41, effective: 50 }),
        usage({
          featureKey: "max_team_seats",
          label: "Team members",
          used: 10,
          effective: 10,
        }),
      ],
    });
    show();
    // Seats are 100% gone against products' 82%, so seats is the one to say.
    // Labels are lowercased into the sentence.
    expect(screen.getByRole("status")).toHaveTextContent(
      "You've used all 10 team members",
    );
  });
});

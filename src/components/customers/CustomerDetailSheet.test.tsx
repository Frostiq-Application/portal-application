import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerDetailSheet } from "./CustomerDetailSheet";

/**
 * The customer drawer, split into who they are and what they have bought.
 *
 * The history is the half that grows without limit — a regular buyer has
 * hundreds of orders behind them — so it is paged rather than delivered whole,
 * and it is not requested at all until someone asks to see it. Most trips to
 * this drawer are a phone number or a delivery address lookup.
 */

/** Args every render asked the history for, with the skip flag it carried. */
const ordersQueries: { page?: number; limit?: number; skip?: boolean }[] = [];

vi.mock("@/features/api/customersApi", () => {
  const customer = {
    id: "c1",
    name: "Asha Mehta",
    phone: "+919812345678",
    email: "asha@example.com",
    isActive: true,
    orderCount: 25,
    totalSpent: "18400.00",
    lastOrderAt: "2026-08-01T10:00:00.000Z",
    createdAt: "2025-02-11T00:00:00.000Z",
    addresses: [],
    orders: [],
  };

  // Stable page identities across renders, the way RTK Query hands back a
  // cached response — a fresh object each render reads to the accumulator as a
  // new page and loops.
  const buildPage = (page: number) => ({
    data: Array.from({ length: 10 }, (_, i) => {
      const n = (page - 1) * 10 + i + 1;
      return {
        id: `o${n}`,
        orderNumber: `ORD-${String(n).padStart(3, "0")}`,
        status: "delivered",
        totalAmount: "450.00",
        paymentStatus: "paid",
        deliveryType: "delivery",
        scheduledDate: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.000Z",
      };
    }),
    meta: { total: 25, page, limit: 10, totalPages: 3 },
  });
  const pages: Record<number, ReturnType<typeof buildPage>> = {
    1: buildPage(1),
    2: buildPage(2),
    3: buildPage(3),
  };

  return {
    useGetCustomerQuery: () => ({ data: customer, isLoading: false }),
    useListCustomerOrdersQuery: (
      args: { page?: number; limit?: number },
      opts?: { skip?: boolean },
    ) => {
      ordersQueries.push({ ...args, skip: opts?.skip });
      if (opts?.skip) return { currentData: undefined, isFetching: false };
      const result = pages[args.page ?? 1];
      return { data: result, currentData: result, isFetching: false };
    },
  };
});

// Opening an order from the history is the drawer's job; what that drawer then
// renders is covered by its own tests.
vi.mock("@/components/orders/OrderDetailDrawer", () => ({
  OrderDetailDrawer: () => null,
}));

/**
 * A sentinel that can actually be brought into view. The shared test setup
 * stubs IntersectionObserver with one that never fires, which is right for the
 * lists that only assert their first batch — this one has to page.
 */
let intersect: (() => void) | null = null;
class ScrollableObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    intersect = () =>
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as never,
      );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver = ScrollableObserver as never;

const renderSheet = () =>
  render(<CustomerDetailSheet customerId="c1" onOpenChange={vi.fn()} />);

const orderRows = () => screen.queryAllByRole("button", { name: /^ORD-/ });
const lastQuery = () => ordersQueries[ordersQueries.length - 1];

const openHistory = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("tab", { name: /order history/i }));
};

describe("CustomerDetailSheet", () => {
  beforeEach(() => {
    ordersQueries.length = 0;
    intersect = null;
  });

  it("opens on the details, and leaves the history unfetched until asked", () => {
    renderSheet();

    expect(screen.getByText("+919812345678")).toBeVisible();
    expect(orderRows()).toHaveLength(0);
    // Rendered, but skipped: no request leaves for history nobody has opened.
    expect(ordersQueries.every((q) => q.skip)).toBe(true);
  });

  it("switches to the history, ten orders at a time", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ page: 1, limit: 10, skip: false }),
    );
    expect(orderRows()).toHaveLength(10);
    // The details half is out of the way, not alongside it.
    expect(screen.queryByText("+919812345678")).not.toBeInTheDocument();
  });

  it("appends the next ten when the list is scrolled to the end", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);
    await waitFor(() => expect(orderRows()).toHaveLength(10));

    await act(async () => intersect?.());

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));
    // Appended, not replaced — the first page is still above the second.
    expect(orderRows()).toHaveLength(20);
    expect(orderRows()[0]).toHaveAccessibleName(/ORD-001/);
  });

  it("goes back to the details without re-requesting the history", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);
    await waitFor(() => expect(orderRows()).toHaveLength(10));

    await user.click(screen.getByRole("tab", { name: /customer details/i }));

    expect(await screen.findByText("+919812345678")).toBeVisible();
    expect(orderRows()).toHaveLength(0);
    expect(lastQuery()).toMatchObject({ skip: true });
  });
});

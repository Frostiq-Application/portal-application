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
 *
 * The history itself is two lists, not one: catalog orders and custom cake
 * orders. The split is the server's — each side is asked for by `type` and
 * pages on its own count — so what these tests watch is that the drawer asks
 * for one half at a time and never carries one side's rows into the other.
 */

/** Args every render asked the history for, with the skip flag it carried. */
const ordersQueries: {
  page?: number;
  limit?: number;
  type?: string;
  skip?: boolean;
}[] = [];

vi.mock("@/features/api/customersApi", () => {
  const customer = {
    id: "c1",
    name: "Asha Mehta",
    phone: "+919812345678",
    email: "asha@example.com",
    isActive: true,
    orderCount: 27,
    totalSpent: "18400.00",
    lastOrderAt: "2026-08-01T10:00:00.000Z",
    createdAt: "2025-02-11T00:00:00.000Z",
    addresses: [],
    orders: [],
  };

  const order = (n: number, isCustomCake: boolean) => ({
    id: `o${n}`,
    orderNumber: `ORD-${String(n).padStart(3, "0")}`,
    status: "delivered",
    totalAmount: "450.00",
    paymentStatus: "paid",
    deliveryType: "delivery",
    scheduledDate: "2026-08-01",
    createdAt: "2026-08-01T10:00:00.000Z",
    isCustomCake,
  });

  // Stable page identities across renders, the way RTK Query hands back a
  // cached response — a fresh object each render reads to the accumulator as a
  // new page and loops.
  const cakePage = (page: number) => ({
    data: Array.from({ length: 10 }, (_, i) =>
      order((page - 1) * 10 + i + 1, false),
    ),
    meta: { total: 25, page, limit: 10, totalPages: 3 },
  });
  // Two custom cakes against twenty-five catalog orders — the realistic ratio,
  // and short enough that a stray page of the other half is obvious.
  const customPage = {
    data: [order(901, true), order(902, true)],
    meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
  };
  const pages: Record<string, { data: unknown[]; meta: unknown }> = {
    "cake:1": cakePage(1),
    "cake:2": cakePage(2),
    "cake:3": cakePage(3),
    "custom:1": customPage,
  };

  return {
    useGetCustomerQuery: () => ({ data: customer, isLoading: false }),
    useListCustomerOrdersQuery: (
      args: { page?: number; limit?: number; type?: string },
      opts?: { skip?: boolean },
    ) => {
      ordersQueries.push({ ...args, skip: opts?.skip });
      if (opts?.skip) return { currentData: undefined, isFetching: false };
      const result = pages[`${args.type ?? "cake"}:${args.page ?? 1}`];
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

const openSection = async (
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) => {
  await user.click(screen.getByRole("button", { name }));
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

  it("opens the history on the catalog half, and asks for that half alone", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);

    await waitFor(() => expect(lastQuery()).toMatchObject({ type: "cake" }));
    expect(orderRows()).toHaveLength(10);
    // Nothing from the other side leaks in — no row carries the custom marker.
    expect(
      orderRows().filter((r) => /custom/i.test(r.textContent ?? "")),
    ).toHaveLength(0);
  });

  it("swaps the list for the custom cakes, from page one", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);
    await waitFor(() => expect(orderRows()).toHaveLength(10));

    await openSection(user, /^Custom cake orders$/);

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ page: 1, type: "custom" }),
    );
    // Replaced, not appended: the catalog page above it is gone.
    expect(orderRows()).toHaveLength(2);
    expect(orderRows()[0]).toHaveAccessibleName(/ORD-901/);
    expect(orderRows()[0]).toHaveAccessibleName(/custom/i);
  });

  it("does not carry a scrolled-into page across the split", async () => {
    const user = userEvent.setup();
    renderSheet();
    await openHistory(user);
    await waitFor(() => expect(orderRows()).toHaveLength(10));
    await act(async () => intersect?.());
    await waitFor(() => expect(orderRows()).toHaveLength(20));

    await openSection(user, /^Custom cake orders$/);
    await waitFor(() => expect(orderRows()).toHaveLength(2));

    // Back to the catalog half at page one, not the twenty it had scrolled to.
    await openSection(user, /^Cake orders$/);
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ page: 1, type: "cake" }),
    );
    expect(orderRows()).toHaveLength(10);
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

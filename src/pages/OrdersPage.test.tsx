import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { isoToday } from "@/lib/orders";

/**
 * The order queue's fulfilment view.
 *
 * What these tests protect is the thing the screen exists for: a shop opening
 * Orders should see what is due *today*, when each one is due, and be able to
 * re-order the queue. So: the day tabs drive the request, the delivery window
 * is readable rather than a raw `13:30:00`, anything left over from a past day
 * is visibly late, and the sort headers reach the server (a client-side sort
 * would only reorder what has been scrolled in, which is a lie about the rest).
 * The queue scrolls rather than pages, so the batch boundary never interrupts
 * someone working their way down the list.
 */

const TODAY = isoToday();
const day = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const order = (over: Record<string, unknown>) => ({
  id: "o1",
  orderNumber: "DIV-0001",
  status: "placed",
  deliveryType: "delivery",
  scheduledDate: TODAY,
  scheduledSlotStart: "10:00:00",
  scheduledSlotEnd: "12:00:00",
  totalAmount: "1797.00",
  paymentStatus: "paid",
  ...over,
});

const mockState = vi.hoisted(() => ({
  // Args the page last passed to each query — how we assert what it asked for.
  listArgs: undefined as Record<string, unknown> | undefined,
  rows: [] as Record<string, unknown>[],
  /** Server-side page depth, so the scroll footer can be exercised. */
  meta: { page: 1, totalPages: 1, total: 0 } as Record<string, number>,
  /** The signed-in user's effective permissions — what the page gates on. */
  permissions: [] as string[],
  role: "shop_admin" as string,
  /**
   * A request in flight for a filter that isn't cached — what RTK hands back on
   * every filter change *after* the first: no `currentData` for the new args,
   * `isFetching`, and `isLoading` already false because the hook has a
   * successful `lastResult` from the filter before it.
   */
  inFlight: false,
}));

vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (select: (s: unknown) => unknown) =>
    select({
      branch: { selectedBranchId: "shop-1" },
      notifications: { streamStatus: "open" },
      auth: {
        accessToken: "t",
        user: {
          id: "u1",
          role: mockState.role,
          permissions: mockState.permissions,
        },
      },
    }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({ hasFeature: () => true, isExempt: false }),
}));
vi.mock("@/components/ShopSelect", () => ({
  ShopSelect: () => <div data-testid="shop-select" />,
}));
vi.mock("@/components/orders/OrderDetailDrawer", () => ({
  OrderDetailDrawer: () => null,
}));
vi.mock("@/components/orders/CreateOrderDialog", () => ({
  CreateOrderDialog: () => null,
}));
vi.mock("@/features/api/ordersApi", () => ({
  useListOrdersQuery: (args: Record<string, unknown>) => {
    mockState.listArgs = args;
    if (mockState.inFlight) {
      return { currentData: undefined, isLoading: false, isFetching: true };
    }
    return {
      // The queue reads `currentData`, so a filter change never paints the
      // previous filter's rows.
      currentData: {
        data: mockState.rows,
        meta: {
          total: mockState.meta.total || mockState.rows.length,
          page: mockState.meta.page,
          limit: 20,
          totalPages: mockState.meta.totalPages,
        },
      },
      isLoading: false,
      isFetching: false,
    };
  },
  useGetOrderStatusCountsQuery: () => ({ data: { placed: 3, preparing: 1 } }),
  useGetOrderScheduleCountsQuery: () => ({
    data: { today: 2, tomorrow: 4, overmorrow: 1, other: 7, all: 14 },
  }),
  useUpdateOrderStatusMutation: () => [vi.fn(), { isLoading: false }],
  useMarkOrderPaidMutation: () => [vi.fn(), { isLoading: false }],
  useCancelOrderMutation: () => [vi.fn(), { isLoading: false }],
}));

const { OrdersPage } = await import("./OrdersPage");

const renderPage = () =>
  render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  );

/** The row for an order number, as a scope for cell-level queries. */
const rowFor = (orderNumber: string) =>
  screen.getByText(orderNumber).closest("tr") as HTMLElement;

beforeEach(() => {
  mockState.listArgs = undefined;
  mockState.meta = { page: 1, totalPages: 1, total: 0 };
  mockState.inFlight = false;
  mockState.role = "shop_admin";
  mockState.permissions = [
    "orders.view",
    "orders.status",
    "orders.create",
    "orders.manage",
  ];
  mockState.rows = [
    order({ id: "o1", orderNumber: "DIV-0001" }),
    order({
      id: "o2",
      orderNumber: "DIV-0002",
      scheduledDate: day(1),
      scheduledSlotStart: null,
      scheduledSlotEnd: null,
    }),
    order({
      id: "o3",
      orderNumber: "DIV-0003",
      scheduledDate: day(-2),
      status: "preparing",
      scheduledSlotStart: "16:15:00",
      scheduledSlotEnd: null,
    }),
    order({
      id: "o4",
      orderNumber: "DIV-0004",
      scheduledDate: day(-3),
      status: "delivered",
    }),
  ];
});

describe("delivery-day tabs", () => {
  it("opens on today and asks the server for today's orders", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /^Today/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mockState.listArgs).toMatchObject({
      dateBucket: "today",
      refDate: TODAY,
    });
  });

  it("shows every day's total so the next-busiest day is obvious", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Tomorrow\s*4/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Other days\s*7/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /All days\s*14/ })).toBeVisible();
  });

  it("switches the request when another day is picked", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /^Other days/ }));
    expect(mockState.listArgs).toMatchObject({ dateBucket: "other" });
  });

  it("drops the day filter entirely on 'All days'", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /^All days/ }));
    expect(mockState.listArgs?.dateBucket).toBeUndefined();
  });
});

describe("the delivery window", () => {
  it("reads as a time range, not a database value", () => {
    renderPage();
    expect(
      within(rowFor("DIV-0001")).getByText("10:00 AM – 12:00 PM"),
    ).toBeVisible();
  });

  it("shows the start alone when there is no end", () => {
    renderPage();
    expect(within(rowFor("DIV-0003")).getByText("4:15 PM")).toBeVisible();
  });

  it("says 'Any time' rather than leaving a blank cell", () => {
    renderPage();
    expect(within(rowFor("DIV-0002")).getByText("Any time")).toBeVisible();
  });

  it("names the day in the shop's own words", () => {
    renderPage();
    expect(within(rowFor("DIV-0001")).getByText("Today")).toBeVisible();
    expect(within(rowFor("DIV-0002")).getByText("Tomorrow")).toBeVisible();
    expect(within(rowFor("DIV-0003")).getByText("2 days ago")).toBeVisible();
  });
});

describe("overdue orders", () => {
  it("flags an order still in the kitchen after its delivery day", () => {
    renderPage();
    expect(within(rowFor("DIV-0003")).getByText("Late")).toBeVisible();
  });

  it("leaves today's orders and finished ones unflagged", () => {
    renderPage();
    expect(within(rowFor("DIV-0001")).queryByText("Late")).toBeNull();
    // Delivered on a past day is history, not outstanding work.
    expect(within(rowFor("DIV-0004")).queryByText("Late")).toBeNull();
  });
});

describe("sorting", () => {
  it("starts on the fulfilment running order, soonest first", () => {
    renderPage();
    expect(mockState.listArgs).toMatchObject({
      sortBy: "schedule",
      sortDir: "asc",
    });
  });

  it("sorts by time of day from the delivery-time header", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Delivery time/ }));
    expect(mockState.listArgs).toMatchObject({ sortBy: "slot", sortDir: "asc" });
  });

  it("reverses when the active column is clicked again", async () => {
    renderPage();
    const header = screen.getByRole("button", { name: /Delivery date/ });
    await userEvent.click(header);
    expect(mockState.listArgs).toMatchObject({
      sortBy: "schedule",
      sortDir: "desc",
    });
  });

  it("opens a new column at its own natural direction, biggest orders first", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Total/ }));
    expect(mockState.listArgs).toMatchObject({
      sortBy: "total",
      sortDir: "desc",
    });
  });
});

describe("row actions", () => {
  it("keeps advancing the order one click away", () => {
    renderPage();
    expect(
      within(rowFor("DIV-0001")).getByRole("button", { name: "Mark Confirmed" }),
    ).toBeVisible();
  });

  it("puts the occasional actions behind the overflow menu", async () => {
    renderPage();
    const row = rowFor("DIV-0002");
    // Not inline — as plain buttons these wrapped the actions cell onto three
    // lines once the queue grew a delivery-time column.
    expect(row.querySelector("button[aria-label^='More actions']")).not.toBeNull();
    expect(within(row).queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(within(row).queryByRole("button", { name: /Decline/ })).toBeNull();
  });
});

describe("raising an order", () => {
  it("keeps it off the chef's screen — the kitchen bakes orders, it does not raise them", () => {
    mockState.role = "chef";
    mockState.permissions = ["orders.view", "orders.status", "kitchen.view"];
    renderPage();
    expect(screen.queryByRole("button", { name: /Create order/ })).toBeNull();
  });

  it("hides the button from a role that cannot, rather than 403ing on submit", () => {
    // A rider watches the queue but does not write orders up.
    mockState.role = "delivery_manager";
    mockState.permissions = ["orders.view", "orders.status", "delivery.view"];
    renderPage();
    expect(screen.queryByRole("button", { name: /Create order/ })).toBeNull();
  });

  it("still offers it to the counter, which is whose job it is", () => {
    mockState.role = "staff";
    mockState.permissions = [
      "orders.view",
      "orders.status",
      "orders.create",
      "orders.manage",
    ];
    renderPage();
    expect(screen.getByRole("button", { name: /Create order/ })).toBeVisible();
  });
});

describe("scrolling the queue", () => {
  it("has no pager to press, the next batch comes in on scroll", () => {
    mockState.meta = { page: 1, totalPages: 3, total: 60 };
    renderPage();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
  });

  it("says how much of the queue is loaded, so the scroll has an end in sight", () => {
    mockState.meta = { page: 1, totalPages: 3, total: 60 };
    renderPage();
    expect(screen.getByText("Showing 4 of 60 orders")).toBeVisible();
    expect(screen.getByText("Loading more orders…")).toBeVisible();
  });

  it("calls the end of the queue rather than dangling a loader forever", () => {
    mockState.meta = { page: 1, totalPages: 1, total: 4 };
    renderPage();
    expect(screen.getByText("That's every order in this queue.")).toBeVisible();
    expect(screen.queryByText("Loading more orders…")).toBeNull();
  });

  it("counts depth from the server's page, not the last one clicked", () => {
    // Returning to a tab replays its accumulated pages: three loaded, three
    // total, so there is nothing left to fetch even though nobody scrolled yet.
    mockState.meta = { page: 3, totalPages: 3, total: 4 };
    renderPage();
    expect(screen.getByText("That's every order in this queue.")).toBeVisible();
  });
});

describe("empty state", () => {
  it("names the day, so it doesn't read as 'this shop has no orders'", () => {
    mockState.rows = [];
    renderPage();
    expect(screen.getByText("No new orders due today.")).toBeVisible();
  });

  /**
   * The queue used to gate its skeleton on RTK's `isLoading`, which only ever
   * fires for a hook's *first* request — every later filter change reported
   * "not loading" with no rows yet, so the table showed "no orders" over a
   * queue that was still being fetched. The skeleton is tied to `currentData`
   * now, the same value the rows come from.
   */
  it("shows placeholders, not 'no orders', while a filter change is in flight", async () => {
    const { container } = renderPage();
    expect(screen.getByText("DIV-0001")).toBeVisible();

    mockState.inFlight = true;
    await userEvent.click(screen.getByRole("button", { name: /^Preparing/ }));

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText(/No .* orders/)).toBeNull();
    expect(screen.getByText("Loading orders…")).toBeVisible();
    // The rows themselves are gone — the point is that nothing claims the
    // queue is empty while we're still asking.
    expect(screen.queryByText("DIV-0001")).toBeNull();
  });
});

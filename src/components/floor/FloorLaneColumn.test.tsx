import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * Widening a lane's page is a new RTK Query cache key, so `data` comes back
 * undefined for a render or two while the wider page is in flight. The column
 * holds the last page it saw so "Show more" grows the list instead of blanking
 * the column and refilling it.
 *
 * That last page used to live in a ref written during render. A render can be
 * thrown away and replayed, and a ref written during the discarded attempt
 * keeps its value — so the column could show a page React decided never
 * happened. It's state now, which rolls back with the render.
 */
const mockState = vi.hoisted(() => ({
  /** limit -> the page that request resolves to (undefined = in flight). */
  pages: new Map<number, unknown>(),
}));

vi.mock("@/features/api/ordersApi", () => ({
  useListBoardOrdersQuery: (args: { limit?: number }) => ({
    data: mockState.pages.get(args.limit ?? 10),
    isLoading: !mockState.pages.has(args.limit ?? 10),
    isFetching: false,
  }),
}));

vi.mock("./FloorOrderCard", () => ({
  FloorOrderCard: ({ order }: { order: { orderNumber: string } }) => (
    <div data-testid="order">{order.orderNumber}</div>
  ),
}));

const { FloorLaneColumn } = await import("./FloorLaneColumn");

const order = (n: number) => ({
  id: `o${n}`,
  orderNumber: `KIT-000${n}`,
  status: "confirmed",
  scheduledDate: `2026-07-2${n}`,
  items: [],
});

const page = (count: number, total: number) => ({
  data: Array.from({ length: count }, (_, i) => order(i + 1)),
  meta: { total, page: 1, limit: count, totalPages: 1 },
});

const renderColumn = () =>
  render(
    <FloorLaneColumn
      lane={{ status: "confirmed", label: "To bake", hint: "" } as never}
      actions={[]}
      shopId="s1"
      pollingInterval={0}
      registerLane={() => () => {}}
      drag={null}
      accepted={false}
      busyId={null}
      landedId={null}
      deniedId={null}
      dropAccepted={false}
      onPointerDown={() => {}}
      onAdvance={() => {}}
      onOpen={() => {}}
      onTotal={() => {}}
    />,
  );

describe("FloorLaneColumn page retention", () => {
  beforeEach(() => mockState.pages.clear());

  it("renders the orders from the first page", () => {
    mockState.pages.set(10, page(2, 2));
    renderColumn();
    expect(screen.getAllByTestId("order")).toHaveLength(2);
  });

  it("keeps showing the last page while a wider one is in flight", () => {
    // 2 of 25 loaded, so the lane offers "Show more"; the widened page (limit
    // 20) is deliberately absent from the cache, i.e. still in flight.
    mockState.pages.set(10, page(2, 25));
    renderColumn();
    expect(screen.getAllByTestId("order")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /show .* more/i }));

    // Same mounted instance, now asking for a limit that has no data yet.
    // The rows it already had must survive: no empty state, no skeleton.
    expect(screen.getAllByTestId("order")).toHaveLength(2);
    expect(screen.queryByText("Nothing here")).toBeNull();
  });

  it("shows the empty state only when the server really returns nothing", () => {
    mockState.pages.set(10, page(0, 0));
    renderColumn();
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  // A lane that has never answered must not claim to be empty, and must not
  // print a confident "0" in its header — both read as settled facts.
  it("shows placeholders, not an empty lane, before the first page lands", () => {
    const { container } = renderColumn();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("order")).toBeNull();
    expect(screen.queryByText("Nothing here")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
  });
});

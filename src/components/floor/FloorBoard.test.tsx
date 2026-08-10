import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The kitchen and delivery boards.
 *
 * What matters here is the thing a table can't be tested for: an order only
 * moves when it's dropped somewhere the pipeline actually allows, a press that
 * never travelled is still a press and not a drag, and the button stays a
 * complete alternative to dragging for anyone who can't.
 */

const mockState = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  /** Every status change the board asked the API for. */
  updates: [] as { id: string; status: string }[],
  /** Args of every list request, one per lane. */
  listArgs: [] as Record<string, unknown>[],
  /**
   * Pages keyed like RTK Query's cache. Real `data` keeps its identity across
   * renders; a mock that rebuilt it every time would be a different component
   * contract than the one that ships.
   */
  pages: new Map<string, unknown>(),
  /** Hold every lane's first response, so the board renders mid-load. */
  loading: false,
}));

const order = (over: Record<string, unknown>) => ({
  id: "o1",
  orderNumber: "KIT-0001",
  status: "confirmed",
  deliveryType: "pickup",
  scheduledDate: "2026-07-29",
  scheduledSlotStart: "10:00:00",
  scheduledSlotEnd: "12:00:00",
  customerNote: null,
  items: [
    {
      id: "i1",
      productName: "Chocolate Truffle",
      variantLabel: "1 kg",
      flavorName: "Dark 70%",
      quantity: 2,
      addons: [],
    },
  ],
  ...over,
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (select: (s: unknown) => unknown) =>
    select({
      branch: { selectedBranchId: "shop-1" },
      notifications: { streamStatus: "open" },
      auth: {
        user: { permissions: ["orders.view", "orders.status"] },
        accessToken: "t",
      },
    }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({ hasFeature: () => true, isExempt: true }),
}));
vi.mock("@/features/api/ordersApi", () => ({
  // Each lane asks for its own status, so the fake server filters like the
  // real one does — a lane that returns everything would hide a routing bug.
  useListBoardOrdersQuery: (args: { status?: string; limit?: number }) => {
    mockState.listArgs.push(args);
    if (mockState.loading) {
      return { data: undefined, isLoading: true, isFetching: true };
    }
    const limit = args.limit ?? 10;
    const key = `${args.status ?? "all"}:${limit}`;
    let page = mockState.pages.get(key);
    if (!page) {
      const all = mockState.rows.filter(
        (o) => !args.status || o.status === args.status,
      );
      page = {
        data: all.slice(0, limit),
        meta: { total: all.length, page: 1, limit, totalPages: 1 },
      };
      mockState.pages.set(key, page);
    }
    return { data: page, isLoading: false, isFetching: false };
  },
  useUpdateOrderStatusMutation: () => [
    (args: { id: string; status: string }) => {
      mockState.updates.push(args);
      return { unwrap: () => Promise.resolve({}) };
    },
    { isLoading: false },
  ],
  useGetOrderQuery: () => ({ data: undefined, isLoading: true }),
}));

const { FloorBoard } = await import("./FloorBoard");

const LANES = [
  { status: "confirmed" as const, label: "To start", hint: "Not yet baking" },
  { status: "preparing" as const, label: "In progress", hint: "Mark when boxed" },
];
const ACTIONS = [
  {
    from: "confirmed" as const,
    to: "preparing" as const,
    label: "Start baking",
    primary: true,
  },
  { from: "preparing" as const, to: "ready" as const, label: "Mark ready" },
];

/**
 * jsdom gives every element a zero-size rect, so the board could never work
 * out which lane a pointer is over. Lay the two lanes out side by side.
 */
function layOutLanes(container: HTMLElement) {
  const [left, right] = Array.from(container.querySelectorAll("section"));
  const rect = (l: number, r: number) =>
    ({ left: l, right: r, top: 0, bottom: 500, width: r - l, height: 500, x: l, y: 0, toJSON: () => ({}) }) as DOMRect;
  left.getBoundingClientRect = () => rect(0, 300);
  right.getBoundingClientRect = () => rect(320, 620);
  return { left, right };
}

const handleFor = (orderNumber: string) =>
  screen.getByText(orderNumber).closest("[data-drag-handle]") as HTMLElement;

/**
 * Press the card's grab bar. Its own `act` block, because the board only
 * attaches its window listeners in the effect that follows this render — the
 * browser flushes that between the press and the first move, and a test that
 * batched both would be dragging with nothing listening.
 */
async function press(handle: HTMLElement) {
  await act(async () => {
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
      clientY: 100,
    });
  });
}

/** Press, travel, release — the whole gesture in viewport coordinates. */
async function dragTo(handle: HTMLElement, x: number, y: number) {
  await press(handle);
  await act(async () => {
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: (100 + x) / 2,
      clientY: y,
    });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });
  });
}

const renderBoard = () =>
  render(
    <FloorBoard lanes={LANES} actions={ACTIONS} emptyLabel="Nothing to bake." />,
  );

beforeEach(() => {
  mockState.updates = [];
  mockState.listArgs = [];
  mockState.pages.clear();
  mockState.loading = false;
  mockState.rows = [order({})];
});

describe("floor board", () => {
  it("lays orders out in the lane matching their status", () => {
    const { container } = renderBoard();
    const [toStart, inProgress] = Array.from(
      container.querySelectorAll("section"),
    );
    expect(within(toStart).getByText("KIT-0001")).toBeInTheDocument();
    expect(within(inProgress).queryByText("KIT-0001")).toBeNull();
  });

  /**
   * A lane reads 0 before its first response, and the board used to take that
   * as an answer — so a cold open flashed "nothing to bake" across the top
   * while the lanes underneath were still loading. Lanes stay silent until
   * they've actually heard from the server.
   */
  it("holds the empty state back until every lane has reported", () => {
    mockState.loading = true;
    const { container, rerender } = renderBoard();
    expect(screen.queryByText("Nothing to bake.")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    // Lanes answer, and both are genuinely empty this time.
    mockState.loading = false;
    mockState.rows = [];
    rerender(
      <FloorBoard lanes={LANES} actions={ACTIONS} emptyLabel="Nothing to bake." />,
    );
    expect(screen.getByText("Nothing to bake.")).toBeInTheDocument();
  });

  it("asks each lane for its own status, ten at a time", () => {
    renderBoard();
    expect(mockState.listArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "confirmed", limit: 10 }),
        expect.objectContaining({ status: "preparing", limit: 10 }),
      ]),
    );
    // Never the whole pipeline in one go.
    expect(
      mockState.listArgs.some((a) => !a.status || (a.limit as number) > 10),
    ).toBe(false);
  });

  it("offers the next chunk only when the server says there's more", async () => {
    mockState.rows = Array.from({ length: 23 }, (_, i) =>
      order({ id: `o${i}`, orderNumber: `KIT-${String(i).padStart(4, "0")}` }),
    );
    renderBoard();

    const more = screen.getByRole("button", { name: /show 10 more/i });
    expect(more).toHaveTextContent("13 left");
    expect(screen.getAllByText(/^KIT-/)).toHaveLength(10);

    await userEvent.click(more);
    expect(screen.getAllByText(/^KIT-/)).toHaveLength(20);
    expect(
      screen.getByRole("button", { name: /show 3 more/i }),
    ).toHaveTextContent("3 left");
  });

  it("counts the whole lane, not just the chunk on screen", () => {
    mockState.rows = Array.from({ length: 23 }, (_, i) =>
      order({ id: `o${i}`, orderNumber: `KIT-${String(i).padStart(4, "0")}` }),
    );
    const { container } = renderBoard();
    const [toStart] = Array.from(container.querySelectorAll("section"));
    expect(within(toStart).getByText("23")).toBeInTheDocument();
  });

  it("advances an order dragged into the next lane", async () => {
    const { container } = renderBoard();
    layOutLanes(container);
    await dragTo(handleFor("KIT-0001"), 450, 200);
    expect(mockState.updates).toEqual([{ id: "o1", status: "preparing" }]);
  });

  it("leaves an order alone when dropped where the pipeline can't go", async () => {
    mockState.rows = [order({ status: "preparing" })];
    const { container } = renderBoard();
    layOutLanes(container);
    // "In progress" back to "To start" is not a transition the board offers.
    await dragTo(handleFor("KIT-0001"), 150, 200);
    expect(mockState.updates).toEqual([]);
  });

  it("treats a press that never travelled as a press, not a drag", async () => {
    const { container } = renderBoard();
    layOutLanes(container);
    await press(handleFor("KIT-0001"));
    await act(async () => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 100 });
    });
    expect(mockState.updates).toEqual([]);
  });

  it("keeps the button as a full alternative to dragging", async () => {
    renderBoard();
    await userEvent.click(screen.getByRole("button", { name: /start baking/i }));
    expect(mockState.updates).toEqual([{ id: "o1", status: "preparing" }]);
  });
});

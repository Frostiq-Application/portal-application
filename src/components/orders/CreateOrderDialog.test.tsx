import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrderDialog } from "./CreateOrderDialog";

/**
 * Manual order entry, from the staff side.
 *
 * The line list is the part that bites: a row that can't be taken off the
 * order leaves the only escape route "close the dialog and start again". The
 * remove button used to be disabled whenever one row was left — which is the
 * state a one-item order is in the whole time.
 */

const page = <T,>(rows: T[]) => ({
  data: rows,
  meta: { total: rows.length, page: 1, limit: 20, totalPages: 1 },
});

vi.mock("@/features/api/ordersApi", () => ({
  useCreateOrderMutation: () => [vi.fn(), { isLoading: false }],
}));
/** Every arg object the picker has asked the customer list for, in order. */
const customerQueries: { page?: number; limit?: number; search?: string }[] = [];

vi.mock("@/features/api/customersApi", () => {
  // One stable page object across renders, the way RTK Query hands back a
  // cached response — a fresh identity each render would look like a new page
  // to the accumulator and loop.
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i + 1}`,
    name: `Customer ${i + 1}`,
    phone: `+9198123456${i}`,
    email: null,
  }));
  const result = {
    data: rows,
    meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
  };
  return {
    useListCustomersQuery: (args: { page?: number; limit?: number; search?: string }) => {
      customerQueries.push(args);
      return { data: result, currentData: result, isFetching: false };
    },
    useGetCustomerQuery: () => ({ data: undefined }),
  };
});
vi.mock("@/features/api/catalogApi", () => ({
  useListProductsQuery: () => ({
    data: page([
      {
        id: "p1",
        name: "Chocolate Truffle",
        isActive: true,
        variants: [{ id: "v1", label: "500g", price: "450", isDefault: true }],
        flavorOptions: [],
      },
    ]),
  }),
  useListAddonsQuery: () => ({ data: page([]) }),
}));
vi.mock("@/features/api/schedulingApi", () => ({
  useGetSlotsQuery: () => ({ data: undefined }),
}));
vi.mock("@/features/api/shopsApi", () => ({
  useListShopsQuery: () => ({
    data: page([{ id: "shop-1", branchName: "Kothrud" }]),
  }),
}));

const renderDialog = () =>
  render(
    <CreateOrderDialog open onOpenChange={vi.fn()} defaultShopId="shop-1" />,
  );

const removeButtons = () => screen.queryAllByRole("button", { name: /remove item/i });

const lastCustomerQuery = () => customerQueries[customerQueries.length - 1];

describe("CreateOrderDialog customer picker", () => {
  beforeEach(() => {
    customerQueries.length = 0;
  });

  it("asks for one small page at a time, not the whole directory", () => {
    renderDialog();

    expect(lastCustomerQuery()).toMatchObject({ page: 1, limit: 10 });
    expect(
      screen.getAllByRole("button", { name: /^Customer \d+/ }),
    ).toHaveLength(10);
  });

  it("waits for typing to settle before searching", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByPlaceholderText(/search by name, phone or email/i),
      "vik",
    );
    // Mid-keystroke: still the unfiltered list, no request per character.
    expect(lastCustomerQuery().search).toBeUndefined();

    await waitFor(() =>
      expect(lastCustomerQuery()).toMatchObject({ search: "vik", page: 1 }),
    );
  });
});

describe("CreateOrderDialog items", () => {
  it("removes the row that was clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /add item/i }));
    expect(removeButtons()).toHaveLength(2);

    await user.click(removeButtons()[0]);
    expect(removeButtons()).toHaveLength(1);
  });

  it("lets the last remaining row go, and offers to start again", async () => {
    const user = userEvent.setup();
    renderDialog();

    // The regression: this was disabled, so a one-item order was stuck with it.
    expect(removeButtons()[0]).toBeEnabled();

    await user.click(removeButtons()[0]);

    expect(removeButtons()).toHaveLength(0);
    expect(screen.getByText(/no items on this order yet/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /add item/i }));
    expect(removeButtons()).toHaveLength(1);
  });
});

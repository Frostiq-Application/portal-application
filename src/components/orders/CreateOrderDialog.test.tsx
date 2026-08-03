import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
vi.mock("@/features/api/customersApi", () => ({
  useListCustomersQuery: () => ({ data: page([]), isFetching: false }),
  useGetCustomerQuery: () => ({ data: undefined }),
}));
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

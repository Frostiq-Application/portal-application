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

/** Bodies posted to POST /customers, and what the next call resolves to. */
const created: Record<string, unknown>[] = [];
let createResult: Record<string, unknown> = {};

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
    // A branch-scoped user cannot read back a customer with no orders yet, so
    // this stays empty for exactly the customer the form just created.
    useGetCustomerQuery: () => ({ data: undefined }),
    useCreateCustomerMutation: () => [
      (body: Record<string, unknown>) => {
        created.push(body);
        return { unwrap: () => Promise.resolve(createResult) };
      },
      { isLoading: false },
    ],
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

/**
 * Adding the customer without leaving the order.
 *
 * The case this exists for: an order arrives by phone from someone who has
 * never bought here, so the search that would normally find them cannot. Before
 * this, the only way through was to abandon the half-typed order.
 */
describe("CreateOrderDialog new customer", () => {
  beforeEach(() => {
    customerQueries.length = 0;
    created.length = 0;
    createResult = {
      id: "c-new",
      name: "Riya Sharma",
      phone: "+919812345678",
      email: null,
      isActive: true,
      orderCount: 0,
      totalSpent: "0.00",
      lastOrderAt: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      addresses: [],
      matchedExisting: false,
    };
  });

  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /new customer/i }));
  };

  it("carries the name that was searched for into the form", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByPlaceholderText(/search by name, phone or email/i),
      "Riya",
    );
    await openForm(user);

    expect(screen.getByPlaceholderText(/full name/i)).toHaveValue("Riya");
  });

  it("posts the new customer against the order's branch, and selects them", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openForm(user);

    await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
    await user.type(screen.getByPlaceholderText(/^phone number$/i), "9812345678");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      name: "Riya Sharma",
      phone: "+919812345678",
      shopId: "shop-1",
    });

    // The order now has its customer, and the picker is out of the way.
    expect(await screen.findByText("Riya Sharma")).toBeVisible();
    expect(
      screen.queryByPlaceholderText(/search by name, phone or email/i),
    ).not.toBeInTheDocument();
  });

  it("goes back to the picker if the form is cancelled", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openForm(user);

    expect(screen.queryByPlaceholderText(/full name/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^back$/i }));

    expect(
      screen.getByPlaceholderText(/search by name, phone or email/i),
    ).toBeVisible();
    expect(created).toHaveLength(0);
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

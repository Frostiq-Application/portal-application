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

/**
 * Whether this brand has the customer directory. It picks which customer picker
 * the dialog renders, so nearly every test here depends on it: true is the
 * long-standing search-the-directory path, false the phone lookup that brands
 * without the module get instead.
 */
let hasCustomerData = true;
vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    hasFeature: (key: string) =>
      key === "can_use_customer_data" ? hasCustomerData : false,
    isExempt: false,
  }),
}));

/**
 * Every call the picker has made to the customer list, in order — the query
 * args plus whether it was skipped. The hook itself runs on every render either
 * way (React forbids a conditional one), so `skip` is the only thing that says
 * whether a request actually left.
 */
const customerQueries: {
  page?: number;
  limit?: number;
  search?: string;
  skip?: boolean;
}[] = [];

/** Bodies posted to POST /customers, and what the next call resolves to. */
const created: Record<string, unknown>[] = [];
let createResult: Record<string, unknown> = {};

/** Phone lookups performed, and what the next one resolves to. */
const lookups: { phone: string; shopId?: string }[] = [];
let lookupResult: Record<string, unknown> = { found: false, customer: null };

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
    useListCustomersQuery: (
      args: { page?: number; limit?: number; search?: string },
      opts?: { skip?: boolean },
    ) => {
      customerQueries.push({ ...args, skip: opts?.skip });
      if (opts?.skip) return { data: undefined, currentData: undefined, isFetching: false };
      return { data: result, currentData: result, isFetching: false };
    },
    // A branch-scoped user cannot read back a customer with no orders yet, so
    // this stays empty for exactly the customer the form just created.
    useGetCustomerQuery: () => ({ data: undefined }),
    useLazyLookupCustomerByPhoneQuery: () => [
      (args: { phone: string; shopId?: string }) => {
        lookups.push(args);
        return { unwrap: () => Promise.resolve(lookupResult) };
      },
      { isFetching: false },
    ],
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

beforeEach(() => {
  // The directory path is the default; the lookup suite opts out explicitly.
  hasCustomerData = true;
  customerQueries.length = 0;
  lookups.length = 0;
  created.length = 0;
  lookupResult = { found: false, customer: null };
});

describe("CreateOrderDialog customer picker", () => {

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
    createResult = {
      id: "c-new",
      name: "Riya Sharma",
      phone: "+919812345678",
      email: "riya@example.com",
      isActive: true,
      isVerified: false,
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
    await user.type(
      screen.getByPlaceholderText(/name@example\.com/i),
      "riya@example.com",
    );
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      name: "Riya Sharma",
      phone: "+919812345678",
      email: "riya@example.com",
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

/**
 * Taking an order on a plan that has no customer directory.
 *
 * The bug this fixes: every customer route sat behind `can_use_customer_data`,
 * so these brands got a 403 from the picker's search, could not fill the order's
 * required customer field, and therefore could not create an order at all.
 *
 * What replaces the search must stay a lookup and not become the directory by
 * another name — one full number in, one customer out, nothing to browse. The
 * assertions below are as much about what is absent as what is present.
 */
describe("CreateOrderDialog without the customer directory", () => {
  const match = {
    found: true,
    customer: {
      id: "c-7",
      name: "Riya Sharma",
      phone: "+919812345678",
      email: "riya@example.com",
      isActive: true,
      isVerified: false,
      createdAt: "2026-08-10T00:00:00.000Z",
      addresses: [
        {
          id: "a1",
          label: "Home",
          fullAddress: "12 MG Road",
          landmark: null,
          city: "Pune",
          pincode: "411038",
          isDefault: true,
        },
      ],
    },
  };

  beforeEach(() => {
    hasCustomerData = false;
    createResult = {
      id: "c-new",
      name: "Riya Sharma",
      phone: "9812345678",
      email: "riya@example.com",
      isActive: true,
      isVerified: false,
      orderCount: 0,
      totalSpent: "0.00",
      lastOrderAt: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      addresses: [],
      matchedExisting: false,
    };
  });

  const phoneBox = () => screen.getByPlaceholderText(/10-digit mobile number/i);

  it("offers the number lookup instead of the directory search", () => {
    renderDialog();

    expect(phoneBox()).toBeVisible();
    expect(
      screen.queryByPlaceholderText(/search by name, phone or email/i),
    ).not.toBeInTheDocument();
    // Nothing may be asked of the endpoint that 403s for this brand — an
    // "upgrade your plan" error on a form they are entitled to use.
    expect(customerQueries.every((q) => q.skip)).toBe(true);
  });

  it("waits for the whole number before asking, then asks once", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(phoneBox(), "98123");
    expect(lookups).toHaveLength(0);

    await user.type(phoneBox(), "45678");
    await waitFor(() => expect(lookups).toHaveLength(1));
    expect(lookups[0]).toMatchObject({ phone: "9812345678", shopId: "shop-1" });
  });

  it("attaches the customer it finds", async () => {
    const user = userEvent.setup();
    lookupResult = match;
    renderDialog();

    await user.type(phoneBox(), "9812345678");
    await user.click(await screen.findByRole("button", { name: /^use$/i }));

    expect(await screen.findByText("Riya Sharma")).toBeVisible();
    expect(
      screen.queryByPlaceholderText(/10-digit mobile number/i),
    ).not.toBeInTheDocument();
    // Their profile is never fetched: GET /customers/:id is gated away for this
    // brand, which is why the lookup carries the addresses itself.
    expect(customerQueries.every((q) => q.skip)).toBe(true);
  });

  it("says a staff-entered record is unconfirmed", async () => {
    const user = userEvent.setup();
    lookupResult = match;
    renderDialog();

    await user.type(phoneBox(), "9812345678");
    expect(await screen.findByText(/unverified/i)).toBeVisible();
  });

  it("takes an unknown number into the form, already filled and fixed", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(phoneBox(), "9812345678");
    await user.click(
      await screen.findByRole("button", { name: /add this customer/i }),
    );

    // Fixed: staff established that THIS number has no customer, so editing it
    // here would create one against a number nobody checked.
    expect(screen.getByDisplayValue("9812345678")).toHaveAttribute("readonly");

    await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
    await user.type(
      screen.getByPlaceholderText(/name@example\.com/i),
      "riya@example.com",
    );
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      phone: "9812345678",
      email: "riya@example.com",
      shopId: "shop-1",
    });
    expect(await screen.findByText("Riya Sharma")).toBeVisible();
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

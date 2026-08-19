import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerPhoneLookup } from "./CustomerPhoneLookup";

/**
 * The customer picker for brands whose plan has no customer directory.
 *
 * What it must not become is a directory with the list hidden. The number is
 * whole or it is nothing: no partial matching, no request until ten digits are
 * in, and one customer back or none. The tests below hold that line as much as
 * they check the happy path.
 *
 * The other load-bearing bit is the handoff. A brand without the module cannot
 * fetch `GET /customers/:id`, so whatever addresses the lookup returned are the
 * only ones the order's delivery picker will ever see — they have to reach the
 * caller intact.
 */

const lookups: { phone: string; shopId?: string }[] = [];
let result: Record<string, unknown> = { found: false, customer: null };
let shouldFail = false;

vi.mock("@/features/api/customersApi", () => ({
  useLazyLookupCustomerByPhoneQuery: () => [
    (args: { phone: string; shopId?: string }) => {
      lookups.push(args);
      return {
        unwrap: () =>
          shouldFail
            ? Promise.reject({ data: { message: "Too many lookups" } })
            : Promise.resolve(result),
      };
    },
    { isFetching: false },
  ],
}));

const customer = {
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
};

const onSelect = vi.fn();
const onAddNew = vi.fn();

const renderLookup = () =>
  render(
    <CustomerPhoneLookup shopId="shop-1" onSelect={onSelect} onAddNew={onAddNew} />,
  );

const box = () => screen.getByPlaceholderText(/10-digit mobile number/i);

describe("CustomerPhoneLookup", () => {
  beforeEach(() => {
    lookups.length = 0;
    result = { found: false, customer: null };
    shouldFail = false;
    onSelect.mockClear();
    onAddNew.mockClear();
  });

  it("asks nothing until the whole number is in", async () => {
    const user = userEvent.setup();
    renderLookup();

    await user.type(box(), "981234");
    expect(lookups).toHaveLength(0);
    expect(screen.getByRole("button", { name: /find/i })).toBeDisabled();

    await user.type(box(), "5678");
    await waitFor(() => expect(lookups).toHaveLength(1));
  });

  /**
   * Numbers get copied out of a chat or off a caller ID, so they arrive spaced,
   * hyphenated and country-coded. The "+91" is not part of what identifies the
   * customer, so a paste keeps the last ten digits rather than the first.
   */
  it("strips the country code off a pasted number", async () => {
    const user = userEvent.setup();
    renderLookup();

    await user.click(box());
    await user.paste("+91 98123-45678");

    await waitFor(() => expect(lookups).toHaveLength(1));
    expect(lookups[0]).toMatchObject({ phone: "9812345678", shopId: "shop-1" });
  });

  it("ignores punctuation typed into the box", async () => {
    const user = userEvent.setup();
    renderLookup();

    await user.type(box(), "98123-45678");
    await waitFor(() => expect(lookups).toHaveLength(1));
    expect(lookups[0]).toMatchObject({ phone: "9812345678" });
  });

  /**
   * The regression: keeping the last ten digits on every keystroke meant an
   * eleventh sliding the window along, so 0123456789 followed by a stray 9
   * silently became 1234567899 — a different number that looks just as valid,
   * and would have been looked up and then created against.
   */
  it("stops at ten digits instead of sliding the window", async () => {
    const user = userEvent.setup();
    renderLookup();

    await user.type(box(), "0123456789");
    await waitFor(() => expect(lookups).toHaveLength(1));

    await user.type(box(), "9");

    expect(box()).toHaveValue("01234 56789");
    // The eleventh digit changed nothing, so there is nothing new to look up.
    expect(lookups).toHaveLength(1);
    expect(lookups[0]).toMatchObject({ phone: "0123456789" });
  });

  it("hands the found customer over with their addresses", async () => {
    const user = userEvent.setup();
    result = { found: true, customer };
    renderLookup();

    await user.type(box(), "9812345678");
    await user.click(await screen.findByRole("button", { name: /^use$/i }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c-7",
        addresses: [expect.objectContaining({ id: "a1" })],
      }),
    );
  });

  it("flags a record the customer has never confirmed", async () => {
    const user = userEvent.setup();
    result = { found: true, customer };
    renderLookup();

    await user.type(box(), "9812345678");
    expect(await screen.findByText(/unverified/i)).toBeVisible();
  });

  it("says nothing about verification once the customer has signed in", async () => {
    const user = userEvent.setup();
    result = { found: true, customer: { ...customer, isVerified: true } };
    renderLookup();

    await user.type(box(), "9812345678");
    await screen.findByRole("button", { name: /^use$/i });
    expect(screen.queryByText(/unverified/i)).not.toBeInTheDocument();
  });

  /** A miss is the ordinary path into creating them, not an error state. */
  it("offers to add the number that matched nobody", async () => {
    const user = userEvent.setup();
    renderLookup();

    await user.type(box(), "9812345678");
    await user.click(
      await screen.findByRole("button", { name: /add this customer/i }),
    );

    expect(onAddNew).toHaveBeenCalledWith("9812345678");
  });

  it("drops a stale result the moment the number is edited", async () => {
    const user = userEvent.setup();
    result = { found: true, customer };
    renderLookup();

    await user.type(box(), "9812345678");
    expect(await screen.findByRole("button", { name: /^use$/i })).toBeVisible();

    // The card describes the number that was in the box. Leave it up over an
    // edited one and "Use" attaches a customer nobody looked up.
    await user.clear(box());
    expect(screen.queryByRole("button", { name: /^use$/i })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("surfaces a rejected lookup instead of reading as 'no such customer'", async () => {
    const user = userEvent.setup();
    shouldFail = true;
    renderLookup();

    await user.type(box(), "9812345678");

    expect(await screen.findByText(/too many lookups/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /add this customer/i }),
    ).not.toBeInTheDocument();
  });
});

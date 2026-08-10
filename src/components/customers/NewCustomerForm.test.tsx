import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewCustomerForm } from "./NewCustomerForm";

/**
 * The counter's shortest path from "they're not in the system" to an order.
 *
 * Two things here are load-bearing and easy to lose in a refactor: nothing is
 * posted without a number to ring back on, and a number already on file must
 * read as a match rather than as a customer that was just created.
 */

const created: Record<string, unknown>[] = [];
let createResult: Record<string, unknown> = {};

vi.mock("@/features/api/customersApi", () => ({
  useCreateCustomerMutation: () => [
    (body: Record<string, unknown>) => {
      created.push(body);
      return { unwrap: () => Promise.resolve(createResult) };
    },
    { isLoading: false },
  ],
}));

const toasts: { kind: string; message: string }[] = [];
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toasts.push({ kind: "success", message: m }),
    error: (m: string) => toasts.push({ kind: "error", message: m }),
  },
}));

const onCreated = vi.fn();

const renderForm = (props: Partial<React.ComponentProps<typeof NewCustomerForm>> = {}) =>
  render(
    <NewCustomerForm
      shopId="shop-1"
      onCreated={onCreated}
      onCancel={vi.fn()}
      {...props}
    />,
  );

const fillContact = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
  await user.type(screen.getByPlaceholderText(/^phone number$/i), "9812345678");
};

describe("NewCustomerForm", () => {
  beforeEach(() => {
    created.length = 0;
    toasts.length = 0;
    onCreated.mockClear();
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

  it("will not post a customer with no phone number", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    expect(created).toHaveLength(0);
    expect(toasts).toContainEqual({
      kind: "error",
      message: expect.stringMatching(/phone/i),
    });
  });

  it("only asks for an address when the order is a delivery", async () => {
    const user = userEvent.setup();
    const { unmount } = renderForm();
    expect(
      screen.queryByPlaceholderText(/flat \/ house/i),
    ).not.toBeInTheDocument();
    unmount();

    renderForm({ askForAddress: true });
    await fillContact(user);
    await user.type(
      screen.getByPlaceholderText(/flat \/ house/i),
      "12 MG Road, Kothrud",
    );
    await user.type(screen.getByPlaceholderText(/411038/), "411038");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      address: { fullAddress: "12 MG Road, Kothrud", pincode: "411038" },
    });
  });

  it("says a matched number was matched, not added", async () => {
    const user = userEvent.setup();
    createResult = {
      ...createResult,
      name: "Riya S",
      matchedExisting: true,
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
    renderForm();
    await fillContact(user);
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // The name on the order is the one already on file, not what was typed.
    expect(toasts).toContainEqual({
      kind: "success",
      message: expect.stringMatching(/riya s is already on file/i),
    });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-new", matchedExisting: true }),
    );
  });
});

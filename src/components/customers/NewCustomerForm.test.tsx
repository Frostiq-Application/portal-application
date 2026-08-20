import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewCustomerForm } from "./NewCustomerForm";

/**
 * The counter's shortest path from "they're not in the system" to an order.
 *
 * Three things here are load-bearing and easy to lose in a refactor: nothing is
 * posted without a number to ring back on, nothing is posted without the email
 * that later lets the customer find this order from the storefront, and a number
 * already on file must read as a match rather than as a customer that was just
 * created.
 */

const created: Record<string, unknown>[] = [];
let createResult: Record<string, unknown> = {};
/**
 * Rejections the next POST should produce, shifted one per call — so a test can
 * script "409 first, then success", which is the whole shape of the clash flow.
 */
let rejections: unknown[] = [];

vi.mock("@/features/api/customersApi", () => ({
  useCreateCustomerMutation: () => [
    (body: Record<string, unknown>) => {
      created.push(body);
      const rejection = rejections.shift();
      return {
        unwrap: () =>
          rejection ? Promise.reject(rejection) : Promise.resolve(createResult),
      };
    },
    { isLoading: false },
  ],
}));

const OWNER = {
  id: "c-owner",
  name: "Adnan Shaikh",
  phone: "8485028350",
  email: "adnan@example.com",
  isActive: true,
  isVerified: false,
  createdAt: "2026-08-01T00:00:00.000Z",
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

/** The 409 body POST /customers sends when the email is already on file. */
const emailInUse = () => ({
  status: 409,
  data: {
    statusCode: 409,
    error: "EMAIL_IN_USE",
    message: "Adnan Shaikh already uses this email address",
    emailInUseBy: OWNER,
  },
});

const toasts: { kind: string; message: string }[] = [];
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toasts.push({ kind: "success", message: m }),
    error: (m: string) => toasts.push({ kind: "error", message: m }),
  },
}));

const onCreated = vi.fn();
const onUseExisting = vi.fn();

const renderForm = (props: Partial<React.ComponentProps<typeof NewCustomerForm>> = {}) =>
  render(
    <NewCustomerForm
      shopId="shop-1"
      onCreated={onCreated}
      onUseExisting={onUseExisting}
      onCancel={vi.fn()}
      {...props}
    />,
  );

const fillContact = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
  await user.type(screen.getByPlaceholderText(/^phone number$/i), "9812345678");
  await user.type(screen.getByPlaceholderText(/name@example\.com/i), "riya@example.com");
};

describe("NewCustomerForm", () => {
  beforeEach(() => {
    created.length = 0;
    toasts.length = 0;
    rejections = [];
    onCreated.mockClear();
    onUseExisting.mockClear();
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

  /**
   * Without an email there is nothing for a storefront sign-in to match on, so
   * this customer could never reach the order about to be written for them. The
   * field is required on every plan for that reason, not as form hygiene.
   */
  it("will not post a customer with no email address", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
    await user.type(screen.getByPlaceholderText(/^phone number$/i), "9812345678");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    expect(created).toHaveLength(0);
    expect(toasts).toContainEqual({
      kind: "error",
      message: expect.stringMatching(/email/i),
    });
  });

  it("sends the email through on every plan", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillContact(user);
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ email: "riya@example.com" });
  });

  /**
   * Reached from a phone lookup that found nobody: the number is why we are
   * here, so it arrives filled and staff cannot edit it into a different
   * customer than the one they just established does not exist.
   */
  it("shows a looked-up number as fixed, and posts it unchanged", async () => {
    const user = userEvent.setup();
    renderForm({ defaultPhone: "9812345678", lockPhone: true });

    expect(screen.queryByPlaceholderText(/^phone number$/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("9812345678")).toHaveAttribute("readonly");

    await user.type(screen.getByPlaceholderText(/full name/i), "Riya Sharma");
    await user.type(
      screen.getByPlaceholderText(/name@example\.com/i),
      "riya@example.com",
    );
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ phone: "9812345678" });
  });

  /**
   * An email identifies one customer, so a second record on it is refused.
   *
   * The refusal still has to leave staff somewhere to go, and it nearly always
   * means the caller is already on file under another number — so the notice
   * names them and attaching them is one click. Typing a different address is
   * the only other way on, and that has to be discoverable too.
   */
  describe("when the email already belongs to someone", () => {
    const submitWithClash = async (
      user: ReturnType<typeof userEvent.setup>,
    ) => {
      rejections = [emailInUse()];
      renderForm();
      await fillContact(user);
      await user.click(screen.getByRole("button", { name: /add customer/i }));
      return screen.findByText(/this email is already on file/i);
    };

    it("names who holds it instead of failing", async () => {
      const user = userEvent.setup();
      await submitWithClash(user);

      expect(screen.getByText(/adnan shaikh/i)).toBeVisible();
      expect(screen.getByText(/8485028350/)).toBeVisible();
      // A toast would scroll away and leave staff with nothing to act on.
      expect(toasts.filter((t) => t.kind === "error")).toHaveLength(0);
    });

    it("attaches the existing customer, with their addresses", async () => {
      const user = userEvent.setup();
      await submitWithClash(user);

      await user.click(screen.getByRole("button", { name: /^use adnan$/i }));

      expect(onUseExisting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "c-owner",
          addresses: [expect.objectContaining({ id: "a1" })],
        }),
      );
      expect(onCreated).not.toHaveBeenCalled();
      // Only the rejected attempt — choosing the existing customer posts nothing.
      expect(created).toHaveLength(1);
    });

    /**
     * There is no "add anyway". Two records on one address split the order
     * history irreparably, so the form must not offer it — and must not leave
     * a live Add customer button that would just re-post the same rejected
     * details either.
     */
    it("offers no way to add a second record on that address", async () => {
      const user = userEvent.setup();
      await submitWithClash(user);

      expect(
        screen.queryByRole("button", { name: /separate customer/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /add customer/i }),
      ).not.toBeInTheDocument();
      // Only the attempt that was refused.
      expect(created).toHaveLength(1);
    });

    it("points at the one other way forward", async () => {
      const user = userEvent.setup();
      await submitWithClash(user);

      expect(screen.getByText(/enter their own email address/i)).toBeVisible();
    });

    it("clears the refusal when the email is edited, so it can be retried", async () => {
      const user = userEvent.setup();
      await submitWithClash(user);

      // The notice describes the old address; its button would attach a
      // customer this form no longer names.
      await user.type(screen.getByPlaceholderText(/name@example\.com/i), "x");

      expect(
        screen.queryByText(/this email is already on file/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add customer/i })).toBeVisible();
    });

    it("still reports an ordinary failure as an error", async () => {
      const user = userEvent.setup();
      rejections = [{ status: 500, data: { message: "Server exploded" } }];
      renderForm();
      await fillContact(user);
      await user.click(screen.getByRole("button", { name: /add customer/i }));

      await waitFor(() =>
        expect(toasts).toContainEqual({
          kind: "error",
          message: "Server exploded",
        }),
      );
      expect(
        screen.queryByText(/this email is already on file/i),
      ).not.toBeInTheDocument();
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PermissionKey, Role } from "@/types";

/**
 * The order drawer's Customer tab, from the delivery role's seat.
 *
 * A delivery manager cannot hand a box over without a name to ask for and a
 * number to ring, and the order drawer is the only place on the queue that
 * carries either. Two things had to be true for that and neither was:
 *
 *   1. the tab has to open for them at all — it is gated on `customers.view`,
 *      which the delivery role holds and the chef deliberately does not;
 *   2. the order payload has to actually carry the customer. It didn't: the
 *      API returned `customerId` and nothing else, so every field in the block
 *      read "Not provided" no matter who was looking.
 *
 * The block itself is name + phone. Email used to hold the second slot and sat
 * empty on nearly every order, which reads as a broken field rather than an
 * absent one.
 */

/** Server-side base permissions, mirrored from BASE_ROLE_PERMISSIONS. */
const ROLE_PERMISSIONS: Partial<Record<Role, PermissionKey[]>> = {
  delivery_manager: [
    "orders.view",
    "orders.status",
    "delivery.view",
    "customers.view",
  ],
  chef: ["orders.view", "orders.status", "orders.create", "kitchen.view"],
};

const mockState = vi.hoisted(() => ({
  role: "delivery_manager" as string,
  permissions: [] as string[],
  customer: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    role: mockState.role,
    user: { permissions: mockState.permissions },
  }),
}));
vi.mock("@/hooks/useEntitlements", () => ({
  // Lifetime spend and order history are a separate, plan-gated concern; the
  // contact block must stand up without them.
  useEntitlements: () => ({ hasFeature: () => false, isExempt: false }),
}));
vi.mock("@/features/api/customersApi", () => ({
  useGetCustomerQuery: () => ({ data: undefined, isLoading: false }),
}));
// Stands in for the plan-gated history block below the contact rows. It reaches
// for the store and the router; neither has anything to do with the contact.
vi.mock("@/components/gating/UpgradeNote", () => ({
  UpgradeNote: () => <div data-testid="upgrade-note" />,
}));
vi.mock("@/features/api/ordersApi", () => ({
  useGetOrderQuery: () => ({
    data: {
      id: "o1",
      orderNumber: "DIV-0001",
      status: "out_for_delivery",
      deliveryType: "delivery",
      scheduledDate: "2026-08-04",
      scheduledSlotStart: "10:00:00",
      scheduledSlotEnd: "12:00:00",
      subtotal: "1797.00",
      discountAmount: "0.00",
      totalAmount: "1797.00",
      paymentStatus: "paid",
      customerId: "c1",
      customer: mockState.customer,
      deliveryAddress: null,
      customerNote: null,
      cancellationReason: null,
      items: [],
      statusHistory: [],
      createdAt: "2026-08-01T10:00:00.000Z",
    },
    isLoading: false,
  }),
  useUpdateOrderStatusMutation: () => [vi.fn(), { isLoading: false }],
  useCancelOrderMutation: () => [vi.fn(), { isLoading: false }],
  useMarkOrderPaidMutation: () => [vi.fn(), { isLoading: false }],
}));

const { OrderDetailDrawer } = await import("./OrderDetailDrawer");

const asRole = (role: keyof typeof ROLE_PERMISSIONS) => {
  mockState.role = role;
  mockState.permissions = ROLE_PERMISSIONS[role] as string[];
};

const openDrawer = () =>
  render(<OrderDetailDrawer orderId="o1" onOpenChange={vi.fn()} />);

/** Open the Customer tab — Radix keeps the inactive panel out of the DOM. */
const openCustomerTab = async () => {
  await userEvent.click(screen.getByRole("tab", { name: "Customer" }));
};

beforeEach(() => {
  asRole("delivery_manager");
  mockState.customer = {
    id: "c1",
    name: "Priya Sharma",
    phone: "+919876543210",
    email: null,
    isActive: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  };
});

describe("the delivery role's view of the customer", () => {
  it("can open the customer tab", async () => {
    openDrawer();
    expect(screen.getByRole("tab", { name: "Customer" })).toBeVisible();
  });

  it("shows the name to ask for and the number to ring", async () => {
    openDrawer();
    await openCustomerTab();

    // Name twice on purpose: the heading, and a copyable field below it.
    expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThan(0);
    expect(screen.getByText("+919876543210")).toBeVisible();
  });

  it("makes the number dialable and messageable rather than read-only", async () => {
    openDrawer();
    await openCustomerTab();

    expect(screen.getByText("+919876543210")).toHaveAttribute(
      "href",
      "tel:+919876543210",
    );
    expect(
      screen.getByRole("link", { name: /message on whatsapp/i }),
    ).toHaveAttribute("href", "https://wa.me/919876543210");
  });

  it("labels the two fields name and phone, email is gone from the block", async () => {
    openDrawer();
    await openCustomerTab();

    expect(screen.getByText("Name")).toBeVisible();
    expect(screen.getByText("Phone")).toBeVisible();
    expect(screen.queryByText("Email")).toBeNull();
  });

  it("says which field is missing, not that the whole customer is", async () => {
    mockState.customer = {
      id: "c1",
      name: null,
      phone: "+919876543210",
      email: null,
      isActive: true,
      createdAt: "2026-01-12T08:00:00.000Z",
    };
    openDrawer();
    await openCustomerTab();

    expect(screen.getByText("Not provided")).toBeVisible();
    expect(screen.getByText("+919876543210")).toBeVisible();
  });
});

describe("the kitchen role's view of the customer", () => {
  it("gets no customer tab, a chef needs the cake, not the buyer", () => {
    asRole("chef");
    openDrawer();
    expect(screen.queryByRole("tab", { name: "Customer" })).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The branch picker must not even *mount* for a floor role.
 *
 * Rendering it and hiding it would be worse than useless: `ShopSelect` fires
 * `GET /shops` from its own hook, and a chef holds no `branches.view`, so the
 * only thing an invisible picker would achieve is a 403 on every board open.
 */

const mockState = vi.hoisted(() => ({
  permissions: [] as string[],
  /** True once the shops list has been requested. */
  askedForShops: false,
}));

vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (select: (s: unknown) => unknown) =>
    select({
      branch: { selectedBranchId: "shop-1" },
      auth: {
        user: { role: "chef", permissions: mockState.permissions },
        accessToken: "t",
      },
    }),
}));
vi.mock("@/features/api/shopsApi", () => ({
  useListShopsQuery: () => {
    mockState.askedForShops = true;
    return { data: { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } } };
  },
}));

const { FloorBranchFilter } = await import("./FloorBranchFilter");

describe("floor branch filter", () => {
  it("renders nothing and asks for no shops without branches.view", () => {
    mockState.permissions = ["orders.view", "orders.status", "kitchen.view"];
    mockState.askedForShops = false;

    const { container } = render(<FloorBranchFilter />);

    expect(container).toBeEmptyDOMElement();
    expect(mockState.askedForShops).toBe(false);
  });

  it("shows the picker to someone who can see branches", () => {
    mockState.permissions = ["orders.view", "branches.view"];
    mockState.askedForShops = false;

    render(<FloorBranchFilter />);

    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(mockState.askedForShops).toBe(true);
  });
});

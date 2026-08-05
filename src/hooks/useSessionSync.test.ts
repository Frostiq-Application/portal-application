import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { setUser } from "@/features/auth/authSlice";
import { useSessionSync } from "./useSessionSync";

/**
 * A session's permissions are persisted at sign-in and were never replaced, so
 * the day `orders.create` was split out of `orders.manage` every existing
 * session lost the button it gates — until the user happened to sign out and
 * back in. This hook is what stops that.
 */
const ME = {
  id: "u1",
  name: "Riya",
  email: "riya@cakeexpress.in",
  role: "staff" as const,
  accountId: "a1",
  shopIds: ["s1"],
  permissions: ["orders.view", "orders.status", "orders.create"],
};

const mockState = vi.hoisted(() => ({
  dispatch: vi.fn(),
  data: undefined as unknown,
  authenticated: true,
  queryOptions: undefined as unknown,
}));

vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => mockState.dispatch,
  useAppSelector: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: mockState.authenticated }),
}));
vi.mock("@/features/api/authApi", () => ({
  useMeQuery: (_arg: unknown, options: unknown) => {
    mockState.queryOptions = options;
    return { data: mockState.data };
  },
}));

describe("useSessionSync", () => {
  it("writes the server's user back into the session", () => {
    mockState.dispatch = vi.fn();
    mockState.data = ME;
    mockState.authenticated = true;

    renderHook(() => useSessionSync());

    expect(mockState.dispatch).toHaveBeenCalledWith(setUser(ME));
  });

  it("dispatches once per response, not once per render", () => {
    mockState.dispatch = vi.fn();
    mockState.data = ME;

    const { rerender } = renderHook(() => useSessionSync());
    rerender();
    rerender();

    expect(mockState.dispatch).toHaveBeenCalledTimes(1);
  });

  it("asks again on mount rather than trusting the cache", () => {
    mockState.dispatch = vi.fn();
    mockState.data = ME;

    renderHook(() => useSessionSync());

    // The whole point is to catch what changed while they were away.
    expect(mockState.queryOptions).toMatchObject({
      refetchOnMountOrArgChange: true,
    });
  });

  it("stays quiet when there is no session to refresh", () => {
    mockState.dispatch = vi.fn();
    mockState.data = undefined;
    mockState.authenticated = false;

    renderHook(() => useSessionSync());

    expect(mockState.dispatch).not.toHaveBeenCalled();
    expect(mockState.queryOptions).toMatchObject({ skip: true });
  });
});

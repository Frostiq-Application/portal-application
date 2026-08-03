import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { useRowAction } from "./useRowAction";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-1"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/** A promise whose settlement this test controls, standing in for the request. */
function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useRowAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the row busy for as long as the request is out", async () => {
    const { promise, resolve } = deferred();
    const { result } = renderHook(() => useRowAction());

    act(() => {
      void result.current.run(
        { id: "a1", pending: "Suspending shop…", success: "Shop suspended." },
        () => promise,
      );
    });

    await waitFor(() =>
      expect(result.current.busyLabel("a1")).toBe("Suspending shop…"),
    );
    // Only the row acted on — the rest of the grid stays usable.
    expect(result.current.busyLabel("a2")).toBeNull();
    expect(toast.loading).toHaveBeenCalledWith("Suspending shop…");

    await act(async () => {
      resolve();
      await promise;
    });

    expect(result.current.busyLabel("a1")).toBeNull();
    // Same toast id → the loading toast becomes the result in place.
    expect(toast.success).toHaveBeenCalledWith("Shop suspended.", {
      id: "toast-1",
    });
  });

  it("reports failure and releases the row", async () => {
    const { result } = renderHook(() => useRowAction());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(
        { id: "a1", pending: "Approving shop…", success: "Shop approved." },
        () => Promise.reject({ data: { message: "Not allowed" } }),
      );
    });

    expect(ok).toBe(false);
    expect(result.current.busyLabel("a1")).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Not allowed", { id: "toast-1" });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("drops a second click on a row already in flight", async () => {
    const { promise, resolve } = deferred();
    const fn = vi.fn(() => promise);
    const { result } = renderHook(() => useRowAction());
    const opts = {
      id: "a1",
      pending: "Suspending shop…",
      success: "Shop suspended.",
    };

    let second: boolean | undefined;
    act(() => {
      void result.current.run(opts, fn);
    });
    await act(async () => {
      second = await result.current.run(opts, fn);
    });

    expect(second).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
      await promise;
    });
  });
});

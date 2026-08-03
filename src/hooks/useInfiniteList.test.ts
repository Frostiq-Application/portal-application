import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInfiniteList } from "./useInfiniteList";
import type { Paginated } from "@/types";

interface Row {
  id: string;
}

function page(
  n: number,
  ids: string[],
  totalPages: number,
  total = totalPages * 2,
): Paginated<Row> {
  return {
    data: ids.map((id) => ({ id })),
    meta: { page: n, limit: 2, totalPages, total },
  };
}

/** Mirrors real usage: the hook runs before the query, `ingest` right after. */
function setup(key: string, result: Paginated<Row> | undefined) {
  return renderHook(
    ({ k, r }: { k: string; r: Paginated<Row> | undefined }) => {
      const list = useInfiniteList<Row>(k);
      list.ingest(r);
      return list;
    },
    { initialProps: { k: key, r: result } },
  );
}

describe("useInfiniteList", () => {
  it("accumulates pages in order and stops at the last one", () => {
    const p1 = page(1, ["a", "b"], 2);
    const { result, rerender } = setup("", p1);

    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    rerender({ k: "", r: page(2, ["c", "d"], 2) });

    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.current.hasMore).toBe(false);

    // Past the last page there is nothing to ask for.
    act(() => result.current.loadMore());
    expect(result.current.page).toBe(2);
  });

  it("drops a row that shifted across the page boundary", () => {
    const { result, rerender } = setup("", page(1, ["a", "b"], 2));
    act(() => result.current.loadMore());
    rerender({ k: "", r: page(2, ["b", "c"], 2) });

    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("empties the list and returns to page 1 when the filter changes", () => {
    const { result, rerender } = setup("ab", page(1, ["a", "b"], 3));
    act(() => result.current.loadMore());
    rerender({ k: "ab", r: page(2, ["c", "d"], 3) });
    expect(result.current.items).toHaveLength(4);

    // New term, request still in flight → nothing to show for it yet.
    rerender({ k: "abr", r: undefined });
    expect(result.current.items).toEqual([]);
    expect(result.current.page).toBe(1);
  });

  it("refills from a payload it has already seen (cached filter)", () => {
    // The regression: going back to a term RTK Query still has cached hands us
    // the very same response object. An identity check against the last
    // response answers "unchanged" and the just-emptied list stays empty.
    const cached = page(1, ["a", "b"], 1);
    const { result, rerender } = setup("ab", cached);
    expect(result.current.items).toHaveLength(2);

    rerender({ k: "abr", r: undefined });
    expect(result.current.items).toEqual([]);

    rerender({ k: "ab", r: cached });
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.current.total).toBe(2);
  });
});

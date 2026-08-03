import { useCallback, useMemo, useState } from "react";
import type { Paginated } from "@/types";

/**
 * Page accumulator for a filtered, infinitely-scrolled list.
 *
 * Pages are stored by page number rather than appended to a flat array, and
 * they are fed from RTK Query's `currentData` (arg-scoped) instead of `data`
 * (which falls back to the *previous* args' response while a new request is in
 * flight, keeping the same object identity). An identity check against `data`
 * silently loses a page whenever the new filter is already in RTK's cache — the
 * response object is the one we saw before, so "has this changed?" answers no
 * and the accumulator, just emptied by the filter reset, stays empty.
 *
 * Usage — the hook is called *before* the query so `page` is already back at 1
 * on the render the filter changes, and fed straight after:
 *
 *   const list = useInfiniteList<Account>(`${search}|${status}`);
 *   const { currentData, isFetching } = useListAccountsQuery({ page: list.page });
 *   list.ingest(currentData);
 */
interface State<T> {
  key: string;
  page: number;
  pages: Record<number, T[]>;
  totalPages: number;
  total: number;
}

export interface InfiniteList<T> {
  /** The page to request. Back at 1 on the render the filter key changes. */
  page: number;
  /** Every loaded page, in order, de-duplicated by id. */
  items: T[];
  hasMore: boolean;
  /** Server-side count for the current filter — all matches, not just loaded. */
  total: number;
  /** Feed the page payload. Pass `currentData`, never `data`. */
  ingest: (result: Paginated<T> | undefined) => void;
  loadMore: () => void;
}

/** Stable identity so `items` doesn't re-memo on every render after a reset. */
const NO_PAGES: Record<number, never[]> = {};

function fresh<T>(key: string): State<T> {
  return { key, page: 1, pages: NO_PAGES, totalPages: 1, total: 0 };
}

export function useInfiniteList<T extends { id: string }>(
  filterKey: string,
): InfiniteList<T> {
  const [state, setState] = useState<State<T>>(() => fresh<T>(filterKey));

  // Filter changed → drop every accumulated page and go back to page 1. Done
  // during render, not in an effect, so the previous filter's rows are never
  // painted under the new term.
  const stale = state.key !== filterKey;
  if (stale) setState(fresh<T>(filterKey));

  // React finishes this pass before re-running with the reset state, so read
  // through it here — otherwise the query below fires once for a page that no
  // longer exists under the new filter (a wasted, often empty, request).
  const page = stale ? 1 : state.page;
  const pages = stale ? NO_PAGES : state.pages;
  const totalPages = stale ? 1 : state.totalPages;
  const total = stale ? 0 : state.total;

  const ingest = (result: Paginated<T> | undefined) => {
    if (!result) return;
    const incoming = result.meta.page;
    if (!stale && pages[incoming] === result.data) return; // already stored
    setState((prev) => {
      const base = prev.key === filterKey ? prev : fresh<T>(filterKey);
      if (base.pages[incoming] === result.data) return prev;
      return {
        ...base,
        pages: { ...base.pages, [incoming]: result.data },
        totalPages: result.meta.totalPages,
        total: result.meta.total,
      };
    });
  };

  const items = useMemo(() => {
    const out: T[] = [];
    const seen = new Set<string>();
    for (let p = 1; p <= page; p++) {
      for (const item of pages[p] ?? []) {
        // A row can shift across the page boundary between requests; keep the
        // first copy so nothing renders twice with the same key.
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [pages, page]);

  const loadMore = useCallback(() => {
    setState((prev) =>
      prev.page < prev.totalPages ? { ...prev, page: prev.page + 1 } : prev,
    );
  }, []);

  return { page, items, hasMore: page < totalPages, total, ingest, loadMore };
}

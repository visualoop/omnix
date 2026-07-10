/**
 * useListData — the single hook every paginated list page uses.
 *
 * Contract:
 *   // Pass a STABLE fetcher: a module-level page fn directly, or a
 *   // useCallback when it captures filter state. An inline arrow that is
 *   // recreated every render will refetch in a loop (the effect depends on
 *   // the fetcher identity so filter changes can trigger a refetch).
 *   const list = useListData(pageSuppliers, { pageSize: 50 });
 *   // or, with a captured filter:
 *   const fetcher = useCallback((q) => pageSales({ ...q, status }), [status]);
 *   const list = useListData(fetcher, { pageSize: 50 });
 *
 *   list.rows       - current page of records
 *   list.loading    - true while a fetch is in flight
 *   list.error      - error message string or null
 *   list.total      - row count for the current filter
 *   list.page       - current 1-based page number
 *   list.setPage    - jump to a page
 *   list.pageCount  - Math.ceil(total / pageSize)
 *   list.search     - current search string
 *   list.setSearch  - update the search (300ms debounce before refetch)
 *   list.refresh    - force a re-fetch (after mutation)
 *
 * Design:
 *   - Debounces search so we don't fire one query per keystroke.
 *   - Cancels stale requests via a per-request counter so late arrivals
 *     from an earlier keystroke never overwrite fresher results.
 *   - Keeps the previous page visible while loading the next (no flicker).
 *   - Resets to page 1 whenever search changes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListPage, ListQuery } from "@/lib/list-types";

interface Options {
  pageSize?: number;
  initialSearch?: string;
  initialPage?: number;
  /** Milliseconds — debounce on setSearch. Default 300. */
  debounceMs?: number;
}

export interface UseListDataResult<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasMore: boolean;
  search: string;
  setPage: (n: number) => void;
  setSearch: (s: string) => void;
  refresh: () => void;
}

export function useListData<T>(
  fetcher: (q: ListQuery) => Promise<ListPage<T>>,
  opts: Options = {},
): UseListDataResult<T> {
  const pageSize = opts.pageSize ?? 50;
  const debounceMs = opts.debounceMs ?? 300;

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageInternal] = useState(opts.initialPage ?? 1);
  const [search, setSearchInternal] = useState(opts.initialSearch ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [refreshToken, setRefreshToken] = useState(0);

  // Track in-flight requests so a stale response never overwrites a fresh one.
  const reqSeqRef = useRef(0);

  // Debounce search → debouncedSearch
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(t);
  }, [search, debounceMs]);

  // Reset to page 1 when the search term changes
  useEffect(() => {
    setPageInternal(1);
  }, [debouncedSearch]);

  // Fetch on (debouncedSearch, page, refreshToken)
  useEffect(() => {
    const mySeq = ++reqSeqRef.current;
    setLoading(true);
    setError(null);
    fetcher({ search: debouncedSearch, page, pageSize })
      .then((result) => {
        if (mySeq !== reqSeqRef.current) return; // stale response
        setRows(result.rows);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setLoading(false);
      })
      .catch((e) => {
        if (mySeq !== reqSeqRef.current) return;
        setError(String(e));
        setLoading(false);
      });
  }, [fetcher, debouncedSearch, page, pageSize, refreshToken]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const setPage = useCallback(
    (n: number) => {
      const clamped = Math.max(1, Math.min(pageCount, n));
      setPageInternal(clamped);
    },
    [pageCount],
  );

  const setSearch = useCallback((s: string) => {
    setSearchInternal(s);
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((x) => x + 1);
  }, []);

  return {
    rows,
    loading,
    error,
    total,
    page,
    pageSize,
    pageCount,
    hasMore,
    search,
    setPage,
    setSearch,
    refresh,
  };
}

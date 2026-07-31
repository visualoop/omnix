import { useEffect, useMemo, useState } from "react";
import type { UseListDataResult } from "@/hooks/use-list-data";

export interface ClientPaginationResult<T> {
  pageRows: T[];
  pagination: UseListDataResult<T>;
}

/**
 * Paginates an already-bounded typed service result. Search/filtering remains
 * with the owning page; resetKey resets the page whenever those controls move.
 */
export function useClientPagination<T>(
  rows: T[],
  pageSize = 12,
  resetKey = "",
): ClientPaginationResult<T> {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, rows],
  );

  return {
    pageRows,
    pagination: {
      rows: pageRows,
      loading: false,
      error: null,
      total: rows.length,
      page,
      pageSize,
      pageCount,
      hasMore: page < pageCount,
      search: resetKey,
      setPage,
      setSearch: () => {},
      refresh: () => {},
    },
  };
}

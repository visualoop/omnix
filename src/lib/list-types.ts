/**
 * Shared list query types used by every paginated + searchable list service
 * and the useListData hook that consumes them.
 *
 * Contract:
 *   - Services accept a ListQuery (plus their own extra filter fields).
 *   - Services return a ListPage<T> with `rows`, `total`, and `hasMore`.
 *   - `total` should be the row-count for the CURRENT filter (not the
 *     grand total ignoring the search). This lets the UI show
 *     "Page 3 of 47" against the filtered set.
 */

export interface ListQuery {
  /** Free-text search — services SQL it against the useful columns via LIKE. */
  search?: string;
  /** 1-based page number. Missing → 1. */
  page?: number;
  /** Rows per page. Missing → 50. */
  pageSize?: number;
}

export interface ListPage<T> {
  rows: T[];
  /** Rows matching the current filter (across all pages). */
  total: number;
  /** True when total > page * pageSize. Convenience for load-more UIs. */
  hasMore: boolean;
}

/**
 * Small helper: given { page, pageSize } compute the LIMIT + OFFSET pair
 * with sensible defaults. Keeps every service one line lighter.
 */
export function pageBounds(q: ListQuery): { limit: number; offset: number } {
  const pageSize = Math.max(1, Math.min(500, q.pageSize ?? 50));
  const page = Math.max(1, q.page ?? 1);
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

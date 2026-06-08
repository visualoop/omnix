import 'server-only'

/**
 * Defensive Payload query wrapper.
 *
 * Wrap any payload.find() / findByID() call so a single failure (missing
 * row, schema drift, FK pointer to a deleted record, transient DB issue)
 * doesn't 500 the whole server-rendered page. Returns the supplied
 * fallback on error and logs the underlying error to the server console.
 *
 * Use this instead of bare payload.find() in every dashboard SSR page.
 */
export async function safePayloadFind<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[dashboard] payload query failed (${context}):`, err)
    return fallback
  }
}

/**
 * Standard empty paginated result. Cast at call site so the consumer's
 * docs[] type is preserved.
 *
 * Usage:
 *   const res = await safePayloadFind(
 *     () => payload.find({ collection: 'licenses', ... }),
 *     emptyPage<License>(),
 *     'licenses-list'
 *   )
 */
export function emptyPage<T = unknown>(): {
  docs: T[]
  totalDocs: number
  hasNextPage: boolean
  hasPrevPage: boolean
  limit: number
  page?: number
  pagingCounter: number
  totalPages: number
  nextPage?: number | null
  prevPage?: number | null
} {
  return {
    docs: [] as T[],
    totalDocs: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 0,
    page: 1,
    pagingCounter: 0,
    totalPages: 0,
    nextPage: null,
    prevPage: null,
  }
}

/** Backwards-compat alias. Prefer `emptyPage<T>()` for proper typing. */
export const EMPTY_PAGE = emptyPage<unknown>()

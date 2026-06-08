import 'server-only'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Defensive customer-auth resolver for dashboard SSR pages.
 *
 * payload.auth() throws on stale sessions (cookie JWT for a deleted
 * customer). This helper wraps that call, returns the customer on
 * success, and redirects to /login on any failure (throw OR null user
 * OR wrong collection). Use it as the first line of every dashboard
 * page so a single auth failure doesn't trip the route-group error
 * boundary.
 */
export async function getDashboardCustomer(reqHeaders: Headers): Promise<{
  id: string | number
  email: string
  fullName?: string
  businessName?: string
}> {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let user: unknown = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = result.user
  } catch (err) {
    console.error('[dashboard] payload.auth() threw:', err)
    user = null
  }

  const u = user as
    | null
    | {
        id?: string | number
        email?: string
        collection?: string
        fullName?: string
        businessName?: string
      }

  if (!u || u.collection !== 'customers' || u.id == null || !u.email) {
    redirect('/login?next=/dashboard')
  }

  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    businessName: u.businessName,
  }
}

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

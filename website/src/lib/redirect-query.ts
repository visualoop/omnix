/**
 * Safe query preservation for permanent (308) legacy-route redirects.
 *
 * Legacy marketing routes (/dawa, /pro, /ai, /payroll-pack, /modules/[slug])
 * consolidate onto canonical product/catalogue routes. When we forward a
 * visitor we keep only the *safe* attribution/UX parameters so campaign
 * tracking and demo pre-selection survive the hop.
 *
 * Allowlist over denylist. A denylist has to anticipate every dangerous key;
 * an allowlist forwards only the handful of parameters a redirect target has a
 * legitimate reason to receive and silently drops everything else — including
 * anything that looks like an email, phone, name, token, session, or open
 * redirect. This preserves the Task 28 UTM + demo behaviour (utm_* keep
 * campaigns; `product` and `type` keep the demo pre-selection) while
 * guaranteeing an unknown parameter can never ride along onto a public URL.
 *
 * Values are bounded: each value is length-capped, arrays are count-capped, and
 * over-long or empty values are dropped. The keys themselves are a fixed, short
 * set, so a key can never be abused as a smuggling channel.
 */

/** The only parameters allowed to survive a redirect. */
const SAFE_QUERY_KEYS = new Set<string>([
  // Attribution (Google Analytics / campaign conventions).
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  // Lightweight referral + UX pre-selection.
  'ref',
  'product',
  'type',
])

/** Max characters kept per value. Longer values are dropped, not truncated. */
const MAX_VALUE_LENGTH = 200
/** Max number of values kept for a repeated key. */
const MAX_ARRAY_VALUES = 5

type SearchValue = string | string[] | undefined
export type RedirectSearchParams = Record<string, SearchValue>

function isSafeValue(value: string): boolean {
  return value.length > 0 && value.length <= MAX_VALUE_LENGTH
}

/**
 * Build a `?a=b&c=d` suffix (including the leading `?`) from the incoming
 * search params, keeping only allowlisted keys with bounded values. Returns an
 * empty string when nothing safe remains, so callers can append it
 * unconditionally.
 */
export function preserveSafeQuery(searchParams: RedirectSearchParams | undefined): string {
  if (!searchParams) return ''
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (!SAFE_QUERY_KEYS.has(key)) continue
    if (Array.isArray(value)) {
      let appended = 0
      for (const item of value) {
        if (appended >= MAX_ARRAY_VALUES) break
        if (typeof item === 'string' && isSafeValue(item)) {
          query.append(key, item)
          appended += 1
        }
      }
    } else if (typeof value === 'string' && isSafeValue(value)) {
      query.set(key, value)
    }
  }

  const suffix = query.toString()
  return suffix ? `?${suffix}` : ''
}

/**
 * URLSearchParams adapter for request-layer redirects. Repeated values retain
 * their order and are still bounded by preserveSafeQuery's per-key cap.
 */
export function preserveSafeUrlSearchParams(searchParams: URLSearchParams): string {
  const values: RedirectSearchParams = {}

  for (const key of SAFE_QUERY_KEYS) {
    const entries = searchParams.getAll(key)
    if (entries.length === 1) values[key] = entries[0]
    if (entries.length > 1) values[key] = entries
  }

  return preserveSafeQuery(values)
}

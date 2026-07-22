/**
 * Post-authentication redirect safety.
 *
 * Account routes accept a `next` / `callbackURL` destination so a user
 * who was bounced to /login lands back where they meant to go. That value
 * is attacker-controllable, so it is validated to be an *internal* path on
 * this origin before it is ever used.
 *
 * Rejected (fall back to the supplied local path):
 *   - empty / non-string values
 *   - anything that is not a root-relative path ("/foo")
 *   - protocol-relative ("//evil.com") and backslash-authority ("/\evil.com")
 *   - percent-encoded slash/backslash bypasses ("/%2f%2fevil.com", "/%5c…")
 *   - absolute URLs, javascript:, data:, mailto: (never start with "/")
 *   - values containing control characters or whitespace
 *   - privileged areas a normal buyer account cannot navigate to
 *     (/admin, /api, /_next) — the staff console and internal handlers
 *     are never valid post-sign-in destinations for a customer.
 */

const LOCAL_ORIGIN = 'https://omnix.local'

/**
 * Areas a buyer account must never be redirected into. The admin console
 * is staff-only (role-gated separately) and /api / /_next are not pages.
 */
const BLOCKED_PREFIXES = ['/admin', '/api', '/_next'] as const

/** Control characters and any whitespace that could smuggle a second URL. */
const CONTROL_OR_SPACE = /[\u0000-\u001F\u007F\s]/

function isBlockedPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return BLOCKED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))
}

/**
 * Returns true when `value` is a safe internal destination.
 * Pure predicate — no fallback substitution.
 */
export function isSafeNextPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false

  // Must be a root-relative path.
  if (!value.startsWith('/')) return false

  // Protocol-relative ("//host") and backslash-authority ("/\host").
  if (value.startsWith('//') || value.startsWith('/\\')) return false

  // Percent-encoded slash / backslash directly after the leading slash —
  // "/%2f%2fhost" and "/%5chost" both resolve to an authority in browsers.
  const lower = value.toLowerCase()
  if (lower.startsWith('/%2f') || lower.startsWith('/%5c') || lower.startsWith('/%09')) {
    return false
  }

  // No control characters or whitespace anywhere.
  if (CONTROL_OR_SPACE.test(value)) return false

  try {
    const resolved = new URL(value, LOCAL_ORIGIN)
    // Anything that resolves off-origin is external.
    if (resolved.origin !== LOCAL_ORIGIN) return false
    // Reject privileged / non-page destinations.
    if (isBlockedPath(resolved.pathname)) return false
    return true
  } catch {
    return false
  }
}

/**
 * Accept only a safe internal path; otherwise return `fallback`.
 * `fallback` defaults to the customer dashboard and is trusted to be a
 * literal internal path chosen by the caller.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!isSafeNextPath(value)) return fallback

  const resolved = new URL(value, LOCAL_ORIGIN)
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}

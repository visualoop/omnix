/**
 * Access control helpers — reused across collections.
 *
 * Three-tier model (Plan 02 §1):
 *   - User (collection 'users'): role = 'owner' | 'support'    → /admin
 *   - Customer (collection 'customers'): authenticated dashboard user
 *   - System: requests bearing valid X-System-Token header (CI, machine API)
 */

import type { Access, AccessArgs } from 'payload'

type Role = 'owner' | 'support' | undefined

const getRole = (req: AccessArgs['req']): Role => {
  const user = req.user
  if (!user) return undefined
  if (user.collection !== 'users') return undefined
  return (user as unknown as { role?: Role }).role
}

export const ownerOnly: Access = ({ req }) => getRole(req) === 'owner'

export const ownerOrSupport: Access = ({ req }) => {
  const role = getRole(req)
  return role === 'owner' || role === 'support'
}

export const allowSystem = (req: AccessArgs['req']): boolean => {
  const headerToken = req.headers?.get?.('x-system-token') ?? null
  const expected = process.env.PAYLOAD_SYSTEM_TOKEN ?? ''
  return Boolean(headerToken && expected && headerToken === expected)
}

export const ownerOrSystem: Access = ({ req }) =>
  getRole(req) === 'owner' || allowSystem(req)

/**
 * Anyone authenticated (any collection) — useful for endpoints that customers,
 * staff, or owner all need. Combine with row-level filters to scope data.
 */
export const anyAuthenticated: Access = ({ req }) => Boolean(req.user)

/** Public read; authoring requires owner. */
export const publishedReadOwnerWrite: Access = () => true

/**
 * Customer can only see records linked to their own customer ID.
 * Used on Licenses, Payments, Machines, etc., via where-clause.
 */
export const customerOwnedOrStaff: Access = ({ req }) => {
  if (getRole(req) === 'owner' || getRole(req) === 'support') return true
  if (req.user?.collection === 'customers') {
    return {
      customer: { equals: req.user.id },
    }
  }
  return false
}

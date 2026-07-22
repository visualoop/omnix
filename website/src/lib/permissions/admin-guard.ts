import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Server-side capability gate for the operator console.
 *
 * This is the security boundary of record for every `/admin/*` page tree.
 * The admin navigation model (src/components/admin/admin-navigation.ts) hides
 * desks a role can't work, but hiding a link is a *usability* affordance only —
 * it never protects a route. Each section enforces its real role requirement
 * here, independently of the shell, and every mutating/read API keeps its own
 * gate in addition to this one (defence in depth).
 *
 * The capability map mirrors the platform statements in
 * src/lib/permissions/platform.ts:
 *   - platform_admin : every desk
 *   - support_agent  : customer records, the support queue, the audit trail
 *   - sales_rep      : customer records and payment records
 */

export type StaffRole = 'platform_admin' | 'support_agent' | 'sales_rep'

export const STAFF_ROLES: readonly StaffRole[] = ['platform_admin', 'support_agent', 'sales_rep']

/**
 * Desk → the staff roles allowed to operate it. Keep in lock-step with the
 * `roles` arrays in admin-navigation.ts and the capability statements in
 * permissions/platform.ts. A desk that only a platform administrator may run
 * lists exactly `['platform_admin']`.
 */
export const DESK_ACCESS = {
  customers: ['platform_admin', 'support_agent', 'sales_rep'],
  // Creating a customer account (and optionally issuing a trial licence) is an
  // administrative provisioning action — matches the platform_admin-only
  // /api/admin/customers handler.
  customerCreate: ['platform_admin'],
  organizations: ['platform_admin', 'support_agent', 'sales_rep'],
  licenses: ['platform_admin'],
  machines: ['platform_admin'],
  releases: ['platform_admin'],
  payments: ['platform_admin', 'sales_rep'],
  tickets: ['platform_admin', 'support_agent'],
  audit: ['platform_admin', 'support_agent'],
  staff: ['platform_admin'],
  settings: ['platform_admin'],
  trust: ['platform_admin'],
} as const satisfies Record<string, readonly StaffRole[]>

export type Desk = keyof typeof DESK_ACCESS

export interface StaffContext {
  userId: string
  email: string
  role: StaffRole
}

/** Pure predicate — safe to import from tests and client-free modules. */
export function isDeskAllowed(role: string, allowed: readonly StaffRole[]): boolean {
  return STAFF_ROLES.includes(role as StaffRole) && allowed.includes(role as StaffRole)
}

/**
 * Resolve the current staff session and enforce `allowed` for this desk.
 *
 *   - No session            → redirect to /login preserving the intended path.
 *   - Non-staff / wrong role → redirect to /admin (the overview every staff
 *     role can reach). We deliberately do NOT surface whether the target
 *     resource exists — unauthorized visitors never learn anything about it.
 *
 * Returns the minimal, non-sensitive staff context for the caller to audit or
 * scope reads with. Never returns secrets or the raw session object.
 */
export async function requireStaffAccess(
  allowed: readonly StaffRole[],
  loginNext = '/admin',
): Promise<StaffContext> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect(`/login?next=${encodeURIComponent(loginNext)}`)

  const role = ((session.user as { role?: string }).role ?? 'user') as StaffRole
  if (!isDeskAllowed(role, allowed)) redirect('/admin')

  return { userId: session.user.id, email: session.user.email, role }
}

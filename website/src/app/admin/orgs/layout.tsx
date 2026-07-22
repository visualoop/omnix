import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Organisations desk (list + detail).
 * Open to all staff (customer read grant), enforced server-side here and
 * re-derived from the real role rather than trusting the shell.
 */
export default async function OrgsSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.organizations, '/admin/orgs')
  return <>{children}</>
}

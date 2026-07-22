import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for creating customer accounts (/admin/customers/new).
 * platform_admin only — this provisions a login and can issue a trial licence,
 * matching the platform_admin-only /api/admin/customers handler it posts to.
 */
export default async function CustomersSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.customerCreate, '/admin/customers/new')
  return <>{children}</>
}

import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Staff access desk (list + detail).
 * platform_admin only — inviting staff, changing roles, promotions, and bans
 * are the most privileged actions on the platform.
 */
export default async function StaffSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.staff, '/admin/team')
  return <>{children}</>
}

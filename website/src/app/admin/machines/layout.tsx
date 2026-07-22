import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Machines desk (list + detail).
 * platform_admin only — install health and update policy are administrative.
 */
export default async function MachinesSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.machines, '/admin/machines')
  return <>{children}</>
}

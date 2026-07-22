import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Users desk (list + detail).
 * Every staff role has a customer/user read grant, so this is open to all
 * staff — but it is still enforced server-side here (not merely by the shell)
 * and re-derived from the real role, so a non-staff session can never reach it
 * even if the root layout gate were ever relaxed.
 */
export default async function UsersSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.customers, '/admin/users')
  return <>{children}</>
}

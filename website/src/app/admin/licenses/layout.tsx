import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Licences desk (list + detail).
 * platform_admin only. Independent of the nav — a support/sales session that
 * types the URL directly is redirected to the overview without learning
 * whether any licence exists.
 */
export default async function LicensesSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.licenses, '/admin/licenses')
  return <>{children}</>
}

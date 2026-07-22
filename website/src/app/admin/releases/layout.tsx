import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Releases desk. platform_admin only —
 * publishing desktop update manifests and signatures is administrative.
 */
export default async function ReleasesSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.releases, '/admin/releases')
  return <>{children}</>
}

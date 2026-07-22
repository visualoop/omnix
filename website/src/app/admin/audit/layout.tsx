import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Audit desk (list + detail).
 * platform_admin and support_agent only — sales reps have no audit grant.
 * The audit history itself is immutable; this desk is read-only.
 */
export default async function AuditSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.audit, '/admin/audit')
  return <>{children}</>
}

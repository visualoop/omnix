import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Support tickets desk (list + detail).
 * platform_admin and support_agent only — sales reps never reach the queue.
 */
export default async function TicketsSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.tickets, '/admin/tickets')
  return <>{children}</>
}

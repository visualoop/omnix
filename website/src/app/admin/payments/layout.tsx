import type { ReactNode } from 'react'
import { requireStaffAccess, DESK_ACCESS } from '@/lib/permissions/admin-guard'

/**
 * Server-side capability gate for the Payments desk (list + detail).
 * platform_admin and sales_rep only — support agents never reach payment
 * records or revenue figures, mirroring the platform capability statements.
 */
export default async function PaymentsSectionLayout({ children }: { children: ReactNode }) {
  await requireStaffAccess(DESK_ACCESS.payments, '/admin/payments')
  return <>{children}</>
}

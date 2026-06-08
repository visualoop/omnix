import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

/**
 * Dashboard route-group layout.
 * Verifies customer auth server-side, redirects to /login if missing or
 * stale. Stale = JWT references a customer that no longer exists (account
 * was deleted by support, or by the customer themselves) — payload.auth()
 * throws in that case, so we catch and redirect to login instead of 500.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let user: { collection?: string; fullName?: string; email?: string } | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = result.user as typeof user
  } catch {
    user = null
  }

  if (!user || user.collection !== 'customers' || !user.email) {
    redirect('/login?next=/dashboard')
  }

  return (
    <DashboardShell
      customerName={user.fullName ?? user.email.split('@')[0] ?? 'You'}
      customerEmail={user.email}
    >
      {children}
    </DashboardShell>
  )
}

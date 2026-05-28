import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

/**
 * Dashboard route-group layout.
 * Verifies customer auth server-side, redirects to /login if missing,
 * then renders the persistent shell with sidebar + topbar.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })

  if (!user || user.collection !== 'customers') {
    redirect('/login?next=/dashboard')
  }

  const customer = user as unknown as {
    fullName?: string
    email: string
  }

  return (
    <DashboardShell
      customerName={customer.fullName ?? customer.email.split('@')[0] ?? 'You'}
      customerEmail={customer.email}
    >
      {children}
    </DashboardShell>
  )
}

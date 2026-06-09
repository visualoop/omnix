import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { RootShell } from '@/components/layout/root-shell'

interface CustomerUser {
  collection?: string
  fullName?: string
  email?: string
}

/**
 * Dashboard route-group layout.
 *
 * Verifies customer auth server-side. Stale sessions (deleted customer
 * rows) cause payload.auth() to throw — caught and redirected to /login.
 *
 * Uses the shared <RootShell> for html/body/fonts/globals.css. Adding new
 * dashboard subroutes requires no extra wiring — just pages under
 * /app/(dashboard)/dashboard/ inherit this layout automatically.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let user: CustomerUser | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = result.user as CustomerUser | null
  } catch {
    user = null
  }

  if (!user || user.collection !== 'customers' || !user.email) {
    redirect('/login?next=/dashboard')
  }

  const email = user.email as string
  const customerName = user.fullName ?? email.split('@')[0] ?? 'You'

  return (
    <RootShell>
      <DashboardShell customerName={customerName} customerEmail={email}>
        {children}
      </DashboardShell>
    </RootShell>
  )
}

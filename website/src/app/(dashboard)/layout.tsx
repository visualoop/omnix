import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { RootShell } from '@/components/layout/root-shell'
import { getSiteSettings } from '@/lib/site-settings'

/**
 * Dashboard route-group layout.
 *
 * Auth gate via Better Auth. No session → redirect to /login with the
 * intended path so post-sign-in lands them where they meant to go.
 *
 * Shared <RootShell> for html/body/fonts/globals.css. Adding new dashboard
 * subroutes requires no extra wiring.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard')

  const email = session.user.email
  const customerName = session.user.name || email.split('@')[0] || 'You'

  const settings = await getSiteSettings()

  return (
    <RootShell>
      <DashboardShell
        customerName={customerName}
        customerEmail={email}
        whatsappUrl={settings.whatsappUrl}
        supportEmail={settings.supportEmail}
      >
        {children}
      </DashboardShell>
    </RootShell>
  )
}

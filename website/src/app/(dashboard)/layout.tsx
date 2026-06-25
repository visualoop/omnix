import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getSiteSettings } from '@/lib/site-settings'

/**
 * Dashboard route-group layout.
 *
 * Auth gate via Better Auth. No session → redirect to /login with the
 * intended path so post-sign-in lands them where they meant to go.
 *
 * Root layout (app/layout.tsx) provides html/body/fonts/globals.css.
 * Adding new dashboard subroutes requires no extra wiring.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) {
    // Preserve the full URL (path + query) so /login can land them
    // back here after sign-in. Middleware sets x-omnix-url on every
    // dashboard request; falls back to /dashboard if the header is
    // missing (e.g. local dev without middleware).
    const fullUrl = reqHeaders.get('x-omnix-url') ?? '/dashboard'
    redirect(`/login?next=${encodeURIComponent(fullUrl)}`)
  }

  const email = session.user.email
  const customerName = session.user.name || email.split('@')[0] || 'You'

  const settings = await getSiteSettings()

  return (
    <DashboardShell
      customerName={customerName}
      customerEmail={email}
      whatsappUrl={settings.whatsappUrl}
      supportEmail={settings.supportEmail}
    >
      {children}
    </DashboardShell>
  )
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Fraunces, Geist, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

import '../(frontend)/globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
})

interface CustomerUser {
  collection?: string
  fullName?: string
  email?: string
}

/**
 * Dashboard route-group layout.
 *
 * Provides its own html/body + globals.css since route groups need a
 * complete layout if there's no shared root (the (frontend) group has
 * its own, the (payload) group uses Payload's RootLayout — we mirror
 * the (auth) pattern here).
 *
 * Verifies customer auth server-side. Stale sessions (deleted customer
 * rows) cause payload.auth() to throw — caught and redirected to /login.
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geist.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-fg)] antialiased">
        <DashboardShell customerName={customerName} customerEmail={email}>
          {children}
        </DashboardShell>
      </body>
    </html>
  )
}

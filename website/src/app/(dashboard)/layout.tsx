import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, resellers, member, organization } from '@/db'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { DashboardCapabilities } from '@/components/dashboard/dashboard-navigation'
import { getSiteSettings } from '@/lib/site-settings'

/**
 * Dashboard route-group layout.
 *
 * Auth gate via Better Auth. No session → redirect to /login with the
 * intended path so post-sign-in lands them where they meant to go.
 *
 * Navigation visibility is derived here, on the server, from real database
 * facts (a `resellers` row, an organisation membership) and handed to the
 * shell as explicit props. The shell never infers authorization from the
 * URL, cookies, or browser storage — and every gated page keeps its own
 * server-side gate regardless of what the nav shows.
 *
 * Root layout (app/layout.tsx) provides html/body/fonts/globals.css.
 * Adding new dashboard subroutes requires no extra wiring.
 */
export const metadata: Metadata = {
  title: 'Account',
  // Customer account pages are unprefixed application routes and must never
  // be indexed. robots.ts also disallows /dashboard; this is defence in depth.
  robots: { index: false, follow: false },
}

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

  const userId = session.user.id
  const email = session.user.email
  const customerName = session.user.name || email.split('@')[0] || 'You'

  // Real capability + organisation resolution. Both are wrapped so a cold or
  // sparse table degrades to "no extra capability" instead of breaking the
  // whole dashboard.
  const [isReseller, organizationName, settings] = await Promise.all([
    resolveIsReseller(userId),
    resolveOrganizationName(userId),
    getSiteSettings(),
  ])

  const capabilities: DashboardCapabilities = { isReseller }

  return (
    <DashboardShell
      customerName={customerName}
      customerEmail={email}
      organizationName={organizationName}
      capabilities={capabilities}
      whatsappUrl={settings.whatsappUrl}
      supportEmail={settings.supportEmail}
    >
      {children}
    </DashboardShell>
  )
}

/** True when the signed-in user has a reseller account. Mirrors the gate the
 *  /dashboard/reseller page enforces server-side. */
async function resolveIsReseller(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: resellers.id })
      .from(resellers)
      .where(eq(resellers.userId, userId))
      .limit(1)
    return rows.length > 0
  } catch {
    return false
  }
}

/** The user's primary organisation name for the account-context strip.
 *  Prefers an org they own, else the first membership. Null for solo accounts. */
async function resolveOrganizationName(userId: string): Promise<string | null> {
  try {
    const memberships = await db
      .select({ name: organization.name, role: member.role })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId))
    if (memberships.length === 0) return null
    const primary = memberships.find((m) => m.role === 'owner') ?? memberships[0]
    return primary.name ?? null
  } catch {
    return null
  }
}

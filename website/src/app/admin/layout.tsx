import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { count, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, machines } from '@/db'
import { AdminShell } from '@/components/admin/admin-shell'
import { PermissionState } from '@/components/ui/state-view'
import { ensureMigrated } from '@/lib/auto-migrate'

/**
 * Operator console layout.
 *
 * The mobile drawer + sidebar chrome lives in <AdminShell> (client
 * component); this layout owns server-side auth, the staff role gate, the
 * live-install counters, and impersonation detection.
 */

/**
 * The operator console is an unprefixed private surface and must never be
 * indexed. robots.ts also disallows /admin — this is defence in depth, and it
 * cascades to every /admin/* page unless a child overrides `robots`.
 */
export const metadata: Metadata = {
  title: 'Operator console',
  robots: { index: false, follow: false },
}

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) {
    const fullUrl = reqHeaders.get('x-omnix-url') ?? '/admin'
    redirect(`/login?next=${encodeURIComponent(fullUrl)}`)
  }

  // Self-migrate on first admin access after a deploy — idempotent +
  // memoised per process, so this only does work once on a cold start
  // (creates team_members etc. without anyone hitting /api/migrate-db).
  void ensureMigrated()

  const role = (session.user as { role?: string }).role ?? 'user'
  if (!STAFF_ROLES.includes(role)) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)]">
        <PermissionState
          code="403"
          title="Not for you."
          description="The operator console is staff-only. Your account doesn’t have staff access."
          homeHref="/dashboard"
          homeLabel="Back to your dashboard"
        />
      </main>
    )
  }

  // Live machines = seen in the last 5 minutes (constant-time sidebar query).
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const liveResult = await db
    .select({ n: count() })
    .from(machines)
    .where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`)
    .catch(() => [{ n: 0 }])
  const totalResult = await db.select({ n: count() }).from(machines).catch(() => [{ n: 0 }])
  const live = liveResult[0]?.n ?? 0
  const total = totalResult[0]?.n ?? 0

  const initials = (session.user.name ?? session.user.email).slice(0, 2).toUpperCase()
  const impersonatedBy = (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null

  return (
    <AdminShell
      live={live}
      total={total}
      email={session.user.email}
      role={role}
      initials={initials}
      isImpersonating={Boolean(impersonatedBy)}
    >
      {children}
    </AdminShell>
  )
}

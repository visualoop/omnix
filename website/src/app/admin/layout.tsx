import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { count, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, machines } from '@/db'
import { AdminShell } from '@/components/admin/admin-shell'
import { ensureMigrated } from '@/lib/auto-migrate'

/**
 * Admin shell — espresso paper, mono nav, hairline rules, single copper
 * accent. The mobile drawer + sidebar chrome lives in <AdminShell>
 * (client component); this layout owns auth, role gating, and the
 * SystemPulse counters.
 */

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">403</span>
          <h1
            style={{ fontFamily: 'var(--font-display)' }}
            className="mt-2 text-[clamp(28px,3vw,40px)] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--color-fg)]"
          >
            Not for you.
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">
            The admin area is staff-only.{' '}
            <Link href="/dashboard" className="underline-offset-4 hover:underline text-[var(--color-fg)]">
              Back to your dashboard
            </Link>
            .
          </p>
        </div>
      </div>
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

  return (
    <AdminShell
      live={live}
      total={total}
      email={session.user.email}
      role={role}
      initials={initials}
    >
      {children}
    </AdminShell>
  )
}

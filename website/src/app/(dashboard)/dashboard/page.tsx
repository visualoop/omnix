import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, licenses, machines } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Dashboard' }

/**
 * Customer dashboard overview. Renders compliance status + a quick-glance
 * list of licences and machines.
 *
 * Drizzle-only — no Payload. Sessions resolved via Better Auth.
 */
export default async function DashboardOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard')

  const userId = session.user.id

  const [licList, machList] = await Promise.all([
    db
      .select({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        variant: licenses.variant,
        tier: licenses.tier,
        status: licenses.status,
        maintenanceUntil: licenses.maintenanceUntil,
        trialEndsAt: licenses.trialEndsAt,
      })
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .orderBy(desc(licenses.createdAt))
      .limit(10),
    db
      .select({
        id: machines.id,
        hostname: machines.hostname,
        os: machines.os,
        currentVersion: machines.currentVersion,
        lastSeenAt: machines.lastSeenAt,
        status: machines.status,
      })
      .from(machines)
      .where(eq(machines.userId, userId))
      .orderBy(desc(machines.lastSeenAt))
      .limit(10),
  ])

  return (
    <div className="space-y-8">
      <PageHeading
        title={`Welcome back, ${session.user.name?.split(' ')[0] ?? 'there'}`}
        subtitle="Your licences, machines, and support — all in one place."
      />

      <section>
        <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)] mb-3">
          Licences
        </h2>
        {licList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
            No licences yet. <a href="/buy" className="underline-offset-4 hover:underline">Buy a licence</a> to get started.
          </div>
        ) : (
          <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {licList.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <code className="font-mono text-[12px] text-[var(--color-fg)]">{l.licenseKey}</code>
                <span className="text-[var(--color-fg-muted)]">{l.variant} · {l.tier}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)] mb-3">
          Machines
        </h2>
        {machList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
            No machines have activated yet. Install Omnix on your till and paste your licence key on first launch.
          </div>
        ) : (
          <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {machList.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <span className="text-[var(--color-fg)] font-medium">{m.hostname ?? '—'}</span>
                <span className="text-[var(--color-fg-muted)]">{m.os} · v{m.currentVersion ?? '?'}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

import { count, eq, sql, desc, gte } from 'drizzle-orm'
import {
  Users, Buildings, Key, Desktop, ChatCircle, Coin,
} from '@phosphor-icons/react/dist/ssr'
import {
  db, user, organization, licenses, machines, supportTickets, payments, auditLog,
} from '@/db'
import { StatCard } from '@/components/admin/stat-card'
import { AuditEntry } from '@/components/admin/audit-entry'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Overview' }
export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  const [
    [{ n: usersTotal }],
    [{ n: usersNew30 }],
    [{ n: usersNew60to30 }],
    [{ n: orgsTotal }],
    [{ n: licsTotal }],
    [{ n: licsActive }],
    [{ n: licsTrial }],
    [{ n: machTotal }],
    [{ n: machLive }],
    [{ n: ticketsOpen }],
    [{ sum: revenueAll }],
    [{ sum: revenue30 }],
    [{ sum: revenue60to30 }],
    recentActivity,
  ] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user).where(gte(user.createdAt, thirtyDaysAgo)),
    db.select({ n: count() }).from(user).where(sql`${user.createdAt} >= ${sixtyDaysAgo} AND ${user.createdAt} < ${thirtyDaysAgo}`),
    db.select({ n: count() }).from(organization),
    db.select({ n: count() }).from(licenses),
    db.select({ n: count() }).from(licenses).where(eq(licenses.status, 'active')),
    db.select({ n: count() }).from(licenses).where(eq(licenses.status, 'trial')),
    db.select({ n: count() }).from(machines),
    db.select({ n: count() }).from(machines).where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`),
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, 'open')),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(eq(payments.status, 'success')),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(sql`${payments.status} = 'success' AND ${payments.paidAt} >= ${thirtyDaysAgo}`),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(sql`${payments.status} = 'success' AND ${payments.paidAt} >= ${sixtyDaysAgo} AND ${payments.paidAt} < ${thirtyDaysAgo}`),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(20),
  ])

  const usersDelta = pctDelta(usersNew30, usersNew60to30)
  const revenueDelta = pctDelta(Number(revenue30 ?? 0), Number(revenue60to30 ?? 0))

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Platform"
        title="System overview"
        description="A live view of every customer, every machine, every shilling. Refreshes on each visit."
      />

      {/* KPI grid — six stats, three columns on desktop */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            style={{ fontFamily: 'var(--font-display)' }}
            className="text-[20px] font-medium tracking-[-0.01em]"
          >
            <em className="not-italic" style={{ fontStyle: 'italic' }}>Right now.</em>
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
            {new Date().toISOString().slice(0, 16).replace('T', ' ')} utc
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Customers"
            value={usersTotal.toLocaleString()}
            delta={usersDelta !== null ? { value: usersDelta, period: 'vs prior 30d' } : null}
            icon={<Users weight="regular" className="size-4" />}
          />
          <StatCard
            label="Organisations"
            value={orgsTotal.toLocaleString()}
            hint="multi-user accounts"
            icon={<Buildings weight="regular" className="size-4" />}
          />
          <StatCard
            label="Licences"
            value={licsTotal.toLocaleString()}
            hint={`${licsActive} active · ${licsTrial} on trial`}
            icon={<Key weight="regular" className="size-4" />}
          />
          <StatCard
            label="Machines"
            value={machTotal.toLocaleString()}
            hint={`${machLive} live · last 5 min`}
            icon={<Desktop weight="regular" className="size-4" />}
          />
          <StatCard
            label="Open tickets"
            value={ticketsOpen.toLocaleString()}
            hint={ticketsOpen > 0 ? 'awaiting reply' : 'inbox zero'}
            icon={<ChatCircle weight="regular" className="size-4" />}
          />
          <StatCard
            label="Lifetime revenue"
            value={`KSh ${Number(revenueAll ?? 0).toLocaleString()}`}
            delta={revenueDelta !== null ? { value: revenueDelta, period: 'vs prior 30d' } : null}
            icon={<Coin weight="regular" className="size-4" />}
            mono
          />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
              Activity
            </span>
            <h2
              style={{ fontFamily: 'var(--font-display)' }}
              className="mt-1 text-[20px] font-medium tracking-[-0.01em]"
            >
              The last twenty things that happened.
            </h2>
          </div>
          <a
            href="/admin/audit"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Full audit log →
          </a>
        </div>
        {recentActivity.length === 0 ? (
          <EmptyState
            title="Nothing yet."
            description="Once customers sign up, payments land, and admin actions run, the audit feed picks them up here."
          />
        ) : (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {recentActivity.map((a) => (
              <AuditEntry key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function pctDelta(current: number, prior: number): number | null {
  if (prior === 0 && current === 0) return null
  if (prior === 0) return current > 0 ? 100 : 0
  return Math.round(((current - prior) / prior) * 100)
}

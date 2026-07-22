/* Hallmark · Working Counter · admin operations ledger · no fabricated metrics */

import { headers } from 'next/headers'
import Link from 'next/link'
import { count, desc, eq, sql } from 'drizzle-orm'
import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react/dist/ssr'

import { AuditEntry } from '@/components/admin/audit-entry'
import { adminNavigationForRole, type StaffRole } from '@/components/admin/admin-navigation'
import { EmptyState } from '@/components/admin/empty-state'
import {
  auditLog,
  db,
  licenses,
  machines,
  organization,
  payments,
  supportTickets,
  user,
} from '@/db'
import { auth } from '@/lib/auth'

export const metadata = { title: 'Admin · Overview' }
export const dynamic = 'force-dynamic'

interface CounterItem {
  label: string
  value: number
  detail: string
  href: string
}

interface RegisterItem {
  label: string
  value: number
  detail: string
}

export default async function AdminOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const role = ((session?.user as { role?: StaffRole } | undefined)?.role ?? 'sales_rep') as StaffRole
  const canAudit = role === 'platform_admin' || role === 'support_agent'
  const isAdmin = role === 'platform_admin'
  const isSupport = role === 'support_agent'

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Every panel is backed by a bounded, indexed query. We settle them
  // independently so a cold or flaky database degrades a single counter to
  // zero (and raises the `countsDegraded` flag) instead of throwing a 500
  // and leaking a stack trace. Order here is load-bearing — see `at()`.
  const countQueries = [
    db.select({ n: count() }).from(user), // 0 · usersTotal
    db.select({ n: count() }).from(organization), // 1 · orgsTotal
    db.select({ n: count() }).from(licenses).where(eq(licenses.status, 'active')), // 2 · activeLicences
    db
      .select({ n: count() })
      .from(licenses)
      .where(sql`${licenses.status} not in ('active', 'trial')`), // 3 · nonActiveLicences
    db.select({ n: count() }).from(machines), // 4 · machinesTotal
    db
      .select({ n: count() })
      .from(machines)
      .where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`), // 5 · machinesLive
    db
      .select({ n: count() })
      .from(machines)
      .where(sql`${machines.lastSeenAt} <= ${oneDayAgo} or ${machines.lastSeenAt} is null`), // 6 · machinesSilent
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, 'open')), // 7 · ticketsOpen
    db
      .select({ n: count() })
      .from(supportTickets)
      .where(sql`${supportTickets.status} = 'open' and ${supportTickets.assignedTo} is null`), // 8 · ticketsUnassigned
    db.select({ n: count() }).from(payments).where(eq(payments.status, 'pending')), // 9 · paymentsPending
    db
      .select({ n: count() })
      .from(payments)
      .where(sql`${payments.status} = 'success' and ${payments.paidAt} >= ${thirtyDaysAgo}`), // 10 · paymentsSuccessful30d
  ]

  const settled = await Promise.allSettled(countQueries)
  const countsDegraded = settled.some((result) => result.status === 'rejected')
  const at = (index: number): number => {
    const result = settled[index]
    return result && result.status === 'fulfilled' ? (result.value[0]?.n ?? 0) : 0
  }

  const usersTotal = at(0)
  const orgsTotal = at(1)
  const activeLicences = at(2)
  const nonActiveLicences = at(3)
  const machinesTotal = at(4)
  const machinesLive = at(5)
  const machinesSilent = at(6)
  const ticketsOpen = at(7)
  const ticketsUnassigned = at(8)
  const paymentsPending = at(9)
  const paymentsSuccessful30d = at(10)

  // Recent activity is limited to a bounded window and only read for roles
  // with the audit capability. A read failure degrades to an unavailable
  // notice, never a leaked error.
  let recentActivity: Array<typeof auditLog.$inferSelect> = []
  let activityDegraded = false
  if (canAudit) {
    try {
      recentActivity = await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(8)
    } catch {
      activityDegraded = true
    }
  }

  const counters: CounterItem[] = isAdmin
    ? [
        { label: 'Open tickets', value: ticketsOpen, detail: 'Awaiting a staff reply', href: '/admin/tickets?status=open' },
        { label: 'Pending payments', value: paymentsPending, detail: 'Transactions without a final outcome', href: '/admin/payments?status=pending' },
        { label: 'Non-active licences', value: nonActiveLicences, detail: 'Lapsed, suspended, or revoked', href: '/admin/licenses' },
        { label: 'Silent machines', value: machinesSilent, detail: 'No heartbeat in the last 24 hours', href: '/admin/machines' },
      ]
    : isSupport
      ? [
          { label: 'Open tickets', value: ticketsOpen, detail: 'Awaiting a staff reply', href: '/admin/tickets?status=open' },
          { label: 'Unassigned tickets', value: ticketsUnassigned, detail: 'Open without an owner', href: '/admin/tickets?status=open' },
          { label: 'Customer accounts', value: usersTotal, detail: 'Customer and staff user records', href: '/admin/users' },
          { label: 'Organisations', value: orgsTotal, detail: 'Multi-user customer businesses', href: '/admin/orgs' },
        ]
      : [
          { label: 'Pending payments', value: paymentsPending, detail: 'Transactions without a final outcome', href: '/admin/payments?status=pending' },
          { label: 'Successful payments', value: paymentsSuccessful30d, detail: 'Completed in the last 30 days', href: '/admin/payments?status=success' },
          { label: 'Customer accounts', value: usersTotal, detail: 'Customer and staff user records', href: '/admin/users' },
          { label: 'Organisations', value: orgsTotal, detail: 'Multi-user customer businesses', href: '/admin/orgs' },
        ]

  const register: RegisterItem[] = [
    { label: 'Customer accounts', value: usersTotal, detail: 'All user records' },
    { label: 'Organisations', value: orgsTotal, detail: 'Multi-user businesses' },
  ]
  if (isAdmin) {
    register.push(
      { label: 'Active licences', value: activeLicences, detail: 'Status: active' },
      { label: 'Machines live', value: machinesLive, detail: `${machinesTotal.toLocaleString()} registered · last 5 min` },
    )
  } else if (isSupport) {
    register.push({ label: 'Open tickets', value: ticketsOpen, detail: 'Current support queue' })
  } else {
    register.push({ label: 'Payments completed', value: paymentsSuccessful30d, detail: 'Last 30 days' })
  }

  const accessibleGroups = adminNavigationForRole(role)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.href !== '/admin') }))
    .filter((group) => group.items.length > 0)
  const generatedAt = new Date()

  return (
    <div data-admin-overview className="flex min-w-0 flex-col gap-10 sm:gap-12">
      <header className="grid min-w-0 gap-6 border-b border-[var(--color-border-strong)] pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Working Counter · {roleLabel(role)}
          </p>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(36px,6vw,72px)] font-semibold leading-[0.95] tracking-[-0.055em]">
            Work that needs a person.
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-[var(--color-fg-muted)] sm:text-[15px]">
            {overviewDescription(role)} Counts come from current platform records; no forecasts or blended revenue figures.
          </p>
        </div>
        <div className="border-l-2 border-[var(--color-accent)] pl-3 font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--color-fg-subtle)]">
          <span className="block text-[var(--color-fg-muted)]">Read at</span>
          <time dateTime={generatedAt.toISOString()} className="mt-1 block tabular-nums">
            {generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
          </time>
        </div>
      </header>

      {countsDegraded ? (
        <div
          role="status"
          className="border-l-2 border-[var(--color-caution)] bg-[color-mix(in_srgb,var(--color-caution)_8%,var(--color-bg))] px-4 py-3 text-[13px] leading-6 text-[var(--color-fg-muted)]"
        >
          Some counters couldn&apos;t be read just now. The figures below show what was available —
          refresh to retry.
        </div>
      ) : null}

      <section aria-labelledby="work-queue-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Current queue</p>
            <h2 id="work-queue-heading" className="mt-1 text-[24px] font-semibold tracking-[-0.035em]">Start here</h2>
          </div>
          <p className="m-0 max-w-md text-[12px] text-[var(--color-fg-muted)]">Zero means the recorded queue is clear. Open a counter to inspect the underlying rows.</p>
        </div>

        <div className="grid min-w-0 border-y border-[var(--color-border-strong)] sm:grid-cols-2 xl:grid-cols-4">
          {counters.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className={`group flex min-h-44 min-w-0 flex-col justify-between gap-6 p-5 transition-colors hover:bg-[var(--color-surface)] ${
                index > 0 ? 'border-t border-[var(--color-border)] sm:border-l sm:border-t-0' : ''
              } ${index === 2 ? 'sm:border-l-0 sm:border-t xl:border-l xl:border-t-0' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-[13px] font-semibold">{item.label}</span>
                {item.value === 0 ? (
                  <CheckCircle className="size-4 text-[var(--color-positive)]" weight="fill" aria-label="Queue clear" />
                ) : (
                  <Warning className="size-4 text-[var(--color-caution)]" weight="fill" aria-label="Needs review" />
                )}
              </div>
              <div>
                <div className="font-mono text-[clamp(34px,5vw,56px)] font-semibold leading-none tracking-[-0.06em] tabular-nums">{item.value.toLocaleString()}</div>
                <div className="mt-3 flex items-end justify-between gap-4 text-[11px] leading-4 text-[var(--color-fg-muted)]">
                  <span>{item.detail}</span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="register-heading">
        <div className="mb-4">
          <p className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Recorded estate</p>
          <h2 id="register-heading" className="mt-1 text-[24px] font-semibold tracking-[-0.035em]">Platform register</h2>
        </div>
        <dl className="grid min-w-0 grid-cols-1 border-y border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">
          {register.map((item, index) => (
            <div key={item.label} className={`${index > 0 ? 'border-t border-[var(--color-border)] sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 sm:border-t lg:border-l lg:border-t-0' : ''} px-4 py-4`}>
              <dt className="text-[12px] font-medium text-[var(--color-fg-muted)]">{item.label}</dt>
              <dd className="m-0 mt-2 font-mono text-[26px] font-semibold tabular-nums">{item.value.toLocaleString()}</dd>
              <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">{item.detail}</div>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <div>
              <p className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Trace</p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.035em]">Recent platform activity</h2>
            </div>
            {canAudit ? (
              <Link href="/admin/audit" className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]">
                Full audit log →
              </Link>
            ) : null}
          </div>

          {!canAudit ? (
            <div className="border-l-2 border-[var(--color-border-strong)] py-1 pl-4 text-[13px] leading-6 text-[var(--color-fg-muted)]">
              Audit events are limited to staff with audit capability. Your payment and customer desks remain available at right.
            </div>
          ) : activityDegraded ? (
            <div
              role="status"
              className="border-l-2 border-[var(--color-caution)] py-1 pl-4 text-[13px] leading-6 text-[var(--color-fg-muted)]"
            >
              The audit feed is temporarily unavailable. Refresh to retry.
            </div>
          ) : recentActivity.length === 0 ? (
            <EmptyState title="No recorded activity." description="System and staff actions will appear here after they are written to the audit log." />
          ) : (
            <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {recentActivity.map((entry) => <AuditEntry key={entry.id} a={entry} />)}
            </div>
          )}
        </div>

        <aside aria-labelledby="access-heading" className="min-w-0 border-t border-[var(--color-border-strong)] pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <p className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Capability map</p>
          <h2 id="access-heading" className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Your desks</h2>
          <div className="mt-5 space-y-5">
            {accessibleGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">{group.label}</div>
                <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} className="group flex items-center justify-between gap-3 py-2.5 text-[12px] font-medium hover:text-[var(--color-accent)]">
                      <span>{item.label}</span>
                      <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[10px] leading-4 text-[var(--color-fg-subtle)]">Navigation reflects your role. Sensitive routes and actions continue to enforce server-side authorization.</p>
        </aside>
      </section>
    </div>
  )
}

function overviewDescription(role: StaffRole): string {
  if (role === 'platform_admin') return 'A current view of support, payment, licence, and machine records.'
  if (role === 'support_agent') return 'A current view of the customer and support records available to your role.'
  return 'A current view of the customer and payment records available to your role.'
}

function roleLabel(role: StaffRole): string {
  return role.replaceAll('_', ' ')
}

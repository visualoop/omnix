import { notFound } from 'next/navigation'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db, user, licenses, machines, payments, supportTickets, member, organization, auditLog, resellers } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { buildClearHref } from '@/lib/list-query'
import { formatDate, formatDateShort } from '@/lib/format-date'
import Link from 'next/link'
import { ResellerControls } from './reseller-controls'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    licPage?: string; licQ?: string
    machPage?: string; machQ?: string
    payPage?: string; payQ?: string
    ticketPage?: string; ticketQ?: string
    auditPage?: string; auditQ?: string
    memPage?: string; memQ?: string
  }>
}

const num = (v: string | undefined) => Math.max(1, parseInt(v ?? '1', 10) || 1)
const KES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)

export default async function AdminUserDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const userRow = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (!userRow) notFound()

  const licPage = num(sp.licPage), licQ = sp.licQ?.trim() ?? ''
  const machPage = num(sp.machPage), machQ = sp.machQ?.trim() ?? ''
  const payPage = num(sp.payPage), payQ = sp.payQ?.trim() ?? ''
  const ticketPage = num(sp.ticketPage), ticketQ = sp.ticketQ?.trim() ?? ''
  const auditPage = num(sp.auditPage), auditQ = sp.auditQ?.trim() ?? ''
  const memPage = num(sp.memPage), memQ = sp.memQ?.trim() ?? ''

  // Clear-filter link for a tab's filtered-empty state: keep the route + the
  // open tab + every other tab's own search/page state, drop only this list's
  // own filter + page namespace.
  const clearHref = (tab: string, drop: string[]) =>
    buildClearHref(`/admin/users/${id}`, sp as Record<string, string | undefined>, { drop, set: { tab } })

  const licWhere = and(eq(licenses.userId, id), licQ ? or(ilike(licenses.licenseKey, `%${licQ}%`), ilike(licenses.variant, `%${licQ}%`), ilike(licenses.tier, `%${licQ}%`), ilike(licenses.status, `%${licQ}%`)) : undefined)
  const machWhere = and(eq(machines.userId, id), machQ ? or(ilike(machines.hostname, `%${machQ}%`), ilike(machines.machineId, `%${machQ}%`), ilike(machines.currentVersion, `%${machQ}%`), ilike(machines.networkMode, `%${machQ}%`)) : undefined)
  const payWhere = and(eq(payments.userId, id), payQ ? or(ilike(payments.purpose, `%${payQ}%`), ilike(payments.paystackReference, `%${payQ}%`), ilike(payments.status, `%${payQ}%`)) : undefined)
  const ticketWhere = and(eq(supportTickets.userId, id), ticketQ ? or(ilike(supportTickets.subject, `%${ticketQ}%`), ilike(supportTickets.category, `%${ticketQ}%`), ilike(supportTickets.status, `%${ticketQ}%`)) : undefined)
  const auditWhere = and(eq(auditLog.actorId, id), auditQ ? or(ilike(auditLog.action, `%${auditQ}%`), ilike(auditLog.resource, `%${auditQ}%`)) : undefined)
  const memWhere = and(eq(member.userId, id), memQ ? ilike(organization.name, `%${memQ}%`) : undefined)

  const [
    userLicenses, licCountRow,
    userMachines, machCountRow,
    userPayments, payCountRow,
    userTickets, ticketCountRow,
    userAudit, auditCountRow,
    userMemberships, memCountRow,
    licensesTotalRow, machinesTotalRow, spendRow, activeLicRow, resellerRow,
  ] = await Promise.all([
    db.select().from(licenses).where(licWhere).orderBy(desc(licenses.createdAt)).limit(PAGE_SIZE).offset((licPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(licenses).where(licWhere),
    db.select().from(machines).where(machWhere).orderBy(desc(machines.lastSeenAt)).limit(PAGE_SIZE).offset((machPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(machines).where(machWhere),
    db.select().from(payments).where(payWhere).orderBy(desc(payments.createdAt)).limit(PAGE_SIZE).offset((payPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).where(payWhere),
    db.select().from(supportTickets).where(ticketWhere).orderBy(desc(supportTickets.createdAt)).limit(PAGE_SIZE).offset((ticketPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(supportTickets).where(ticketWhere),
    db.select().from(auditLog).where(auditWhere).orderBy(desc(auditLog.createdAt)).limit(PAGE_SIZE).offset((auditPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(auditLog).where(auditWhere),
    db.select({ org: organization }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(memWhere).orderBy(asc(organization.name)).limit(PAGE_SIZE).offset((memPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(memWhere),
    db.select({ n: count() }).from(licenses).where(eq(licenses.userId, id)),
    db.select({ n: count() }).from(machines).where(eq(machines.userId, id)),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.userId, id), eq(payments.status, 'success'))),
    db.select({ n: count() }).from(licenses).where(and(eq(licenses.userId, id), or(eq(licenses.status, 'active'), eq(licenses.status, 'trial')))),
    db.select().from(resellers).where(eq(resellers.userId, id)).limit(1).catch(() => []),
  ])

  const licCount = licCountRow[0]?.n ?? 0
  const machCount = machCountRow[0]?.n ?? 0
  const payCount = payCountRow[0]?.n ?? 0
  const ticketCount = ticketCountRow[0]?.n ?? 0
  const auditCount = auditCountRow[0]?.n ?? 0
  const memCount = memCountRow[0]?.n ?? 0
  const licensesTotal = licensesTotalRow[0]?.n ?? 0
  const machinesTotal = machinesTotalRow[0]?.n ?? 0
  const totalSpent = spendRow[0]?.sum ?? 0
  const activeLicenses = activeLicRow[0]?.n ?? 0

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Users', href: '/admin/users' }, { label: userRow.name }]} />
      <BackButton fallback="/admin/users" label="Back to users" />
      <EntityHero
        eyebrow="User"
        title={userRow.name}
        subtitle={[userRow.email, userRow.phoneNumber, userRow.businessName].filter(Boolean).join(' · ')}
        badges={[
          { label: userRow.role, variant: userRow.role === 'user' ? 'secondary' : 'default' },
          ...(userRow.banned ? [{ label: 'Banned', variant: 'destructive' as const }] : []),
          ...(userRow.emailVerified ? [] : [{ label: 'Unverified', variant: 'outline' as const }]),
        ]}
        stats={[
          { label: 'Joined', value: formatDate(userRow.createdAt) },
          { label: 'Country', value: userRow.country },
          { label: 'Currency', value: userRow.currency },
          { label: 'Licences', value: licensesTotal, tone: activeLicenses > 0 ? 'positive' : 'muted' },
          { label: 'Machines', value: machinesTotal },
          { label: 'Lifetime spend', value: KES(totalSpent) },
        ]}
      />

      <ResellerControls
        userId={userRow.id}
        reseller={
          resellerRow[0]
            ? {
                id: resellerRow[0].id,
                companyName: resellerRow[0].companyName,
                discountPercent: resellerRow[0].discountPercent,
                status: resellerRow[0].status,
                totalLicensesIssued: resellerRow[0].totalLicensesIssued,
                totalRevenueBrought: resellerRow[0].totalRevenueBrought,
                totalCommissionEarned: resellerRow[0].totalCommissionEarned,
                unpaidCommission: resellerRow[0].unpaidCommission,
                commissionCurrency: resellerRow[0].commissionCurrency,
                approvedAt: resellerRow[0].approvedAt?.toISOString() ?? null,
              }
            : null
        }
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Email" value={userRow.email} />
                <Field label="Phone" value={userRow.phoneNumber} />
                <Field label="Business" value={userRow.businessName} />
                <Field label="Country / currency" value={`${userRow.country} · ${userRow.currency}`} />
                <Field label="Verified" value={userRow.emailVerified ? 'Yes' : 'No'} />
                <Field label="Staff team" value={userRow.staffTeam ?? '—'} />
                {userRow.banned && (
                  <Field label="Ban reason" value={userRow.banReason} className="md:col-span-2" />
                )}
                {(memCount > 0 || memQ) && (
                  <div className="md:col-span-2 flex flex-col gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">Member of ({memCount})</dt>
                    <AdminSearch placeholder="Search organisations by name…" label="Search user memberships" paramName="memQ" pageParamName="memPage" />
                    <dd className="flex flex-wrap gap-2">
                      {userMemberships.map((m) => (
                        <Link
                          key={m.org.id}
                          href={`/admin/orgs/${m.org.id}`}
                          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[12px] hover:bg-[var(--color-surface)]"
                        >
                          {m.org.name}
                        </Link>
                      ))}
                      {userMemberships.length === 0 && (
                        memQ ? (
                          <FilteredEmptyState
                            query={memQ}
                            clearHref={clearHref('overview', ['memQ', 'memPage'])}
                            entityLabel="organisations"
                          />
                        ) : (
                          <span className="text-[12px] text-[var(--color-fg-muted)]">No organisations on this page.</span>
                        )
                      )}
                    </dd>
                    <AdminPagination page={memPage} pageSize={PAGE_SIZE} total={memCount} pageParamName="memPage" label="Membership pages" />
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'licenses',
            label: 'Licences',
            count: licCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search licences by key, variant or status…" label="Search user licences" paramName="licQ" pageParamName="licPage" />
                <LicensesList rows={userLicenses} query={licQ} clearHref={clearHref('licenses', ['licQ', 'licPage'])} entityLabel="licences" emptyLabel="No licences." />
                <AdminPagination page={licPage} pageSize={PAGE_SIZE} total={licCount} pageParamName="licPage" label="Licences pages" />
              </div>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: machCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search machines by hostname or ID…" label="Search user machines" paramName="machQ" pageParamName="machPage" />
                <MachinesList rows={userMachines} query={machQ} clearHref={clearHref('machines', ['machQ', 'machPage'])} entityLabel="machines" emptyLabel="No machines." />
                <AdminPagination page={machPage} pageSize={PAGE_SIZE} total={machCount} pageParamName="machPage" label="Machines pages" />
              </div>
            ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: payCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search payments by reference or purpose…" label="Search user payments" paramName="payQ" pageParamName="payPage" />
                <PaymentsList rows={userPayments} query={payQ} clearHref={clearHref('payments', ['payQ', 'payPage'])} entityLabel="payments" emptyLabel="No payments." />
                <AdminPagination page={payPage} pageSize={PAGE_SIZE} total={payCount} pageParamName="payPage" label="Payments pages" />
              </div>
            ),
          },
          {
            id: 'tickets',
            label: 'Tickets',
            count: ticketCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search tickets by subject or status…" label="Search user tickets" paramName="ticketQ" pageParamName="ticketPage" />
                <TicketsList rows={userTickets} query={ticketQ} clearHref={clearHref('tickets', ['ticketQ', 'ticketPage'])} entityLabel="tickets" emptyLabel="No tickets." />
                <AdminPagination page={ticketPage} pageSize={PAGE_SIZE} total={ticketCount} pageParamName="ticketPage" label="Tickets pages" />
              </div>
            ),
          },
          {
            id: 'audit',
            label: 'Audit',
            count: auditCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search audit by action or resource…" label="Search user audit trail" paramName="auditQ" pageParamName="auditPage" />
                <AuditList rows={userAudit} query={auditQ} clearHref={clearHref('audit', ['auditQ', 'auditPage'])} entityLabel="audit entries" emptyLabel="No audit entries." />
                <AdminPagination page={auditPage} pageSize={PAGE_SIZE} total={auditCount} pageParamName="auditPage" label="Audit pages" />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">{label}</dt>
      <dd className="text-[14px] text-[var(--color-fg)]">{value || <span className="text-[var(--color-fg-subtle)]">—</span>}</dd>
    </div>
  )
}

function LicensesList({ rows, query, clearHref, entityLabel, emptyLabel }: { rows: Array<typeof licenses.$inferSelect>; query: string; clearHref: string; entityLabel: string; emptyLabel: string }) {
  if (!rows.length) {
    return query
      ? <FilteredEmptyState query={query} clearHref={clearHref} entityLabel={entityLabel} />
      : <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
      {rows.map((l) => (
        <li key={l.id}>
          <Link href={`/admin/licenses/${l.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium font-mono">{l.licenseKey}</span>
              <span className="text-[11px] text-[var(--color-fg-muted)]">
                {l.variant} · {l.tier} · {l.status}
              </span>
            </div>
            <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">
              {l.paidAt ? formatDate(l.paidAt) : '—'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function MachinesList({ rows, query, clearHref, entityLabel, emptyLabel }: { rows: Array<typeof machines.$inferSelect>; query: string; clearHref: string; entityLabel: string; emptyLabel: string }) {
  if (!rows.length) {
    return query
      ? <FilteredEmptyState query={query} clearHref={clearHref} entityLabel={entityLabel} />
      : <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
              <span className="text-[11px] text-[var(--color-fg-muted)]">
                {m.os} · {m.currentVersion ?? 'unknown'} · {m.networkMode ?? 'standalone'}
              </span>
            </div>
            <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">
              {m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function PaymentsList({ rows, query, clearHref, entityLabel, emptyLabel }: { rows: Array<typeof payments.$inferSelect>; query: string; clearHref: string; entityLabel: string; emptyLabel: string }) {
  if (!rows.length) {
    return query
      ? <FilteredEmptyState query={query} clearHref={clearHref} entityLabel={entityLabel} />
      : <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{p.purpose}</span>
              <span className="text-[11px] text-[var(--color-fg-muted)]">
                {p.paystackReference} · {p.status}
              </span>
            </div>
            <span className="font-mono text-[13px] tabular-nums">
              {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TicketsList({ rows, query, clearHref, entityLabel, emptyLabel }: { rows: Array<typeof supportTickets.$inferSelect>; query: string; clearHref: string; entityLabel: string; emptyLabel: string }) {
  if (!rows.length) {
    return query
      ? <FilteredEmptyState query={query} clearHref={clearHref} entityLabel={entityLabel} />
      : <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
      {rows.map((t) => (
        <li key={t.id}>
          <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{t.subject}</span>
              <span className="text-[11px] text-[var(--color-fg-muted)]">
                {t.category} · {t.priority} · {t.status}
              </span>
            </div>
            <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">
              {formatDate(t.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AuditList({ rows, query, clearHref, entityLabel, emptyLabel }: { rows: Array<typeof auditLog.$inferSelect>; query: string; clearHref: string; entityLabel: string; emptyLabel: string }) {
  if (!rows.length) {
    return query
      ? <FilteredEmptyState query={query} clearHref={clearHref} entityLabel={entityLabel} />
      : <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
  }
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((a) => (
        <li key={a.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--color-border)] pb-2.5">
          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
            {formatDateShort(a.createdAt)}
          </time>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">{a.action}</span>
            {a.resource && <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">{a.resource}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

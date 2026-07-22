import { notFound } from 'next/navigation'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import {
  db,
  organization,
  member,
  user,
  licenses,
  machines,
  payments,
  invitation,
} from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { buildClearHref } from '@/lib/list-query'
import { formatDate, formatDateShort } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Each tab is an independent growing collection → its own bounded page.
const PAGE_SIZE = 10

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    memberPage?: string; memberQ?: string
    invPage?: string; invQ?: string
    licPage?: string; licQ?: string
    machPage?: string; machQ?: string
    payPage?: string; payQ?: string
  }>
}

const num = (v: string | undefined) => Math.max(1, parseInt(v ?? '1', 10) || 1)

function CollectionSection({
  paramName, pageParamName, placeholder, searchLabel, pagerLabel,
  page, total, children,
}: {
  paramName: string
  pageParamName: string
  placeholder: string
  searchLabel: string
  pagerLabel: string
  page: number
  total: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder={placeholder} label={searchLabel} paramName={paramName} pageParamName={pageParamName} />
      {children}
      <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} pageParamName={pageParamName} label={pagerLabel} />
    </div>
  )
}

export default async function AdminOrgDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const org = await db.query.organization.findFirst({ where: eq(organization.id, id) })
  if (!org) notFound()

  const memberPage = num(sp.memberPage), memberQ = sp.memberQ?.trim() ?? ''
  const invPage = num(sp.invPage), invQ = sp.invQ?.trim() ?? ''
  const licPage = num(sp.licPage), licQ = sp.licQ?.trim() ?? ''
  const machPage = num(sp.machPage), machQ = sp.machQ?.trim() ?? ''
  const payPage = num(sp.payPage), payQ = sp.payQ?.trim() ?? ''

  const memberWhere = and(
    eq(member.organizationId, id),
    memberQ ? or(ilike(user.name, `%${memberQ}%`), ilike(user.email, `%${memberQ}%`)) : undefined,
  )
  const invWhere = and(
    eq(invitation.organizationId, id),
    invQ ? or(ilike(invitation.email, `%${invQ}%`), ilike(invitation.role, `%${invQ}%`), ilike(invitation.status, `%${invQ}%`)) : undefined,
  )
  const licWhere = and(
    eq(licenses.organizationId, id),
    licQ ? or(ilike(licenses.licenseKey, `%${licQ}%`), ilike(licenses.variant, `%${licQ}%`), ilike(licenses.tier, `%${licQ}%`), ilike(licenses.status, `%${licQ}%`)) : undefined,
  )
  const machWhere = and(
    eq(machines.organizationId, id),
    machQ ? or(ilike(machines.hostname, `%${machQ}%`), ilike(machines.machineId, `%${machQ}%`), ilike(machines.currentVersion, `%${machQ}%`), ilike(machines.os, `%${machQ}%`)) : undefined,
  )
  const payWhere = and(
    eq(payments.organizationId, id),
    payQ ? or(ilike(payments.purpose, `%${payQ}%`), ilike(payments.paystackReference, `%${payQ}%`), ilike(payments.status, `%${payQ}%`)) : undefined,
  )

  const [
    members, membersCountRow,
    invitations, invCountRow,
    orgLicenses, licCountRow,
    orgMachines, machCountRow,
    orgPayments, payCountRow,
    membersTotalRow, licensesTotalRow, machinesTotalRow, openInvitesRow, spendRow, ownerRow,
  ] = await Promise.all([
    db.select({ member, user }).from(member).innerJoin(user, eq(user.id, member.userId)).where(memberWhere).orderBy(desc(member.createdAt)).limit(PAGE_SIZE).offset((memberPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(member).innerJoin(user, eq(user.id, member.userId)).where(memberWhere),
    db.select().from(invitation).where(invWhere).orderBy(desc(invitation.createdAt)).limit(PAGE_SIZE).offset((invPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(invitation).where(invWhere),
    db.select().from(licenses).where(licWhere).orderBy(desc(licenses.createdAt)).limit(PAGE_SIZE).offset((licPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(licenses).where(licWhere),
    db.select().from(machines).where(machWhere).orderBy(desc(machines.lastSeenAt)).limit(PAGE_SIZE).offset((machPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(machines).where(machWhere),
    db.select().from(payments).where(payWhere).orderBy(desc(payments.createdAt)).limit(PAGE_SIZE).offset((payPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).where(payWhere),
    // Stable, unfiltered hero aggregates (never distorted by a tab search).
    db.select({ n: count() }).from(member).where(eq(member.organizationId, id)),
    db.select({ n: count() }).from(licenses).where(eq(licenses.organizationId, id)),
    db.select({ n: count() }).from(machines).where(eq(machines.organizationId, id)),
    db.select({ n: count() }).from(invitation).where(and(eq(invitation.organizationId, id), eq(invitation.status, 'pending'))),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.organizationId, id), eq(payments.status, 'success'))),
    db.select({ member, user }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, id), eq(member.role, 'owner'))).limit(1),
  ])

  const membersCount = membersCountRow[0]?.n ?? 0
  const invCount = invCountRow[0]?.n ?? 0
  const licCount = licCountRow[0]?.n ?? 0
  const machCount = machCountRow[0]?.n ?? 0
  const payCount = payCountRow[0]?.n ?? 0
  const membersTotal = membersTotalRow[0]?.n ?? 0
  const licensesTotal = licensesTotalRow[0]?.n ?? 0
  const machinesTotal = machinesTotalRow[0]?.n ?? 0
  const openInvites = openInvitesRow[0]?.n ?? 0
  const totalSpent = spendRow[0]?.sum ?? 0
  const owner = ownerRow[0]

  const emptyRow = (label: string) => <li className="px-4 py-3 text-sm text-[var(--color-fg-muted)]">{label}</li>
  const clearHref = (tab: string, drop: string[]) =>
    buildClearHref(`/admin/orgs/${id}`, sp as Record<string, string | undefined>, { drop, set: { tab } })
  const filteredEmptyRow = (query: string, tab: string, drop: string[], entityLabel: string, procedural: string) =>
    query ? (
      <li><FilteredEmptyState query={query} clearHref={clearHref(tab, drop)} entityLabel={entityLabel} /></li>
    ) : (
      emptyRow(procedural)
    )

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Organisations', href: '/admin/orgs' }, { label: org.name }]} />
      <BackButton fallback="/admin/orgs" label="Back to orgs" />
      <EntityHero
        eyebrow="Organisation"
        title={org.name}
        subtitle={org.slug}
        badges={owner ? [{ label: `Owner: ${owner.user.name}`, variant: 'outline' }] : undefined}
        stats={[
          { label: 'Created', value: formatDate(org.createdAt) },
          { label: 'Members', value: membersTotal },
          { label: 'Licences', value: licensesTotal },
          { label: 'Machines', value: machinesTotal },
          { label: 'Open invites', value: openInvites },
          { label: 'Lifetime spend', value: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(totalSpent) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'members',
            label: 'Members',
            count: membersCount,
            content: (
              <CollectionSection paramName="memberQ" pageParamName="memberPage" placeholder="Search members by name or email…" searchLabel="Search organisation members" pagerLabel="Members pages" page={memberPage} total={membersCount}>
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {members.map((m) => (
                    <li key={m.member.id}>
                      <Link href={`/admin/users/${m.user.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{m.user.name}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{m.user.email}</span>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">{m.member.role}</span>
                      </Link>
                    </li>
                  ))}
                  {members.length === 0 && filteredEmptyRow(memberQ, 'members', ['memberQ', 'memberPage'], 'members', 'No members.')}
                </ul>
              </CollectionSection>
            ),
          },
          {
            id: 'invitations',
            label: 'Invitations',
            count: invCount,
            content: (
              <CollectionSection paramName="invQ" pageParamName="invPage" placeholder="Search invitations by email or status…" searchLabel="Search organisation invitations" pagerLabel="Invitations pages" page={invPage} total={invCount}>
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{inv.email}</span>
                        <span className="text-[11px] text-[var(--color-fg-muted)]">{inv.role ?? 'member'} · {inv.status}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">Expires {formatDate(inv.expiresAt)}</span>
                    </li>
                  ))}
                  {invitations.length === 0 && filteredEmptyRow(invQ, 'invitations', ['invQ', 'invPage'], 'invitations', 'No invitations.')}
                </ul>
              </CollectionSection>
            ),
          },
          {
            id: 'licenses',
            label: 'Licences',
            count: licCount,
            content: (
              <CollectionSection paramName="licQ" pageParamName="licPage" placeholder="Search licences by key, variant or status…" searchLabel="Search organisation licences" pagerLabel="Licences pages" page={licPage} total={licCount}>
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {orgLicenses.map((l) => (
                    <li key={l.id}>
                      <Link href={`/admin/licenses/${l.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="font-mono text-[13px] font-medium">{l.licenseKey}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{l.variant} · {l.tier} · {l.status}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {orgLicenses.length === 0 && filteredEmptyRow(licQ, 'licenses', ['licQ', 'licPage'], 'licences', 'No licences.')}
                </ul>
              </CollectionSection>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: machCount,
            content: (
              <CollectionSection paramName="machQ" pageParamName="machPage" placeholder="Search machines by hostname or ID…" searchLabel="Search organisation machines" pagerLabel="Machines pages" page={machPage} total={machCount}>
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {orgMachines.map((m) => (
                    <li key={m.id}>
                      <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{m.os} · {m.currentVersion ?? '—'}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}</span>
                      </Link>
                    </li>
                  ))}
                  {orgMachines.length === 0 && filteredEmptyRow(machQ, 'machines', ['machQ', 'machPage'], 'machines', 'No machines.')}
                </ul>
              </CollectionSection>
            ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: payCount,
            content: (
              <CollectionSection paramName="payQ" pageParamName="payPage" placeholder="Search payments by reference or purpose…" searchLabel="Search organisation payments" pagerLabel="Payments pages" page={payPage} total={payCount}>
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {orgPayments.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{p.purpose}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{p.paystackReference}</span>
                        </div>
                        <span className="font-mono text-[13px] tabular-nums">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}</span>
                      </Link>
                    </li>
                  ))}
                  {orgPayments.length === 0 && filteredEmptyRow(payQ, 'payments', ['payQ', 'payPage'], 'payments', 'No payments.')}
                </ul>
              </CollectionSection>
            ),
          },
        ]}
      />
    </div>
  )
}

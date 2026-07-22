import { notFound } from 'next/navigation'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db, licenses, machines, payments, user, organization } from '@/db'
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

const PAGE_SIZE = 10

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ machPage?: string; machQ?: string; payPage?: string; payQ?: string }>
}

const num = (v: string | undefined) => Math.max(1, parseInt(v ?? '1', 10) || 1)

export default async function AdminLicenseDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const lic = await db.query.licenses.findFirst({ where: eq(licenses.id, id) })
  if (!lic) notFound()

  const machPage = num(sp.machPage), machQ = sp.machQ?.trim() ?? ''
  const payPage = num(sp.payPage), payQ = sp.payQ?.trim() ?? ''

  const machWhere = and(
    eq(machines.licenseId, id),
    machQ ? or(ilike(machines.hostname, `%${machQ}%`), ilike(machines.machineId, `%${machQ}%`), ilike(machines.currentVersion, `%${machQ}%`), ilike(machines.status, `%${machQ}%`)) : undefined,
  )
  const payWhere = and(
    eq(payments.licenseId, id),
    payQ ? or(ilike(payments.purpose, `%${payQ}%`), ilike(payments.paystackReference, `%${payQ}%`), ilike(payments.status, `%${payQ}%`)) : undefined,
  )

  const [owner, org, licenseMachines, machCountRow, licensePayments, payCountRow, machTotalRow, paidRow] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, lic.userId) }),
    lic.organizationId ? db.query.organization.findFirst({ where: eq(organization.id, lic.organizationId) }) : null,
    db.select().from(machines).where(machWhere).orderBy(desc(machines.lastSeenAt)).limit(PAGE_SIZE).offset((machPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(machines).where(machWhere),
    db.select().from(payments).where(payWhere).orderBy(desc(payments.createdAt)).limit(PAGE_SIZE).offset((payPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).where(payWhere),
    db.select({ n: count() }).from(machines).where(eq(machines.licenseId, id)),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.licenseId, id), eq(payments.status, 'success'))),
  ])

  const machCount = machCountRow[0]?.n ?? 0
  const payCount = payCountRow[0]?.n ?? 0
  const machinesTotal = machTotalRow[0]?.n ?? 0
  const totalPaid = paidRow[0]?.sum ?? 0

  const KES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
  const emptyRow = (label: string) => <li className="px-4 py-3 text-sm text-[var(--color-fg-muted)]">{label}</li>
  const clearHref = (tab: string, drop: string[]) =>
    buildClearHref(`/admin/licenses/${id}`, sp as Record<string, string | undefined>, { drop, set: { tab } })
  const filteredEmptyRow = (query: string, tab: string, drop: string[], entityLabel: string, procedural: string) =>
    query ? (
      <li><FilteredEmptyState query={query} clearHref={clearHref(tab, drop)} entityLabel={entityLabel} /></li>
    ) : (
      emptyRow(procedural)
    )

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Licences', href: '/admin/licenses' }, { label: lic.licenseKey }]} />
      <BackButton fallback="/admin/licenses" label="Back to licences" />
      <EntityHero
        eyebrow="Licence"
        title={lic.licenseKey}
        subtitle={
          <>
            {lic.variant} · {lic.tier}
            {owner && <> · <Link className="underline" href={`/admin/users/${owner.id}`}>{owner.name}</Link></>}
            {org && <> @ <Link className="underline" href={`/admin/orgs/${org.id}`}>{org.name}</Link></>}
          </>
        }
        badges={[
          { label: lic.status, variant: lic.status === 'active' ? 'default' : lic.status === 'revoked' || lic.status === 'lapsed' ? 'destructive' : 'secondary' },
          ...(lic.cloudBackupEnabled ? [{ label: 'Cloud backup', variant: 'outline' as const }] : []),
        ]}
        stats={[
          { label: 'Variant', value: lic.variant },
          { label: 'Tier', value: lic.tier },
          { label: 'Machines', value: `${machinesTotal} / ${lic.maxMachines}` },
          { label: 'Branches', value: `0 / ${lic.maxBranches}` },
          { label: 'Maintenance', value: lic.maintenanceUntil ? formatDate(lic.maintenanceUntil) : '—' },
          { label: 'Paid', value: KES(totalPaid) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Issued" value={lic.paidAt ? formatDate(lic.paidAt) : null} />
                <Field label="Trial started" value={lic.trialStartedAt ? formatDate(lic.trialStartedAt) : null} />
                <Field label="Trial ends" value={lic.trialEndsAt ? formatDate(lic.trialEndsAt) : null} />
                <Field label="Major version cap" value={`v${lic.majorVersionCap}.x`} />
                <Field label="Modules" value={(lic.modules as string[]).join(', ') || '—'} />
                {lic.signedKey && <Field label="Signed key" value={<span className="font-mono text-[10px] break-all">{lic.signedKey.slice(0, 64)}…</span>} className="md:col-span-2" />}
              </div>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: machCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search machines by hostname, ID or status…" label="Search licence machines" paramName="machQ" pageParamName="machPage" />
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {licenseMachines.map((m) => (
                    <li key={m.id}>
                      <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{m.os ?? 'windows'} · {m.currentVersion ?? '—'} · {m.status}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}</span>
                      </Link>
                    </li>
                  ))}
                  {licenseMachines.length === 0 && filteredEmptyRow(machQ, 'machines', ['machQ', 'machPage'], 'machines', 'No machines bound.')}
                </ul>
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
                <AdminSearch placeholder="Search payments by reference, purpose or status…" label="Search licence payments" paramName="payQ" pageParamName="payPage" />
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {licensePayments.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{p.purpose}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{p.status} · {formatDate(p.createdAt)}</span>
                        </div>
                        <span className="font-mono text-[13px] tabular-nums">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}</span>
                      </Link>
                    </li>
                  ))}
                  {licensePayments.length === 0 && filteredEmptyRow(payQ, 'payments', ['payQ', 'payPage'], 'payments', 'No payments.')}
                </ul>
                <AdminPagination page={payPage} pageSize={PAGE_SIZE} total={payCount} pageParamName="payPage" label="Payments pages" />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">{label}</dt>
      <dd className="text-[14px] text-[var(--color-fg)]">{value || <span className="text-[var(--color-fg-subtle)]">—</span>}</dd>
    </div>
  )
}

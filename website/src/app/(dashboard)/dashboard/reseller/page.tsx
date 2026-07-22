/**
 * /dashboard/reseller — reseller-facing dashboard.
 *
 * Server-gated: only a user with a matching `resellers` row may see it.
 * Non-resellers are redirected to /dashboard with a notice. Nav visibility
 * is never the authorization boundary — this gate runs regardless.
 *
 * Shows the reseller's status + rolling totals, a searchable/paginated
 * table of the licences they've issued, and a recent commission ledger.
 * Issuing a new licence lives at /dashboard/reseller/new.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, eq, desc, ilike, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, resellers, licenses, resellerCommissions, user } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EntityHero } from '@/components/layout/entity-hero'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, StatusPill } from '@/components/dashboard/status-utils'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { ListPagination, ListSearch } from '@/components/dashboard/list-controls'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reseller · Omnix' }

const PAGE_SIZE = 25

export default async function ResellerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/reseller')

  const [reseller] = await db.select().from(resellers).where(eq(resellers.userId, session.user.id)).limit(1)
  if (!reseller) {
    redirect('/dashboard?notice=not_reseller')
  }

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Every read is scoped to this reseller's id. Search narrows within their
  // issued set (customer name/email or licence key) — never widens it.
  const issuedWhere = q
    ? and(
        eq(licenses.resellerId, reseller.id),
        or(
          ilike(user.email, `%${q}%`),
          ilike(user.name, `%${q}%`),
          ilike(licenses.licenseKey, `%${q}%`),
        ),
      )
    : eq(licenses.resellerId, reseller.id)

  const [issued, issuedTotalRow, commissions] = await Promise.all([
    db
      .select({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        variant: licenses.variant,
        status: licenses.status,
        createdAt: licenses.createdAt,
        userEmail: user.email,
        userName: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(issuedWhere)
      .orderBy(desc(licenses.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(issuedWhere),
    db
      .select()
      .from(resellerCommissions)
      .where(eq(resellerCommissions.resellerId, reseller.id))
      .orderBy(desc(resellerCommissions.createdAt))
      .limit(20),
  ])

  const issuedTotal = issuedTotalRow[0]?.n ?? 0
  const isSuspended = reseller.status === 'suspended'
  const fmtMoney = (n: number) => `${reseller.commissionCurrency} ${Math.round(n).toLocaleString()}`

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={[{ label: 'Reseller' }]} />
      <EntityHero
        eyebrow="Partner programs"
        title={`Reseller · ${reseller.companyName}`}
        subtitle={`Wholesale channel — your discount off retail is ${reseller.discountPercent}%.`}
        badges={[{ label: isSuspended ? 'Suspended' : 'Active', variant: isSuspended ? 'secondary' : 'default' }]}
        actions={
          isSuspended ? (
            <Button type="button" variant="outline" disabled title="Reactivate before issuing new licences">
              Suspended
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/reseller/new">Issue a licence</Link>
            </Button>
          )
        }
        stats={[
          { label: 'Licences issued', value: reseller.totalLicensesIssued.toLocaleString() },
          { label: 'Revenue brought', value: fmtMoney(reseller.totalRevenueBrought) },
          { label: 'Commission earned', value: fmtMoney(reseller.totalCommissionEarned), tone: 'positive' },
          {
            label: 'Unpaid commission',
            value: fmtMoney(reseller.unpaidCommission),
            tone: reseller.unpaidCommission > 0 ? 'warning' : 'muted',
          },
        ]}
      />

      {isSuspended ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)]/35 bg-[var(--color-caution)]/9 px-4 py-3 text-[13px] text-[var(--color-fg)]">
          Your reseller account is suspended — reactivate it with support before issuing new licences.
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Licences you&rsquo;ve issued
        </h2>
        <ListSearch label="Search issued licences" placeholder="Search customer or licence key…" />

        {issued.length === 0 ? (
          q ? (
            <FilteredEmptyState query={q} clearHref="/dashboard/reseller" entityLabel="issued licences" />
          ) : (
            <EmptyState
              title="No licences issued yet"
              body="Issue a licence for a customer and it will appear here with its status and commission."
              action={
                isSuspended ? undefined : (
                  <Button asChild>
                    <Link href="/dashboard/reseller/new">Issue a licence</Link>
                  </Button>
                )
              }
            />
          )
        ) : (
          <div className="flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issued.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="min-w-[160px]">
                      <div className="text-[var(--color-fg)]">{l.userName || '—'}</div>
                      <div className="text-[11px] text-[var(--color-fg-muted)]">{l.userEmail}</div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                      {l.variant}
                    </TableCell>
                    <TableCell>
                      <StatusPill kind="license" status={l.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                      {formatDate(l.createdAt)}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-[11px] text-[var(--color-fg-muted)]">{l.licenseKey}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination page={page} pageSize={PAGE_SIZE} total={issuedTotal} label="Issued licence pages" />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Recent commission
        </h2>
        {commissions.length === 0 ? (
          <EmptyState title="No commission entries yet" body="Commission accrues here each time an issued licence is paid." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {c.licenseId.slice(0, 12)}…
                    </code>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {c.currency} {Math.round(c.grossAmount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">
                    {c.currency} {Math.round(c.commissionAmount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusPill kind="commission" status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

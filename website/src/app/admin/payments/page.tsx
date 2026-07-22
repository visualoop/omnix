import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import Link from 'next/link'
import { CurrencyDollar } from '@phosphor-icons/react/dist/ssr'
import { db, payments, user } from '@/db'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminPagination,
  AdminSearch,
  AdminSelectFilter,
} from '@/components/admin/data-controls'

export const metadata = { title: 'Admin · Payments' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  { value: 'success', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

const PURPOSE_OPTIONS = [
  { value: 'license_fee', label: 'Licence fee' },
  { value: 'maintenance_renewal', label: 'Maintenance' },
  { value: 'major_upgrade', label: 'Major upgrade' },
  { value: 'cloud_backup', label: 'Cloud backup' },
  { value: 'extra_branch', label: 'Extra branch' },
  { value: 'extra_machine', label: 'Extra machine' },
]

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'success'
      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : status === 'pending'
        ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
        : 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      {status === 'success' ? 'Paid' : status}
    </span>
  )
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; purpose?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? ''
  const purpose = sp.purpose ?? ''

  const whereClauses = [
    q
      ? or(
          ilike(payments.paystackReference, `%${q}%`),
          ilike(user.email, `%${q}%`),
        )
      : null,
    status ? eq(payments.status, status) : null,
    purpose ? eq(payments.purpose, purpose) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses)

  const [rows, totalRow, revenueAll, revenue30] = await Promise.all([
    db
      .select({
        id: payments.id,
        paystackReference: payments.paystackReference,
        purpose: payments.purpose,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        customerEmail: user.email,
      })
      .from(payments)
      .leftJoin(user, eq(payments.userId, user.id))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).leftJoin(user, eq(payments.userId, user.id)).where(where),
    db
      .select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` })
      .from(payments)
      .where(eq(payments.status, 'success')),
    db
      .select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` })
      .from(payments)
      .where(sql`${payments.status} = 'success' AND ${payments.paidAt} >= now() - interval '30 days'`),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Payments"
        description="Every Paystack transaction. Filter by status or purpose, search by reference / customer email."
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            Lifetime revenue
          </div>
          <div className="mt-1 font-mono tabular-nums text-[24px]">
            <span className="text-[var(--color-fg-subtle)] text-[14px] mr-1">KES</span>
            {Number(revenueAll[0].sum ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            Last 30 days
          </div>
          <div className="mt-1 font-mono tabular-nums text-[24px]">
            <span className="text-[var(--color-fg-subtle)] text-[14px] mr-1">KES</span>
            {Number(revenue30[0].sum ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search by reference or customer email…" />
        <div className="flex items-center gap-4">
          <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
          <AdminSelectFilter paramName="purpose" label="Purpose" options={PURPOSE_OPTIONS} />
        </div>
      </div>

      {rows.length === 0 ? (
        q || status || purpose ? (
          <FilteredEmptyState
            query={q || undefined}
            clearHref="/admin/payments"
            entityLabel="payments"
          />
        ) : (
          <EmptyState
            icon={<CurrencyDollar weight="regular" className="size-8" />}
            title="No payments yet."
            description="Each Paystack transaction will land here."
          />
        )
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="min-w-[160px]">
                    <Link
                      href={`/admin/payments/${p.id}`}
                      className="font-mono text-[11px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline truncate block max-w-[220px]"
                    >
                      {p.paystackReference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[200px]">
                    {p.customerEmail ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                    {p.purpose.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="text-[var(--color-fg-subtle)] mr-1 text-[10px]">{p.currency}</span>
                    {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {(p.paidAt ?? p.createdAt) ? new Date(p.paidAt ?? p.createdAt).toISOString().slice(0, 10) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/payments/${p.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      Open →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}

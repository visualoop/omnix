import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { db, payments } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
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
import { ListPagination, ListSearch, ListSelectFilter } from '@/components/dashboard/list-controls'

export const metadata = { title: 'Payments' }

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'success', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'refunded', label: 'Refunded' },
]

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/payments')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? ''

  // Scoped to the signed-in customer; the reference search and status
  // filter only ever narrow within that owned set.
  const whereClauses = [
    eq(payments.userId, session.user.id),
    q ? ilike(payments.paystackReference, `%${q}%`) : null,
    status ? eq(payments.status, status) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where = whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).where(where),
  ])

  const total = totalRow[0]?.n ?? 0
  const filtered = Boolean(q || status)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Payments"
        title="Payments"
        description="Every charge from Paystack against your account — successes, pending attempts, failures and refunds. Open any row for its receipt."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ListSearch label="Search payments" placeholder="Search by reference…" />
        <ListSelectFilter label="Status" paramName="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <FilteredEmptyState query={q || undefined} clearHref="/dashboard/payments" entityLabel="payments" />
        ) : (
          <EmptyState
            title="No payments yet"
            body="When you buy or renew a licence, every Paystack charge and its receipt shows up here."
          />
        )
      ) : (
        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Receipt</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium capitalize">
                    {p.purpose.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/payments/${p.id}`}
                      className="block max-w-[200px] truncate font-mono text-[11px] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
                    >
                      {p.paystackReference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusPill kind="payment" status={p.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="mr-1 text-[10px] text-[var(--color-fg-subtle)]">{p.currency}</span>
                    {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {new Date(p.paidAt ?? p.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/payments/${p.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      Receipt →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListPagination page={page} pageSize={PAGE_SIZE} total={total} label="Payment pages" />
        </div>
      )}
    </div>
  )
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { db, payments } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
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

export const metadata = { title: 'Payments' }

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'success', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
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

  return (
    <div className="space-y-6">
      <PageHeading title="Payments" subtitle="Every charge from Paystack — successes, failures, refunds." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search by reference…" />
        <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 && total === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          {q || status ? 'No payments match that filter.' : 'No payments yet.'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.purpose.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/payments/${p.id}`}
                      className="font-mono text-[11px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline truncate block max-w-[200px]"
                    >
                      {p.paystackReference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="text-[var(--color-fg-subtle)] mr-1 text-[10px]">{p.currency}</span>
                    {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {new Date(p.paidAt ?? p.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/payments/${p.id}`}
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

import { desc, eq, sql } from 'drizzle-orm'
import { CurrencyDollar } from '@phosphor-icons/react/dist/ssr'
import { db, payments, user } from '@/db'
import { PaymentCard } from '@/components/admin/payment-card'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Payments' }
export const dynamic = 'force-dynamic'

const STATUSES = [
  { key: 'pending',  title: 'Pending',  hint: 'awaiting Paystack' },
  { key: 'success',  title: 'Paid',     hint: 'cleared' },
  { key: 'failed',   title: 'Failed',   hint: 'rejected or abandoned' },
] as const

export default async function AdminPaymentsPage() {
  // Pull recent payments and bucket them by status — no filtering, just visual organisation.
  const [recent, revenueAll, revenue30] = await Promise.all([
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
      .orderBy(desc(payments.createdAt))
      .limit(120),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(eq(payments.status, 'success')),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(sql`${payments.status} = 'success' AND ${payments.paidAt} >= now() - interval '30 days'`),
  ])

  const buckets = STATUSES.reduce<Record<string, typeof recent>>((acc, s) => {
    acc[s.key] = recent.filter((p) => p.status === s.key)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Payments"
        description="Every Paystack transaction, sorted into three columns. Each card is a receipt — purpose label, amount, reference, status."
      />

      {/* Revenue strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Lifetime revenue</div>
          <div className="mt-1 font-mono tabular-nums text-[24px] text-[var(--color-fg)]">
            <span className="text-[var(--color-fg-subtle)] text-[14px] mr-1">KES</span>
            {Number(revenueAll[0].sum ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Last 30 days</div>
          <div className="mt-1 font-mono tabular-nums text-[24px] text-[var(--color-fg)]">
            <span className="text-[var(--color-fg-subtle)] text-[14px] mr-1">KES</span>
            {Number(revenue30[0].sum ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          icon={<CurrencyDollar weight="regular" className="size-8" />}
          title="No payments yet."
          description="Each Paystack transaction lands in one of three columns: pending, paid, failed."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((s) => (
            <div key={s.key}>
              <header className="mb-3 flex items-baseline justify-between border-b border-[var(--color-border)] pb-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                  {s.title}
                  <span className="ml-2 font-mono tabular-nums text-[var(--color-fg-subtle)]">{buckets[s.key].length}</span>
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">{s.hint}</span>
              </header>
              {buckets[s.key].length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--color-border)] bg-transparent px-4 py-8 text-center text-[12px] text-[var(--color-fg-subtle)]">
                  None.
                </div>
              ) : (
                <div className="space-y-3">
                  {buckets[s.key].map((p) => <PaymentCard key={p.id} p={p} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { desc } from 'drizzle-orm'
import { db, payments } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Payments' }

export default async function AdminPaymentsPage() {
  const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Payments" description="Every Paystack transaction — successes, failures, refunds." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          None yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((p) => (
            <li key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-baseline gap-3 px-4 py-3 text-[13px]">
              <span>{p.purpose.replace(/_/g, ' ')}</span>
              <code className="font-mono text-[11px] text-[var(--color-fg-muted)]">{p.paystackReference}</code>
              <span className="font-mono tabular-nums">{p.currency} {p.amount.toLocaleString()}</span>
              <time className="font-mono text-[11px] text-[var(--color-fg-muted)]">{p.createdAt.toISOString().slice(0, 10)}</time>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{p.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

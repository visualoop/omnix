import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, payments } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Payments' }

export default async function PaymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/payments')

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, session.user.id))
    .orderBy(desc(payments.createdAt))
    .limit(50)

  return (
    <div className="space-y-6">
      <PageHeading title="Payments" subtitle="Every charge from Paystack — successes, failures, refunds." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No payments yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((p) => (
            <li key={p.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-3 text-[13px] items-center">
              <span className="text-[var(--color-fg)]">{p.purpose.replace(/_/g, ' ')}</span>
              <span className="font-mono text-[12px] text-[var(--color-fg-muted)]">{p.paystackReference}</span>
              <span className="font-mono tabular-nums">{p.currency} {p.amount.toLocaleString()}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{p.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

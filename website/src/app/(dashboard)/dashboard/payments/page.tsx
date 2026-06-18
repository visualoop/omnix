import { headers } from 'next/headers'
import Link from 'next/link'
import { Download, Receipt } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDashboardCustomer } from '@/lib/dashboard-helpers'
import {
  EmptyState,
  formatDate,
  PageHeading,
  StatusPill,
} from '@/components/dashboard/status-utils'

export const metadata = { title: 'Payments' }

export default async function PaymentsPage() {
  const reqHeaders = await headers()
  const customer = await getDashboardCustomer(reqHeaders)
  const user = customer as unknown as { id: string | number; email: string; fullName?: string; businessName?: string; collection?: string }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await payload.find({
    collection: 'payments',
    where: { customer: { equals: user.id } },
    sort: '-createdAt',
    limit: 100,
  })

  const payments = res.docs as unknown as {
    id: string
    paystackReference: string
    amount: number
    currency: string
    netAmount?: number
    paystackFees?: number
    status: string
    purpose: string
    channel?: string
    mpesaReceiptNumber?: string
    cardLast4?: string
    cardBrand?: string
    paidAt?: string
    createdAt: string
  }[]

  const totalPaid = payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + p.amount, 0)

  // Display total in the most-common currency on this customer's
  // successful payments. Mixed-currency totals would be misleading;
  // we pick the dominant one and show it as a prefix.
  const currencyHistogram = payments
    .filter((p) => p.status === 'success')
    .reduce<Record<string, number>>((acc, p) => {
      const c = p.currency || 'KES'
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    }, {})
  const dominantCurrency = Object.entries(currencyHistogram)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'KES'

  return (
    <div className="space-y-8">
      <PageHeading
        title="Payments"
        subtitle="Every Paystack transaction tied to your account, with downloadable receipts."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total paid" value={`${dominantCurrency} ${totalPaid.toLocaleString()}`} />
        <Stat label="Successful" value={String(payments.filter((p) => p.status === 'success').length)} />
        <Stat label="Latest" value={formatDate(payments[0]?.paidAt ?? payments[0]?.createdAt)} />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet."
          body="When you pay for a licence, the receipt and reference appear here."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <table className="w-full">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <tr>
                {['Reference', 'Date', 'Purpose', 'Channel', 'Amount', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-4 font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
                    {p.paystackReference}
                  </td>
                  <td className="px-5 py-4 font-mono text-[12px] tabular-nums text-[var(--color-fg-subtle)]">
                    {formatDate(p.paidAt ?? p.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-[13px] text-[var(--color-fg)]">
                    {p.purpose.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-4 text-[12px] text-[var(--color-fg-muted)]">
                    {p.channel === 'card' && p.cardLast4
                      ? `${p.cardBrand ?? 'Card'} ··${p.cardLast4}`
                      : p.channel === 'mpesa' && p.mpesaReceiptNumber
                        ? `M-Pesa · ${p.mpesaReceiptNumber}`
                        : p.channel ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
                    {p.currency} {p.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill kind="payment" status={p.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {p.status === 'success' ? (
                      <Link
                        href={`/api/payments/${p.id}/receipt`}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                      >
                        <Download className="size-3.5" />
                        Receipt
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-2 font-display text-[22px] font-medium text-[var(--color-fg)]">
        {value}
      </div>
    </div>
  )
}

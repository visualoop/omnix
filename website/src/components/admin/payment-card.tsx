import { CheckCircle, XCircle, ClockCounterClockwise, ArrowsClockwise } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface PaymentLike {
  id: string
  paystackReference: string
  purpose: string | null
  amount: number
  currency: string | null
  status: string | null
  createdAt: Date
  paidAt?: Date | null
  customerEmail?: string | null
}

const STATUS_INFO: Record<string, { label: string; tone: string; Icon: React.ComponentType<{ weight?: 'fill' | 'regular' | 'bold'; className?: string }> }> = {
  success:  { label: 'Paid',     tone: 'var(--color-positive)', Icon: CheckCircle },
  pending:  { label: 'Pending',  tone: 'var(--color-caution)',  Icon: ClockCounterClockwise },
  failed:   { label: 'Failed',   tone: 'var(--color-negative)', Icon: XCircle },
  refunded: { label: 'Refunded', tone: 'var(--color-fg-muted)', Icon: ArrowsClockwise },
  unknown:  { label: 'Unknown',  tone: 'var(--color-fg-subtle)', Icon: ClockCounterClockwise },
}

/**
 * PaymentCard — a receipt-paper-styled tile with the amount as the
 * hero, mono reference, and status-coloured icon. The card has a
 * subtle perforation effect on the bottom edge via a gradient mask.
 */
export function PaymentCard({ p }: { p: PaymentLike }) {
  const info = STATUS_INFO[p.status ?? 'unknown'] ?? STATUS_INFO.unknown
  const Icon = info.Icon
  return (
    <Link
      href={`/admin/payments/${p.id}`}
      className="relative block rounded-md border bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors px-5 py-4 cursor-pointer"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            {(p.purpose ?? 'unknown').replace(/_/g, ' ')}
          </div>
          <div className="mt-1 font-mono tabular-nums text-[20px] leading-tight text-[var(--color-fg)]">
            <span className="text-[var(--color-fg-subtle)] text-[12px] mr-1">{p.currency ?? 'KES'}</span>
            {p.amount.toLocaleString()}
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: info.tone }}>
          <Icon weight="fill" className="size-3.5" />
          {info.label}
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--color-border)] pt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
        <code className="truncate">{p.paystackReference}</code>
        <time>
          {(p.paidAt ?? p.createdAt).toISOString().slice(0, 10)}
        </time>
      </div>

      {p.customerEmail && (
        <div className="mt-1.5 truncate text-[11px] text-[var(--color-fg-muted)]">
          {p.customerEmail}
        </div>
      )}
    </Link>
  )
}

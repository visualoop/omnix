'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, StatusPill } from '@/components/dashboard/status-utils'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format-date'

interface Affiliate {
  id: string
  refCode: string
  displayName: string | null
  contactPhone: string | null
  contactEmail: string | null
  payoutMethod: string | null
  commissionPercent: number
  totalReferralsCredited: number
  totalCommissionEarned: number
  unpaidBalance: number
  commissionCurrency: string
  blocked: boolean
  blockedReason: string | null
}

interface Credit {
  id: string
  gross: number
  commission: number
  currency: string
  status: string
  createdAt: string
}

interface Props {
  initialAffiliate: Affiliate | null
  referralUrl: string
  credits: Credit[]
}

export function AffiliateClient({ initialAffiliate, referralUrl, credits }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [payoutMethod, setPayoutMethod] = useState<'mpesa_number' | 'paystack_transfer' | ''>('')
  const [mpesaNumber, setMpesaNumber] = useState('')
  const [copied, setCopied] = useState(false)

  const signup = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          payoutMethod: payoutMethod || undefined,
          payoutDetails:
            payoutMethod === 'mpesa_number' && mpesaNumber.trim() ? { mpesa: mpesaNumber.trim() } : undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setError(j.error || 'Failed to sign up')
        return
      }
      router.refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const selectClass = cn(
    'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3',
    'font-sans text-[14px] text-[var(--color-fg)] outline-none',
    'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
  )

  if (!initialAffiliate) {
    return (
      <form
        className="flex max-w-2xl flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          signup()
        }}
      >
        <Alert variant="info" title="Earn a third of any licence you refer">
          You&rsquo;ll get a unique link. Share it with businesses that need Omnix. When they pay for
          their licence, you earn 33% of their first purchase — no compounding on renewals, so nobody
          games it. Payouts monthly by M-Pesa (or bank transfer when we wire it).
        </Alert>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Display name" optional>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or business"
            />
          </Field>
          <Field label="Phone" description="So we can reach you about payouts." optional>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+254 700 000 000"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="affiliate-payout">How would you like to be paid?</Label>
          <select
            id="affiliate-payout"
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value as typeof payoutMethod)}
            className={selectClass}
          >
            <option value="">Decide later</option>
            <option value="mpesa_number">M-Pesa (phone number)</option>
            <option value="paystack_transfer">Paystack Transfer (bank)</option>
          </select>
        </div>

        {payoutMethod === 'mpesa_number' ? (
          <Field label="M-Pesa number">
            <Input value={mpesaNumber} onChange={(e) => setMpesaNumber(e.target.value)} placeholder="0712345678" />
          </Field>
        ) : null}

        {error ? (
          <Alert variant="error" title="Could not sign up">
            {error}
          </Alert>
        ) : null}

        <div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing up…' : 'Get my referral link'}
          </Button>
        </div>
      </form>
    )
  }

  const aff = initialAffiliate
  const money = (n: number) => `${aff.commissionCurrency} ${Math.round(n).toLocaleString()}`

  return (
    <div className="flex flex-col gap-8">
      {aff.blocked ? (
        <Alert variant="error" title="Affiliate account blocked">
          {aff.blockedReason ? aff.blockedReason : 'Contact support to restore your affiliate account.'}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          Your referral link
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 select-all break-all font-mono text-[13px] text-[var(--color-fg)]">
            {referralUrl}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={copy} className="shrink-0 max-sm:w-full">
            <Copy className="size-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-[11px] leading-6 text-[var(--color-fg-muted)]">
          Share this link anywhere. When someone clicks it and buys a licence within 30 days, you earn{' '}
          {aff.commissionPercent}% of their first purchase. Your ref code:{' '}
          <code className="font-mono text-[var(--color-fg)]">{aff.refCode}</code>
        </p>
      </section>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-8 gap-y-4 border-y border-[var(--color-border)] py-5">
        <Stat label="Referrals credited" value={aff.totalReferralsCredited.toLocaleString()} />
        <Stat label="Commission earned" value={money(aff.totalCommissionEarned)} tone="positive" />
        <Stat label="Unpaid balance" value={money(aff.unpaidBalance)} note="Paid out monthly" />
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Recent credits
        </h2>
        {credits.length === 0 ? (
          <EmptyState
            title="No credits yet"
            body="Share your referral link with a business that needs Omnix — your first credit lands here when they pay."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Your commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credits.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {c.currency} {Math.round(c.gross).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">
                    {c.currency} {Math.round(c.commission).toLocaleString()}
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

function Stat({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: string
  tone?: 'positive'
  note?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-mono text-[20px] font-medium leading-tight tabular-nums',
          tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-fg)]',
        )}
      >
        {value}
      </dd>
      {note ? <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">{note}</p> : null}
    </div>
  )
}

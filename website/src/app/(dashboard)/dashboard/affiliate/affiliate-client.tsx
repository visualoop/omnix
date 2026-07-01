'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from '@phosphor-icons/react'

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
  fmtDate: (iso: string) => string
}

export function AffiliateClient({ initialAffiliate, referralUrl, credits, fmtDate }: Props) {
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
          payoutDetails: payoutMethod === 'mpesa_number' && mpesaNumber.trim() ? { mpesa: mpesaNumber.trim() } : undefined,
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
    } catch { /* ignore */ }
  }

  if (!initialAffiliate) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-sm">
          <div className="font-medium">Earn one third of any licence you refer</div>
          <p className="mt-1 text-xs text-muted-foreground">
            You&rsquo;ll get a unique link. Share it with businesses that need Omnix. When they
            pay for their licence, you earn 33% of their first purchase. No compounding on
            renewals, so nobody games it. Payouts monthly by M-Pesa (or bank Transfer when we
            wire it).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs">Display name (public, optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or business"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs">Phone (for us to reach you)</span>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+254 700 000 000"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs">How would you like to be paid?</span>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as typeof payoutMethod)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Decide later</option>
              <option value="mpesa_number">M-Pesa (phone number)</option>
              <option value="paystack_transfer">Paystack Transfer (bank)</option>
            </select>
          </label>
          {payoutMethod === 'mpesa_number' ? (
            <label className="block col-span-2">
              <span className="text-xs">M-Pesa number</span>
              <input
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="0712345678"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          ) : null}
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <button
          onClick={signup}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Signing up…' : 'Get my referral link'}
        </button>
      </div>
    )
  }

  const aff = initialAffiliate
  const suspended = aff.blocked
  const money = (n: number) => `${aff.commissionCurrency} ${Math.round(n).toLocaleString()}`

  return (
    <div className="space-y-6">
      {suspended ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Your affiliate account is blocked{aff.blockedReason ? `: ${aff.blockedReason}` : '.'}
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Your referral link</div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 select-all text-sm font-mono text-foreground">{referralUrl}</code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40"
          >
            <Copy className="size-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Share this link anywhere. When someone clicks it and buys a licence within 30 days, you earn {aff.commissionPercent}% of their first purchase.
          Your ref code: <code className="font-mono">{aff.refCode}</code>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Referrals credited" value={aff.totalReferralsCredited.toString()} />
        <Stat label="Commission earned" value={money(aff.totalCommissionEarned)} accent />
        <Stat label="Unpaid balance" value={money(aff.unpaidBalance)} note="Paid out monthly" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent credits</h2>
        {credits.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No credits yet. Share your link.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <Th>Date</Th>
                  <Th>Gross</Th>
                  <Th>Your commission</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</Td>
                    <Td className="tabular-nums">{c.currency} {Math.round(c.gross).toLocaleString()}</Td>
                    <Td className="tabular-nums font-medium">{c.currency} {Math.round(c.commission).toLocaleString()}</Td>
                    <Td>
                      <StatusPill status={c.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent, note }: { label: string; value: string; accent?: boolean; note?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {note ? <div className="mt-1 text-[11px] text-muted-foreground">{note}</div> : null}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    reversed: 'bg-destructive/10 text-destructive',
    rejected_self_referral: 'bg-muted text-muted-foreground',
    rejected_repeat: 'bg-muted text-muted-foreground',
  }
  const label: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid out',
    reversed: 'Reversed',
    rejected_self_referral: 'Rejected · self',
    rejected_repeat: 'Rejected · repeat',
  }
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${map[status] ?? 'bg-muted text-muted-foreground'}`}>{label[status] ?? status}</span>
}

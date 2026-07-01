'use client'

import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'

type Variant = 'dawa' | 'retail' | 'hospitality' | 'hardware'
const VARIANTS: Array<{ id: Variant; label: string; desc: string }> = [
  { id: 'dawa', label: 'Dawa', desc: 'Pharmacy — prescriptions, expiry, SHA + private insurance, controlled subs' },
  { id: 'retail', label: 'Retail', desc: 'General retail — supermarket, mini-mart, salon, spa' },
  { id: 'hospitality', label: 'Hospitality', desc: 'Restaurants, bars, quick-service — KOT, tables, recipe cost' },
  { id: 'hardware', label: 'Hardware', desc: 'Hardware store — bulk pricing, contractor accounts, quote-to-invoice' },
]

interface Props {
  currency: string
  symbol: string
  retail: number
  wholesale: number
  discountPercent: number
}

interface Result {
  ok: true
  licenseId: string
  customerId: string
  wholesale: number
  retail: number
  savings: number
  currency: string
  paystack: { reference: string; authorizationUrl: string; accessCode: string }
}

export function IssueLicenseForm(props: Props) {
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [country, setCountry] = useState('KE')
  const [variant, setVariant] = useState<Variant>('dawa')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const submit = async () => {
    if (!customerName.trim()) {
      setError('Customer / organisation name is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reseller/issue-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          country,
          currency: props.currency,
          variant,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setError(j.error || 'Failed to create licence')
        return
      }
      setResult(j as Result)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
            <CheckCircle weight="fill" className="size-5" />
            <span className="text-sm font-medium">Licence issued (pending payment)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click <strong>Pay now</strong> below to complete the wholesale purchase. On successful
            payment the customer gets an activated licence emailed to them, and your commission is
            credited to your ledger.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retail price</span>
            <span className="tabular-nums line-through">
              {props.symbol} {result.retail.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span>You pay (wholesale)</span>
            <span className="tabular-nums text-primary">
              {props.symbol} {result.wholesale.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
            <span>Your margin</span>
            <span className="tabular-nums">{props.symbol} {result.savings.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <a
            href={result.paystack.authorizationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Pay now →
          </a>
          <a
            href="/dashboard/reseller"
            className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm hover:bg-accent"
          >
            Back to dashboard
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Reference: <code className="font-mono">{result.paystack.reference}</code>
          <br />
          If the customer already had an Omnix account with the email you provided, the licence
          was added to that account. Otherwise a new account was created for them.
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Customer / organisation" required>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Naivas Chemist Kilifi"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+254 700 000 000"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>
        <Field label="Email (optional)" help="If provided, receives the licence key + download link.">
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="owner@example.com"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>
        <Field label="Country">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {['KE', 'UG', 'TZ', 'RW', 'NG', 'GH', 'ZA'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Which module?">
        <div className="grid grid-cols-2 gap-2">
          {VARIANTS.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setVariant(v.id)}
              className={`rounded-md border p-3 text-left ${
                variant === v.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="text-sm font-medium">Omnix {v.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{v.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-lg border border-border p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Retail (customer sees)</span>
          <span className="tabular-nums line-through">{props.symbol} {props.retail.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>You pay ({props.discountPercent}% off)</span>
          <span className="tabular-nums text-primary">{props.symbol} {props.wholesale.toLocaleString()}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <a
          href="/dashboard/reseller"
          className="h-10 grid place-items-center px-4 rounded-md border border-border text-sm hover:bg-accent"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Continue to payment →'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string
  help?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {help ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{help}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  )
}

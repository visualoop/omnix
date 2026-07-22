'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/cn'

type Variant = 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'
const VARIANTS: Array<{ id: Variant; label: string; desc: string }> = [
  { id: 'dawa', label: 'Dawa', desc: 'Pharmacy — prescriptions, expiry, SHA + private insurance, controlled subs' },
  { id: 'retail', label: 'Retail', desc: 'General retail — supermarket, mini-mart, duka' },
  { id: 'hospitality', label: 'Hospitality', desc: 'Restaurants, bars, quick-service — KOT, tables, recipe cost' },
  { id: 'hardware', label: 'Hardware', desc: 'Hardware store — bulk pricing, contractor accounts, quote-to-invoice' },
  { id: 'salon', label: 'Salon & Spa', desc: 'Salons, barbershops, spas — appointments, staff commissions, packages' },
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

  const selectClass = cn(
    'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3',
    'font-sans text-[14px] text-[var(--color-fg)] outline-none',
    'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
  )

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success" title="Licence issued (pending payment)">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-[var(--color-positive)]" />
            Click <strong>Pay now</strong> to complete the wholesale purchase. On successful payment the
            customer gets an activated licence emailed to them, and your commission is credited.
          </span>
        </Alert>

        <dl className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-[var(--color-fg-muted)]">Retail price</dt>
            <dd className="font-mono tabular-nums line-through">
              {props.symbol} {result.retail.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>You pay (wholesale)</dt>
            <dd className="font-mono tabular-nums text-[var(--color-accent)]">
              {props.symbol} {result.wholesale.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between text-[var(--color-positive)]">
            <dt>Your margin</dt>
            <dd className="font-mono tabular-nums">
              {props.symbol} {result.savings.toLocaleString()}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={result.paystack.authorizationUrl} target="_blank" rel="noopener noreferrer">
              Pay now →
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/reseller">Back to dashboard</Link>
          </Button>
        </div>

        <p className="text-[11px] leading-6 text-[var(--color-fg-muted)]">
          Reference: <code className="font-mono text-[var(--color-fg)]">{result.paystack.reference}</code>
          <br />
          If the customer already had an Omnix account with the email you provided, the licence was added
          to that account. Otherwise a new account was created for them.
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer / organisation" required>
          <Input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Naivas Chemist Kilifi"
          />
        </Field>
        <Field label="Phone" optional>
          <Input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+254 700 000 000"
          />
        </Field>
        <Field
          label="Email"
          description="If provided, receives the licence key + download link."
          optional
        >
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="owner@example.com"
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue-country">Country</Label>
          <select
            id="issue-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={selectClass}
          >
            {['KE', 'UG', 'TZ', 'RW', 'NG', 'GH', 'ZA'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-ui text-[12px] font-semibold leading-5 text-[var(--color-fg)]">
          Which product?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VARIANTS.map((v) => {
            const selected = variant === v.id
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => setVariant(v.id)}
                aria-pressed={selected}
                className={cn(
                  'rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-[var(--duration-fast)]',
                  selected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-fg-subtle)]',
                )}
              >
                <div className="text-[14px] font-medium text-[var(--color-fg)]">Omnix {v.label}</div>
                <div className="mt-1 text-[11px] leading-5 text-[var(--color-fg-muted)]">{v.desc}</div>
              </button>
            )
          })}
        </div>
      </fieldset>

      <dl className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-[var(--color-fg-muted)]">Retail (customer sees)</dt>
          <dd className="font-mono tabular-nums line-through">
            {props.symbol} {props.retail.toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between font-medium">
          <dt>You pay ({props.discountPercent}% off)</dt>
          <dd className="font-mono tabular-nums text-[var(--color-accent)]">
            {props.symbol} {props.wholesale.toLocaleString()}
          </dd>
        </div>
      </dl>

      {error ? (
        <Alert variant="error" title="Could not create licence">
          {error}
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/reseller">Cancel</Link>
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Continue to payment →'}
        </Button>
      </div>
    </form>
  )
}

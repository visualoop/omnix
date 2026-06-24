'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CaretLeft, CaretRight, Check } from '@phosphor-icons/react'

interface WizardData {
  businessName: string
  country: string
  currency: string
  employeeCount: string
  phone: string
  kraPin: string
  variant: string
}

const COUNTRIES = [
  { value: 'KE', label: 'Kenya', currency: 'KES' },
  { value: 'UG', label: 'Uganda', currency: 'UGX' },
  { value: 'TZ', label: 'Tanzania', currency: 'TZS' },
  { value: 'RW', label: 'Rwanda', currency: 'RWF' },
  { value: 'NG', label: 'Nigeria', currency: 'NGN' },
  { value: 'ZA', label: 'South Africa', currency: 'ZAR' },
  { value: 'GH', label: 'Ghana', currency: 'GHS' },
  { value: 'OTHER', label: 'Other', currency: 'USD' },
]

const TEAM_SIZES = [
  { value: '1', label: 'Just me' },
  { value: '2-5', label: '2 – 5 people' },
  { value: '6-15', label: '6 – 15 people' },
  { value: '16-50', label: '16 – 50 people' },
  { value: '50+', label: '50+ people' },
]

const VARIANTS = [
  { value: 'dawa', label: 'Dawa', tagline: 'Pharmacy & chemist — KRA eTIMS, SHA, expiry, prescriptions' },
  { value: 'retail', label: 'Retail', tagline: 'Shops, mini-marts, dukas — variants, brands, layby' },
  { value: 'hardware', label: 'Hardware', tagline: 'Hardware stores — bulk pricing, contractors, parts' },
  { value: 'hospitality', label: 'Hospitality', tagline: 'Restaurants, bars — KOT, tables, recipe costing' },
  { value: 'pro', label: 'Pro', tagline: 'Generic services — invoicing, expenses, no inventory' },
]

interface Props {
  initial?: Partial<WizardData>
  onComplete?: (data: WizardData) => void
}

/**
 * 6-step onboarding wizard. Runs the first time a user lands on the
 * dashboard with no business name set. Captures the minimum the
 * licence-issuance flow needs:
 *
 *   1. Business name
 *   2. Country
 *   3. Currency (defaults from country)
 *   4. Team size
 *   5. Contact (phone + WhatsApp)
 *   6. Tax (KRA PIN; optional outside Kenya)
 *   7. Variant pick (one of: dawa | retail | hardware | hospitality | pro)
 *
 * Edits the user record via PATCH /api/customers/me, then routes to
 * /dashboard?variant=X to trigger the trial wizard.
 */
export function OnboardingWizard({ initial, onComplete }: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<WizardData>({
    businessName: initial?.businessName ?? '',
    country: initial?.country ?? 'KE',
    currency: initial?.currency ?? 'KES',
    employeeCount: initial?.employeeCount ?? '',
    phone: initial?.phone ?? '',
    kraPin: initial?.kraPin ?? '',
    variant: initial?.variant ?? 'dawa',
  })

  const steps: Array<{
    title: string
    eyebrow: string
    valid: () => boolean
    optional?: boolean
    render: () => React.ReactNode
  }> = [
    {
      eyebrow: 'Step 1 of 7',
      title: 'What\'s your business called?',
      valid: () => data.businessName.trim().length >= 2,
      render: () => (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            autoFocus
            value={data.businessName}
            onChange={(e) => setData({ ...data, businessName: e.target.value })}
            placeholder="e.g. Acme Pharmacy"
            className="rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-[15px] outline-none focus:border-foreground/40"
          />
          <p className="text-[12px] text-muted-foreground">
            This is what shows up on receipts, invoices, and the customer display.
          </p>
        </div>
      ),
    },
    {
      eyebrow: 'Step 2 of 7',
      title: 'Where do you operate?',
      valid: () => !!data.country,
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map((c) => {
            const active = data.country === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setData({ ...data, country: c.value, currency: c.currency })}
                className={
                  'rounded-md border px-3 py-2.5 text-left text-[14px] cursor-pointer transition-colors ' +
                  (active
                    ? 'border-foreground bg-foreground/[0.06] text-foreground'
                    : 'border-foreground/15 hover:border-foreground/30')
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      eyebrow: 'Step 3 of 7',
      title: 'Confirm your currency',
      valid: () => data.currency.length === 3,
      render: () => (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            maxLength={3}
            value={data.currency}
            onChange={(e) => setData({ ...data, currency: e.target.value.toUpperCase() })}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2.5 font-mono text-[15px] outline-none focus:border-foreground/40 max-w-[120px]"
          />
          <p className="text-[12px] text-muted-foreground">
            ISO 4217 code, e.g. KES, UGX, USD. Defaults from your country choice.
          </p>
        </div>
      ),
    },
    {
      eyebrow: 'Step 4 of 7',
      title: 'How big is your team?',
      valid: () => true, // optional — defaults to "" if skipped
      optional: true,
      render: () => (
        <div className="grid grid-cols-1 gap-2">
          {TEAM_SIZES.map((t) => {
            const active = data.employeeCount === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setData({ ...data, employeeCount: t.value })}
                className={
                  'rounded-md border px-3 py-2.5 text-left text-[14px] cursor-pointer transition-colors ' +
                  (active
                    ? 'border-foreground bg-foreground/[0.06] text-foreground'
                    : 'border-foreground/15 hover:border-foreground/30')
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      eyebrow: 'Step 5 of 7',
      title: 'What number can we reach you on?',
      valid: () => data.phone.replace(/\s+/g, '').length >= 9,
      render: () => (
        <div className="flex flex-col gap-2">
          <input
            type="tel"
            autoFocus
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            placeholder={data.country === 'KE' ? '+254 7XX XXX XXX' : '+...'}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-[15px] outline-none focus:border-foreground/40"
          />
          <p className="text-[12px] text-muted-foreground">
            We'll only message you for licence keys, payment receipts, or critical alerts.
          </p>
        </div>
      ),
    },
    {
      eyebrow: 'Step 6 of 7',
      title: data.country === 'KE' ? 'Your KRA PIN (optional)' : 'Your tax ID (optional)',
      valid: () => true, // optional
      optional: true,
      render: () => (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={data.kraPin}
            onChange={(e) => setData({ ...data, kraPin: e.target.value.toUpperCase() })}
            placeholder={data.country === 'KE' ? 'P051XXXXXXXM' : 'Tax ID'}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2.5 font-mono text-[15px] outline-none focus:border-foreground/40"
          />
          <p className="text-[12px] text-muted-foreground">
            {data.country === 'KE'
              ? 'Required for KRA eTIMS sale signing + VAT3 returns. You can add this later.'
              : 'For tax receipts. You can add this later.'}
          </p>
        </div>
      ),
    },
    {
      eyebrow: 'Step 7 of 7',
      title: 'Pick your starting module',
      valid: () => !!data.variant,
      render: () => (
        <div className="flex flex-col gap-2">
          {VARIANTS.map((v) => {
            const active = data.variant === v.value
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => setData({ ...data, variant: v.value })}
                className={
                  'flex flex-col gap-0.5 rounded-md border px-3 py-2.5 text-left cursor-pointer transition-colors ' +
                  (active
                    ? 'border-foreground bg-foreground/[0.06] text-foreground'
                    : 'border-foreground/15 hover:border-foreground/30')
                }
              >
                <span className="text-[14px] font-medium">{v.label}</span>
                <span className="text-[12px] text-muted-foreground">{v.tagline}</span>
              </button>
            )
          })}
          <p className="mt-2 text-[12px] text-muted-foreground">
            You can run more than one module in the same business — pick the one you'll use first.
            Each starts with a 30-day trial.
          </p>
        </div>
      ),
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  async function handleNext() {
    if (!current.valid()) return
    if (!isLast) {
      setStep(step + 1)
      return
    }
    // Final step — submit
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/customers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: undefined, // leave name as-is
          businessName: data.businessName,
          phone: data.phone,
          kraPin: data.kraPin,
          employeeCount: data.employeeCount,
          country: data.country,
          currency: data.currency,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
        throw new Error(j?.errors?.[0]?.message ?? 'Could not save')
      }
      onComplete?.(data)
      router.push(`/dashboard?variant=${encodeURIComponent(data.variant)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Progress bar */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={
                'h-[3px] flex-1 rounded-full transition-colors ' +
                (i <= step ? 'bg-foreground' : 'bg-foreground/15')
              }
            />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {current.eyebrow}
            </span>
            {current.optional && (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                · Optional
              </span>
            )}
          </div>
          <h1
            style={{ fontFamily: 'var(--font-display, serif)' }}
            className="text-[clamp(24px,3vw,32px)] font-medium leading-[1.1] tracking-[-0.01em]"
          >
            {current.title}
          </h1>
        </div>

        <div className="flex flex-col gap-3">{current.render()}</div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
          >
            <CaretLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            {current.optional && !isLast && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={submitting}
                className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                Skip for now
              </button>
            )}
            <Button onClick={handleNext} disabled={!current.valid() || submitting}>
              {submitting ? 'Saving…' : isLast ? 'Finish' : 'Next'}
              {isLast ? <Check className="h-3.5 w-3.5" /> : <CaretRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

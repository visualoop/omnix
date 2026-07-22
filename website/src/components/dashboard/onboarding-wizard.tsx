'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ArrowLeft, ArrowRight, Check } from '@/components/icons'
import { cn } from '@/lib/cn'

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
  { value: 'salon', label: 'Salon & Spa', tagline: 'Salons, barbershops, spas — appointments, commissions, packages' },
  { value: 'pro', label: 'Pro', tagline: 'Generic services — invoicing, expenses, no inventory' },
]

interface Props {
  initial?: Partial<WizardData>
  onComplete?: (data: WizardData) => void
}

/**
 * First-run onboarding wizard. Runs once when a signed-in buyer account
 * lands on the dashboard without a business name. Captures the minimum the
 * licence-issuance flow needs, then hands off to the dashboard.
 *
 * This is account setup, not a purchase — it never charges anything, does
 * not start a trial, and does not change the commerce flow.
 */
export function OnboardingWizard({ initial, onComplete }: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
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
    eyebrow: string
    title: string
    optional?: boolean
    valid: () => boolean
    render: () => React.ReactNode
  }> = [
    {
      eyebrow: 'Step 1 of 7',
      title: 'What’s your business called?',
      valid: () => data.businessName.trim().length >= 2,
      render: () => (
        <Field
          label="Business name"
          required
          description="Shown on receipts, invoices, and the customer display."
        >
          <Input
            type="text"
            name="businessName"
            autoComplete="organization"
            value={data.businessName}
            onChange={(e) => setData({ ...data, businessName: e.target.value })}
            placeholder="e.g. Acme Pharmacy"
          />
        </Field>
      ),
    },
    {
      eyebrow: 'Step 2 of 7',
      title: 'Where do you operate?',
      valid: () => !!data.country,
      render: () => (
        <ChoiceGrid
          legend="Country of operation"
          columns={2}
          value={data.country}
          onChange={(value) => {
            const match = COUNTRIES.find((c) => c.value === value)
            setData({ ...data, country: value, currency: match?.currency ?? data.currency })
          }}
          options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
        />
      ),
    },
    {
      eyebrow: 'Step 3 of 7',
      title: 'Confirm your currency',
      valid: () => data.currency.trim().length === 3,
      render: () => (
        <Field
          label="Currency"
          required
          description="ISO 4217 code, e.g. KES, UGX, USD. Defaults from your country."
        >
          <Input
            type="text"
            name="currency"
            inputMode="text"
            autoCapitalize="characters"
            maxLength={3}
            value={data.currency}
            onChange={(e) => setData({ ...data, currency: e.target.value.toUpperCase() })}
            className="max-w-[140px] font-mono uppercase tracking-[0.14em]"
          />
        </Field>
      ),
    },
    {
      eyebrow: 'Step 4 of 7',
      title: 'How big is your team?',
      optional: true,
      valid: () => true,
      render: () => (
        <ChoiceGrid
          legend="Team size"
          columns={1}
          value={data.employeeCount}
          onChange={(value) => setData({ ...data, employeeCount: value })}
          options={TEAM_SIZES}
        />
      ),
    },
    {
      eyebrow: 'Step 5 of 7',
      title: 'What number can we reach you on?',
      valid: () => data.phone.replace(/\s+/g, '').length >= 9,
      render: () => (
        <Field
          label="Phone"
          required
          description="Only for licence keys, payment receipts, or critical alerts."
        >
          <Input
            type="tel"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            placeholder={data.country === 'KE' ? '+254 7XX XXX XXX' : '+…'}
          />
        </Field>
      ),
    },
    {
      eyebrow: 'Step 6 of 7',
      title: data.country === 'KE' ? 'Your KRA PIN' : 'Your tax ID',
      optional: true,
      valid: () => true,
      render: () => (
        <Field
          label={data.country === 'KE' ? 'KRA PIN' : 'Tax ID'}
          optional
          description={
            data.country === 'KE'
              ? 'Needed for KRA eTIMS sale signing and VAT3 returns. You can add this later.'
              : 'For tax receipts. You can add this later.'
          }
        >
          <Input
            type="text"
            name="taxId"
            autoCapitalize="characters"
            value={data.kraPin}
            onChange={(e) => setData({ ...data, kraPin: e.target.value.toUpperCase() })}
            placeholder={data.country === 'KE' ? 'P051XXXXXXXM' : 'Tax ID'}
            className="font-mono uppercase tracking-[0.08em]"
          />
        </Field>
      ),
    },
    {
      eyebrow: 'Step 7 of 7',
      title: 'Pick your starting module',
      valid: () => !!data.variant,
      render: () => (
        <div className="flex flex-col gap-3">
          <ChoiceGrid
            legend="Starting module"
            columns={1}
            value={data.variant}
            onChange={(value) => setData({ ...data, variant: value })}
            options={VARIANTS.map((v) => ({ value: v.value, label: v.label, hint: v.tagline }))}
          />
          <p className="text-[12px] leading-5 text-[var(--color-fg-subtle)]">
            You can run more than one module in the same business — pick the one you&apos;ll use
            first. Buy its perpetual licence any time from the dashboard.
          </p>
        </div>
      ),
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  // Move focus to the step heading on each transition so keyboard and
  // screen-reader users are placed at the top of the new step.
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  async function handleNext() {
    if (!current.valid()) return
    if (!isLast) {
      setStep(step + 1)
      return
    }
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
        throw new Error(j?.errors?.[0]?.message ?? 'We could not save your details. Try again.')
      }
      onComplete?.(data)
      router.push(`/dashboard?variant=${encodeURIComponent(data.variant)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not save your details. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="eyebrow-plain">Set up Omnix</p>
          <p className="text-[13px] leading-6 text-[var(--color-fg-muted)]">
            A few details so licences, receipts, and tax documents carry the right information.
          </p>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-[3px] flex-1 rounded-[var(--radius-pill)] transition-colors',
                  i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]',
                )}
              />
            ))}
          </div>
        </div>

        {/* Step */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
              aria-live="polite"
            >
              {current.eyebrow}
              {current.optional ? ' · Optional' : ''}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-[clamp(24px,3.4vw,32px)] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--color-fg)] outline-none"
            >
              {current.title}
            </h1>
          </div>

          <div>{current.render()}</div>

          {error ? (
            <Alert variant="error" title="Couldn’t save">
              {error}
            </Alert>
          ) : null}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {current.optional && !isLast ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(step + 1)}
                disabled={submitting}
              >
                Skip for now
              </Button>
            ) : null}
            <Button type="button" onClick={handleNext} disabled={!current.valid() || submitting} aria-busy={submitting}>
              {submitting ? 'Saving…' : isLast ? 'Finish' : 'Next'}
              {isLast ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
            </Button>
          </div>
        </div>

        <p className="border-t border-[var(--color-border)] pt-5 text-[12px] leading-5 text-[var(--color-fg-subtle)]">
          Omnix is a one-time purchase per device, not a subscription — you own the version you
          buy, and compliance updates renew yearly. Setting up here creates your account and
          charges nothing now.
        </p>
      </div>
    </div>
  )
}

interface ChoiceOption {
  value: string
  label: string
  hint?: string
}

/**
 * Accessible single-select group built from toggle buttons. Each option is
 * a 44px-tall, keyboard-focusable control with aria-pressed state — valid
 * for the short, fixed enums used here (country, team size, module).
 */
function ChoiceGrid({
  legend,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string
  options: ChoiceOption[]
  value: string
  onChange: (value: string) => void
  columns: 1 | 2
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div
        className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}
        role="group"
        aria-label={legend}
      >
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex min-h-11 flex-col justify-center gap-0.5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left',
                'transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-fg)]'
                  : 'border-[var(--color-border-strong)] text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)]',
              )}
            >
              <span className="text-[14px] font-medium">{o.label}</span>
              {o.hint ? (
                <span className="text-[12px] leading-5 text-[var(--color-fg-muted)]">{o.hint}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

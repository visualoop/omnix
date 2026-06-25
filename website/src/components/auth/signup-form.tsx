'use client'

import * as React from 'react'
import { ArrowRight } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Select as ShadcnSelect,
  SelectContent as ShadcnSelectContent,
  SelectItem as ShadcnSelectItem,
  SelectTrigger as ShadcnSelectTrigger,
  SelectValue as ShadcnSelectValue,
} from '@/components/ui/select'
import { KE_COUNTIES } from '@/lib/ke-counties'
import { cn } from '@/lib/cn'
import { Checkbox } from '@/components/ui/checkbox'

const BUSINESS_TYPES = [
  { value: 'pharmacy', label: 'Pharmacy / Chemist' },
  { value: 'mini_mart', label: 'Mini-mart / Supermarket' },
  { value: 'duka', label: 'General shop / Duka' },
  { value: 'restaurant', label: 'Restaurant / Hotel' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
] as const

export function SignupForm() {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const raw = Object.fromEntries(formData.entries())

    // Checkboxes serialise as 'on' (checked) or are missing (unchecked).
    // Payload's `checkbox` field type rejects string values, so coerce
    // every checkbox in the form to a boolean before POSTing.
    const checkboxNames = ['newsletterOptIn', 'termsAccepted']
    const payload: Record<string, unknown> = { ...raw }
    for (const name of checkboxNames) {
      payload[name] = formData.get(name) !== null
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { errors?: { message: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not create account')
      }
      window.location.href = '/dashboard?welcome=1'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <Field name="fullName" label="Full name" required placeholder="Mama Mary Wanjiru" />
      <Field
        name="email"
        type="email"
        label="Email"
        required
        autoComplete="email"
        placeholder="you@example.co.ke"
      />
      <Field
        name="password"
        type="password"
        label="Password"
        required
        autoComplete="new-password"
        helper="At least 8 characters"
        minLength={8}
      />
      <Field
        name="businessName"
        label="Business name"
        required
        placeholder="Mama Mary's Pharmacy"
      />
      <Field
        name="phone"
        type="tel"
        label="Phone"
        required
        placeholder="+254 7XX XXX XXX"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          name="county"
          label="County"
          required
          placeholder="Select county"
          options={KE_COUNTIES.map((c) => ({ value: c.value, label: c.label }))}
        />
        <Select
          name="businessType"
          label="Business type"
          required
          placeholder="Select trade"
          options={BUSINESS_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
      </div>

      <label className="mt-2 flex items-start gap-2.5 text-[12px] text-[var(--color-fg-muted)]">
        <Checkbox name="newsletterOptIn" defaultChecked className="mt-0.5" />
        <span>
          Email me when there's a major release. One short summary per release. Unsubscribe in
          one click.
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-[12px] text-[var(--color-fg-muted)]">
        <Checkbox name="termsAccepted" required className="mt-0.5" />
        <span>
          I agree to the{' '}
          <a
            href="/terms"
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            terms
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            privacy policy
          </a>
          .
        </span>
      </label>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
        {submitting ? 'Creating account...' : 'Create account'}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

interface FieldProps {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  minLength?: number
  helper?: string
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  minLength,
  helper,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
      >
        {label}
        {required ? <span className="text-[var(--color-accent)]"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        className={cn(
          'rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none transition-colors',
          'placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]',
        )}
      />
      {helper ? (
        <span className="text-[11px] text-[var(--color-fg-subtle)]">{helper}</span>
      ) : null}
    </div>
  )
}

interface SelectProps {
  name: string
  label: string
  required?: boolean
  placeholder?: string
  options: Array<{ value: string; label: string }>
}

function Select({ name, label, required, placeholder, options }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
      >
        {label}
        {required ? <span className="text-[var(--color-accent)]"> *</span> : null}
      </label>
      <ShadcnSelect name={name} required={required}>
        <ShadcnSelectTrigger><ShadcnSelectValue placeholder={placeholder} /></ShadcnSelectTrigger>
        <ShadcnSelectContent>
          {options.map((o) => (
            <ShadcnSelectItem key={o.value} value={o.value}>{o.label}</ShadcnSelectItem>
          ))}
        </ShadcnSelectContent>
      </ShadcnSelect>
    </div>
  )
}

'use client'

import * as React from 'react'
import { Save } from '@/components/icons'
import { Button } from '@/components/ui/button'

interface ProfileInitial {
  fullName: string
  businessName: string
  email: string
  phone: string
  whatsapp: string
  kraPin: string
  county: string
  town: string
  physicalAddress: string
  businessType: string
  employeeCount: string
  newsletterOptIn: boolean
}

const BUSINESS_TYPES = [
  { value: 'pharmacy', label: 'Pharmacy / Chemist' },
  { value: 'mini_mart', label: 'Mini-mart / Supermarket' },
  { value: 'duka', label: 'General shop / Duka' },
  { value: 'restaurant', label: 'Restaurant / Hotel' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
] as const

const EMPLOYEE_BANDS = [
  { value: '1', label: 'Just me' },
  { value: '2-5', label: '2 – 5' },
  { value: '6-15', label: '6 – 15' },
  { value: '16-50', label: '16 – 50' },
  { value: '50+', label: '50+' },
] as const

export function ProfileForm({
  initial,
  counties,
}: {
  initial: ProfileInitial
  counties: { value: string; label: string }[]
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSaved(false)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    // Coerce checkbox
    payload.newsletterOptIn = formData.get('newsletterOptIn') ? 'true' : 'false'

    try {
      const res = await fetch('/api/customers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, newsletterOptIn: payload.newsletterOptIn === 'true' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not save')
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="fullName" label="Full name" defaultValue={initial.fullName} required />
        <Field
          name="businessName"
          label="Business name"
          defaultValue={initial.businessName}
          required
        />
      </div>

      <Field
        name="email"
        type="email"
        label="Email"
        defaultValue={initial.email}
        helper="Contact support to change your sign-in email."
        readOnly
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          name="phone"
          type="tel"
          label="Phone"
          defaultValue={initial.phone}
          required
        />
        <Field
          name="whatsapp"
          type="tel"
          label="WhatsApp (optional)"
          defaultValue={initial.whatsapp}
        />
      </div>

      <Field name="kraPin" label="KRA PIN" defaultValue={initial.kraPin} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="county" label="County" defaultValue={initial.county}>
          <option value="">Select county</option>
          {counties.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Field name="town" label="Town" defaultValue={initial.town} />
      </div>

      <Field
        name="physicalAddress"
        label="Physical address"
        defaultValue={initial.physicalAddress}
        textarea
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="businessType" label="Business type" defaultValue={initial.businessType}>
          <option value="">Select trade</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          name="employeeCount"
          label="Team size"
          defaultValue={initial.employeeCount}
        >
          <option value="">Select range</option>
          {EMPLOYEE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-start gap-2.5 text-[12px] text-[var(--color-fg-muted)]">
        <input
          type="checkbox"
          name="newsletterOptIn"
          defaultChecked={initial.newsletterOptIn}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        Email me when there's a major release.
      </label>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          Profile saved.
        </div>
      ) : null}

      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save changes'}
          <Save className="size-4" />
        </Button>
      </div>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  helper,
  readOnly,
  textarea,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  defaultValue?: string
  helper?: string
  readOnly?: boolean
  textarea?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
      >
        {label}
        {required ? <span className="text-[var(--color-accent)]"> *</span> : null}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue}
          rows={3}
          readOnly={readOnly}
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          readOnly={readOnly}
          className={
            readOnly
              ? 'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] text-[var(--color-fg-muted)]'
              : 'rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]'
          }
        />
      )}
      {helper ? (
        <span className="text-[11px] text-[var(--color-fg-subtle)]">{helper}</span>
      ) : null}
    </div>
  )
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string
  label: string
  defaultValue?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
      >
        {children}
      </select>
    </div>
  )
}

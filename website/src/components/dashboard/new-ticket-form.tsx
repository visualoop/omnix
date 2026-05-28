'use client'

import * as React from 'react'
import { ArrowRight } from '@/components/icons'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'question', label: 'Question' },
  { value: 'billing', label: 'Billing' },
  { value: 'data_recovery', label: 'Data recovery' },
  { value: 'install_help', label: 'Install help' },
  { value: 'other', label: 'Other' },
] as const

export function NewTicketForm({
  licenses,
}: {
  licenses: { value: string; label: string }[]
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not open ticket')
      }
      const json = (await res.json()) as { doc?: { id: string } }
      if (json.doc?.id) {
        window.location.href = `/dashboard/support/${json.doc.id}`
      } else {
        window.location.href = '/dashboard/support'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open ticket')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <Field name="subject" label="Subject" required placeholder="Brief description" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="category" label="Category" required>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select name="priority" label="Priority">
          <option value="normal">Normal</option>
          <option value="low">Low</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </div>

      {licenses.length > 0 ? (
        <Select name="license" label="Licence (optional)">
          <option value="">— Not specific to a licence —</option>
          {licenses.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          Description <span className="text-[var(--color-accent)]">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          placeholder="What happened? What were you trying to do? What did you expect?"
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-3 text-[14px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="mt-2">
        {submitting ? 'Opening ticket...' : 'Open ticket'}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

function Field({
  name,
  label,
  required,
  placeholder,
}: {
  name: string
  label: string
  required?: boolean
  placeholder?: string
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
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
      />
    </div>
  )
}

function Select({
  name,
  label,
  required,
  children,
}: {
  name: string
  label: string
  required?: boolean
  children: React.ReactNode
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
      <select
        id={name}
        name={name}
        required={required}
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
      >
        {children}
      </select>
    </div>
  )
}

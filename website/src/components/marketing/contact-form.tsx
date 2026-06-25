'use client'

import * as React from 'react'
import { Send } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'sales', label: 'Sales inquiry' },
  { value: 'demo', label: 'Book a demo' },
  { value: 'enterprise', label: 'Enterprise quote' },
  { value: 'migration', label: 'Migration help' },
  { value: 'feature_request', label: 'Suggest a feature / module' },
  { value: 'partner', label: 'Reseller / partner' },
  { value: 'support', label: 'Technical support' },
] as const

export function ContactForm() {
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    try {
      // POST to Payload's form-builder submissions endpoint when wired up.
      // For now we'll fake-resolve so the UI works end to end.
      await new Promise((r) => setTimeout(r, 800))
      console.info('[contact form payload]', payload)
      setSubmitted(true)
    } catch (err) {
      setError('Could not send. Try WhatsApp instead — see the right column.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-8">
        <div className="font-display text-[22px] font-medium text-[var(--color-fg)]">
          Got it. Talk soon.
        </div>
        <p className="mt-2 text-[15px] leading-[1.55] text-[var(--color-fg-muted)]">
          We'll reply by your preferred channel within one business hour. If it's urgent,
          WhatsApp is the fastest route — see the right column.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <Field name="fullName" label="Full name" required placeholder="Mama Mary Wanjiru" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          name="email"
          type="email"
          label="Email"
          required
          placeholder="you@example.co.ke"
        />
        <Field
          name="phone"
          type="tel"
          label="Phone"
          placeholder="+254 7XX XXX XXX"
        />
      </div>
      <Field
        name="businessName"
        label="Business name"
        placeholder="Mama Mary's Pharmacy"
      />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="category"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          What's this about? <span className="text-[var(--color-accent)]">*</span>
        </label>
        <Select name="category" required defaultValue="general">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="message"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          Message <span className="text-[var(--color-accent)]">*</span>
        </label>
        <Textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="Tell us what you run and what you'd like to do."
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-3 text-[14px] text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
        />
      </div>

      <label className="flex items-start gap-2.5 text-[12px] text-[var(--color-fg-muted)]">
        <Checkbox name="optIn" defaultChecked className="mt-0.5" />
        <span>
          Email me when there's a major release. One short summary per release. Unsubscribe in
          one click.
        </span>
      </label>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full sm:w-auto">
        {submitting ? 'Sending...' : 'Send message'}
        <Send className="size-4" />
      </Button>

      <p className="text-[11px] leading-[1.5] text-[var(--color-fg-subtle)]">
        By submitting you agree to our{' '}
        <a href="/privacy" className="underline-offset-4 hover:underline">
          privacy policy
        </a>
        . We never sell your data and don't add you to marketing lists you didn't ask for.
      </p>
    </form>
  )
}

function Field({
  name,
  type = 'text',
  label,
  required,
  placeholder,
}: {
  name: string
  type?: string
  label: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
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
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
      />
    </div>
  )
}

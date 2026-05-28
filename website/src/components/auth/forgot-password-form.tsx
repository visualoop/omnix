'use client'

import * as React from 'react'
import { ArrowRight } from '@/components/icons'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string

    try {
      await fetch('/api/customers/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      // Generic confirmation regardless of email validity (anti-enumeration)
      setSubmitted(true)
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-6 text-center">
        <div className="font-display text-[20px] font-medium text-[var(--color-fg)]">
          Check your email.
        </div>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
          If we have an account with that email, a reset link is on its way. Links expire after
          1 hour.
        </p>
        <p className="mt-3 text-[12px] text-[var(--color-fg-subtle)]">
          Nothing in your inbox after 5 minutes? Check spam, or WhatsApp the owner.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          Email <span className="text-[var(--color-accent)]">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.co.ke"
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
        {submitting ? 'Sending link...' : 'Send reset link'}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

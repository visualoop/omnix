'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function LoginForm() {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const response = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { errors?: { message: string }[] }
          | null
        throw new Error(data?.errors?.[0]?.message ?? 'Wrong email or password')
      }
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <Field name="email" type="email" label="Email" required autoComplete="email" />
      <Field
        name="password"
        type="password"
        label="Password"
        required
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between text-[12px]">
        <label className="flex items-center gap-2 text-[var(--color-fg-muted)]">
          <input
            type="checkbox"
            name="rememberMe"
            defaultChecked
            className="size-4 accent-[var(--color-accent)]"
          />
          Stay signed in
        </label>
        <Link
          href="/forgot-password"
          className="text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
        {submitting ? 'Signing in...' : 'Sign in'}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

function Field({
  name,
  type = 'text',
  label,
  required,
  autoComplete,
}: {
  name: string
  type?: string
  label: string
  required?: boolean
  autoComplete?: string
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
        type={type}
        required={required}
        autoComplete={autoComplete}
        className={cn(
          'rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none transition-colors',
          'placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]',
        )}
      />
    </div>
  )
}

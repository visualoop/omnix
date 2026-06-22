'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@/components/icons'

interface Props {
  next?: string
}

export function SignInForm({ next }: Props) {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<'idle' | 'google' | 'magic-link' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const callbackURL = next ?? '/dashboard'

  async function onGoogle() {
    setError(null)
    setPending('google')
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.')
      setPending('idle')
    }
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setPending('magic-link')
    const { error: err } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL,
    })
    if (err) {
      setError(err.message ?? 'Could not send magic link.')
      setPending('idle')
      return
    }
    setPending('sent')
  }

  if (pending === 'sent') {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <h2 className="font-display text-[20px] font-medium leading-tight text-[var(--color-fg)]">
          Check your email
        </h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
          A sign-in link is on its way to <b>{email}</b>. It expires in 15 minutes.
        </p>
        <button
          onClick={() => setPending('idle')}
          className="mt-4 text-[12px] underline-offset-4 hover:underline text-[var(--color-fg-muted)]"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-3 h-11"
        onClick={onGoogle}
        disabled={pending !== 'idle'}
      >
        <GoogleGlyph />
        {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </Button>

      <div className="relative my-2">
        <div className="h-px bg-[var(--color-border)]" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[var(--color-bg)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          or
        </span>
      </div>

      <form onSubmit={onMagicLink} className="space-y-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            Email
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.ke"
            className="w-full h-11 rounded-md border border-[var(--color-border)] bg-transparent px-3 text-[14px] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg-muted)]"
          />
        </label>
        <Button type="submit" className="w-full justify-center h-11 gap-2" disabled={pending !== 'idle' || !email.trim()}>
          {pending === 'magic-link' ? 'Sending…' : (
            <>
              Email me a sign-in link
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[12px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.86-1.6 2.41v2h2.6a7.8 7.8 0 0 0 2.38-5.91c0-.55-.05-1.09-.15-1.6Z" fill="#4285F4" />
      <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04c-.72.48-1.64.77-2.7.77a4.7 4.7 0 0 1-4.4-3.16h-2.7v1.99A8 8 0 0 0 8.98 17Z" fill="#34A853" />
      <path d="M4.58 10.63a4.8 4.8 0 0 1 0-3.06v-2H1.88a8 8 0 0 0 0 7.05l2.7-2Z" fill="#FBBC05" />
      <path d="M8.98 4.38c1.18 0 2.23.4 3.06 1.2l2.3-2.3A7.94 7.94 0 0 0 8.98 1a8 8 0 0 0-7.1 4.38l2.7 2A4.7 4.7 0 0 1 8.98 4.38Z" fill="#EA4335" />
    </svg>
  )
}

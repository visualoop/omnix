'use client'

import { useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { safeNextPath } from '@/lib/safe-redirect'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ArrowRight } from '@/components/icons'

interface Props {
  next?: string
}

type Phase = 'idle' | 'google' | 'magic-link' | 'sent'

export function SignInForm({ next }: Props) {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Every redirect target is validated to an internal path before it
  // reaches Better Auth's callbackURL — external / privileged targets
  // collapse to /dashboard.
  const callbackURL = safeNextPath(next)
  const busy = phase !== 'idle' && phase !== 'sent'

  async function onGoogle() {
    setError(null)
    setPhase('google')
    try {
      await authClient.signIn.social({ provider: 'google', callbackURL })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in could not start. Try again.')
      setPhase('idle')
    }
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address) {
      inputRef.current?.focus()
      return
    }
    setError(null)
    setPhase('magic-link')
    const { error: err } = await authClient.signIn.magicLink({ email: address, callbackURL })
    if (err) {
      // Never reveal whether the address maps to an account.
      setError('We could not send the link just now. Check the address and try again.')
      setPhase('idle')
      inputRef.current?.focus()
      return
    }
    setPhase('sent')
  }

  if (phase === 'sent') {
    return (
      <Alert variant="success" title="Check your email">
        <p>
          If an Omnix account can use <b>{email.trim()}</b>, a sign-in link is on its way. It
          expires 15 minutes after it was sent.
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
          Nothing after a few minutes? Check spam, then request another link.
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase('idle')
            setError(null)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          className="mt-3 inline-flex min-h-11 items-center font-ui text-[13px] font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full justify-center gap-3"
        onClick={onGoogle}
        disabled={busy}
        aria-busy={phase === 'google'}
      >
        <GoogleGlyph />
        {phase === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </Button>

      <div className="relative my-2" aria-hidden="true">
        <div className="h-px bg-[var(--color-border)]" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-bg)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          or
        </span>
      </div>

      <form onSubmit={onMagicLink} className="space-y-3" noValidate>
        <Field label="Email" required>
          <Input
            ref={inputRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.ke"
            disabled={busy}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || !email.trim()}
          aria-busy={phase === 'magic-link'}
        >
          {phase === 'magic-link' ? (
            'Sending…'
          ) : (
            <>
              Email me a sign-in link
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.86-1.6 2.41v2h2.6a7.8 7.8 0 0 0 2.38-5.91c0-.55-.05-1.09-.15-1.6Z" fill="#4285F4" />
      <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04c-.72.48-1.64.77-2.7.77a4.7 4.7 0 0 1-4.4-3.16h-2.7v1.99A8 8 0 0 0 8.98 17Z" fill="#34A853" />
      <path d="M4.58 10.63a4.8 4.8 0 0 1 0-3.06v-2H1.88a8 8 0 0 0 0 7.05l2.7-2Z" fill="#FBBC05" />
      <path d="M8.98 4.38c1.18 0 2.23.4 3.06 1.2l2.3-2.3A7.94 7.94 0 0 0 8.98 1a8 8 0 0 0-7.1 4.38l2.7 2A4.7 4.7 0 0 1 8.98 4.38Z" fill="#EA4335" />
    </svg>
  )
}

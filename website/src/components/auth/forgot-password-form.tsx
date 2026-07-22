'use client'

import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { safeNextPath } from '@/lib/safe-redirect'
import { ArrowRight } from '@/components/icons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface Props {
  next?: string
}

/**
 * Recover access on a passwordless site.
 *
 * There is no password to reset — regaining access means requesting a
 * fresh magic link. The response is identical whether or not the address
 * maps to an account, so this never discloses account existence.
 */
export function ForgotPasswordForm({ next }: Props) {
  const [email, setEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const callbackURL = safeNextPath(next)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = email.trim()
    if (!address) {
      inputRef.current?.focus()
      return
    }
    setSubmitting(true)
    try {
      // Fire the magic link. We deliberately ignore the outcome so the
      // confirmation is byte-for-byte identical for known and unknown
      // addresses (anti-enumeration).
      await authClient.signIn.magicLink({ email: address, callbackURL }).catch(() => undefined)
    } finally {
      setSubmitted(true)
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Alert variant="success" title="Check your email">
        <p>
          If an Omnix account can use that address, a sign-in link is on its way. It expires 15
          minutes after it was sent.
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
          Nothing after a few minutes? Check spam, then request another link.
        </p>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
      <Field label="Email" required>
        <Input
          ref={inputRef}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.co.ke"
          disabled={submitting}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={submitting || !email.trim()}
        aria-busy={submitting}
        className="mt-1 w-full"
      >
        {submitting ? (
          'Sending…'
        ) : (
          <>
            Email me a sign-in link
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}

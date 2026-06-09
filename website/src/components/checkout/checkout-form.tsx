'use client'

/**
 * CheckoutForm — Paystack Inline V2 popup.
 *
 * One button → /api/paystack/init returns { reference, amount, email, publicKey }
 * → new PaystackPop().newTransaction({...}) opens Paystack's hosted popup
 * → onSuccess redirects to /buy/success, onCancel resets.
 *
 * No more custom card form, OTP modal, 3DS iframe, or /charge endpoint.
 * Paystack hosts the entire payment UI; we only consume the result.
 */
import * as React from 'react'
import Script from 'next/script'
import { CreditCard, Lock } from '@/components/icons'
import { Button } from '@/components/ui/button'

interface InitResponse {
  reference: string
  amount: number
  currency: string
  email: string
  publicKey: string
}

interface PaystackPopCtor {
  new (): {
    newTransaction: (opts: {
      key: string
      email: string
      amount: number
      reference?: string
      currency?: string
      channels?: string[]
      metadata?: Record<string, unknown>
      onSuccess: (transaction: { reference: string; status?: string }) => void
      onCancel: () => void
      onError?: (error: { message?: string }) => void
    }) => void
  }
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopCtor
  }
}

const PAYSTACK_INLINE_JS = 'https://js.paystack.co/v2/inline.js'

export function CheckoutForm({
  licenseId,
  purpose,
  amount,
  currency,
}: {
  licenseId: string
  purpose: string
  amount: number
  currency: string
}) {
  const [scriptReady, setScriptReady] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onPay = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const initRes = await fetch('/api/paystack/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId, purpose }),
      })
      if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => null)
        throw new Error(errBody?.error ?? `Init failed (${initRes.status})`)
      }
      const init = (await initRes.json()) as InitResponse

      if (!window.PaystackPop) {
        throw new Error('Paystack popup script not loaded yet — try again in a moment.')
      }
      const pop = new window.PaystackPop()
      pop.newTransaction({
        key: init.publicKey,
        email: init.email,
        amount: init.amount,
        currency: init.currency,
        reference: init.reference,
        channels: ['card', 'mobile_money', 'bank', 'bank_transfer'],
        metadata: {
          custom_fields: [
            { display_name: 'License', variable_name: 'license_id', value: licenseId },
            { display_name: 'Purpose', variable_name: 'purpose', value: purpose },
          ],
        },
        onSuccess: (transaction) => {
          window.location.href = `/buy/success?ref=${encodeURIComponent(transaction.reference)}`
        },
        onCancel: () => {
          setSubmitting(false)
        },
        onError: (err) => {
          setError(err?.message ?? 'Payment could not start.')
          setSubmitting(false)
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not start.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <Script
        src={PAYSTACK_INLINE_JS}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-start gap-3">
            <CreditCard className="size-5 shrink-0 text-[var(--color-accent)] mt-0.5" />
            <div className="flex-1">
              <div className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                Pay with card or M-Pesa
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
                Paystack handles the secure popup. Card, M-Pesa STK push, bank transfer — all in one flow.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={!scriptReady || submitting}
          onClick={onPay}
          className="w-full"
        >
          {submitting
            ? 'Opening Paystack…'
            : !scriptReady
              ? 'Loading payment…'
              : `Pay ${currency} ${amount.toLocaleString()}`}
        </Button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
          <Lock className="size-3" />
          Secured by Paystack · Card details never touch our server
        </div>
      </div>
    </>
  )
}

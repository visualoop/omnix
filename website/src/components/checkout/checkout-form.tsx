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
      <div className="flex flex-col gap-6">
        {/* Payment method panel — quiet copy, no competing colours so the
            CTA below is the only loud thing in the column. */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="size-5 shrink-0 text-[var(--color-accent)] mt-0.5" />
            <div className="flex-1">
              <div
                style={{ fontFamily: 'var(--font-display)' }}
                className="text-[18px] font-medium text-[var(--color-fg)]"
              >
                Pay with card or M-Pesa
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[42ch]">
                Paystack handles the secure popup. Card, M-Pesa STK push, bank transfer —
                all in one flow.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2.5 text-[13px] text-[var(--color-fg)]">
            {error}
          </div>
        ) : null}

        {/* The CTA. Inline-styled to the copper accent so it can't get
            swallowed by a passing surface token in dark mode. The amount
            sits in the button itself with serif weight; a separate
            caption below repeats the currency in mono for clarity. */}
        <button
          type="button"
          disabled={!scriptReady || submitting}
          onClick={onPay}
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-foreground, white)',
            boxShadow: '0 8px 24px -8px var(--color-accent)',
          }}
          className="group relative w-full inline-flex items-center justify-center gap-3 rounded-xl px-6 py-5 font-medium text-[18px] tracking-[-0.01em] cursor-pointer transition-all hover:opacity-95 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          <CreditCard className="size-5" />
          <span style={{ fontFamily: 'var(--font-display)' }}>
            {submitting
              ? 'Opening Paystack…'
              : !scriptReady
                ? 'Loading payment…'
                : `Pay ${currency} ${amount.toLocaleString()}`}
          </span>
        </button>

        {/* Confirmation line + secondary mono caption */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
            <Lock className="size-3" />
            <span>Secured by Paystack · Card details never touch our server</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
            {currency} {amount.toLocaleString()} · One-time
          </div>
        </div>
      </div>
    </>
  )
}

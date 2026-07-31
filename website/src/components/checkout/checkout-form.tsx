'use client'

/**
 * CheckoutForm — Paystack Inline V2 handoff.
 *
 * One button → POST /api/paystack/init (server computes the authoritative
 * amount/currency and records the pending payment) → PaystackPop opens the
 * hosted popup → onSuccess forwards to the server-verified /buy/success.
 *
 * The client never sends or trusts an amount: it posts only { licenseId,
 * purpose } and pays exactly what the server returns. Card details never
 * touch our server — Paystack hosts the entire payment surface.
 */
import * as React from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { CreditCard, Globe, Lock } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { DisplayCurrency, SettlementCurrency } from '@/lib/currency'

interface InitResponse {
  reference: string
  settlementAmount: number
  settlementCurrency: SettlementCurrency
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
      currency?: SettlementCurrency
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

export function ManualSettlementState({
  displayAmount,
  displayCurrency,
  contactHref,
}: {
  displayAmount: number
  displayCurrency: Exclude<DisplayCurrency, 'KES'>
  contactHref: string
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 size-5 shrink-0 text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Manual settlement required
            </p>
            <h2 className="mt-2 font-display text-[19px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
              Online payment is not available in {displayCurrency} yet.
            </h2>
            <p className="mt-2 max-w-[48ch] text-[13px] leading-[1.65] text-[var(--color-fg-muted)]">
              Your order total remains {displayCurrency} {displayAmount.toLocaleString()}. We will not convert or relabel
              it as another currency. Contact Omnix to confirm a supported payment method and the exact settlement
              currency before sending money.
            </p>
          </div>
        </div>
      </div>

      <Button asChild size="xl" className="w-full">
        <Link href={contactHref}>Contact Omnix before payment</Link>
      </Button>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
          <Lock className="size-3" />
          <span>No online charge has been created</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
          Display total · {displayCurrency} {displayAmount.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

type Status = 'idle' | 'starting' | 'redirecting' | 'cancelled' | 'error'

export function CheckoutForm({
  licenseId,
  purpose,
  displayAmount,
  displayCurrency,
  settlementCurrency,
}: {
  licenseId: string
  purpose: string
  displayAmount: number
  displayCurrency: 'KES'
  settlementCurrency: 'KES'
}) {
  const [scriptReady, setScriptReady] = React.useState(false)
  const [status, setStatus] = React.useState<Status>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const busy = status === 'starting' || status === 'redirecting'

  const onPay = async () => {
    setError(null)
    setStatus('starting')
    try {
      const initRes = await fetch('/api/paystack/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId, purpose }),
      })
      if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => null)
        throw new Error(errBody?.error ?? `We couldn't start the payment (${initRes.status}).`)
      }
      const init = (await initRes.json()) as InitResponse

      if (!window.PaystackPop) {
        throw new Error('The secure payment window isn\u2019t ready yet — try again in a moment.')
      }
      const pop = new window.PaystackPop()
      pop.newTransaction({
        key: init.publicKey,
        email: init.email,
        amount: init.settlementAmount,
        currency: init.settlementCurrency,
        reference: init.reference,
        metadata: {
          custom_fields: [
            { display_name: 'License', variable_name: 'license_id', value: licenseId },
            { display_name: 'Purpose', variable_name: 'purpose', value: purpose },
          ],
        },
        onSuccess: (transaction) => {
          setStatus('redirecting')
          // Internal, server-verified confirmation route only.
          window.location.href = `/buy/success?ref=${encodeURIComponent(transaction.reference)}`
        },
        onCancel: () => {
          setStatus('cancelled')
        },
        onError: (err) => {
          setError(err?.message ?? 'The payment could not start. Please try again.')
          setStatus('error')
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not start. Please try again.')
      setStatus('error')
    }
  }

  const label = busy
    ? status === 'redirecting'
      ? 'Confirming…'
      : 'Opening secure window…'
    : !scriptReady
      ? 'Loading payment…'
      : `Pay ${settlementCurrency} ${displayAmount.toLocaleString()}`

  return (
    <>
      <Script src={PAYSTACK_INLINE_JS} strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
      <div className="flex flex-col gap-5">
        {/* Payment method panel — quiet, honest description of the handoff. */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-[var(--color-accent)]" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[17px] font-semibold tracking-[-0.01em] text-[var(--color-fg)]">
                Pay online with Paystack
              </div>
              <p className="mt-1.5 max-w-[46ch] text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
                Paystack opens a secure window and shows only the payment methods available for this transaction and
                merchant setup. Confirm the method and KES total there before authorising payment; card details never
                reach our server.
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] leading-[1.5] text-[var(--color-fg-subtle)]">
                <Globe className="size-3.5" />
                An internet connection is needed for this step; the app itself runs offline once installed.
              </p>
            </div>
          </div>
        </div>

        {status === 'cancelled' ? (
          <Alert variant="warning" title="Payment window closed">
            No money was charged. You can start the payment again whenever you&rsquo;re ready.
          </Alert>
        ) : null}

        {status === 'error' && error ? (
          <Alert variant="error" title="We couldn't start the payment">
            {error}
          </Alert>
        ) : null}

        <Button
          type="button"
          size="xl"
          disabled={!scriptReady || busy}
          aria-busy={busy}
          onClick={onPay}
          className="w-full"
        >
          <CreditCard className="size-5" />
          {label}
        </Button>

        {/* Live region for assistive tech while the handoff is in progress. */}
        <p aria-live="polite" className="sr-only">
          {busy ? label : ''}
        </p>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
            <Lock className="size-3" />
            <span>Secured by Paystack · Settlement currency confirmed before charge</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
            Display {displayCurrency} {displayAmount.toLocaleString()} · Settlement {settlementCurrency} {displayAmount.toLocaleString()}
          </div>
        </div>
      </div>
    </>
  )
}

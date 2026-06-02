'use client'

/**
 * CheckoutForm — fully custom UI. No Paystack chrome, no redirects.
 *
 * Card flow:
 *   - Custom card form (number / expiry / cvv) on our site.
 *   - Card data is encrypted client-side via @paystack/inline-js's
 *     encrypt() helper using NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, so plaintext
 *     never reaches our server (we stay out of PCI scope).
 *   - POST encrypted blob to /api/paystack/charge.
 *   - Response branches on status:
 *       success    → redirect to /buy/success
 *       send_otp   → render our own 6-digit OTP input → /api/paystack/charge/submit-otp
 *       open_url   → render the 3DS URL in our OWN iframe modal + poll status
 *       pay_offline / pending → poll status
 *       failed     → show error in our UI
 *
 * M-Pesa flow:
 *   - Phone input on our site → /api/paystack/charge with channel=mpesa.
 *   - Paystack pushes STK to the customer's phone; we poll status until success.
 */
import * as React from 'react'
import Script from 'next/script'
import { CreditCard, Lock, Smartphone } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Channel = 'mpesa' | 'card'
type Stage = 'idle' | 'submitting' | 'waiting' | 'otp' | '3ds' | 'succeeded' | 'failed'

interface ChargeResponse {
  reference: string
  status: 'success' | 'send_otp' | 'open_url' | 'pay_offline' | 'pending' | 'failed'
  displayText?: string
  redirectUrl?: string
}

interface PaystackPopCtor {
  new (): { encrypt?: (publicKey: string, cardData: unknown) => string }
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopCtor
  }
}

const PAYSTACK_INLINE_JS = 'https://js.paystack.co/v2/inline.js'

function detectBrand(num: string): string {
  const cleaned = num.replace(/\s/g, '')
  if (/^4/.test(cleaned)) return 'Visa'
  if (/^5[1-5]/.test(cleaned)) return 'Mastercard'
  if (/^3[47]/.test(cleaned)) return 'Amex'
  return ''
}

function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`
}

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
  const [channel, setChannel] = React.useState<Channel>('mpesa')
  const [stage, setStage] = React.useState<Stage>('idle')
  const [reference, setReference] = React.useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [scriptReady, setScriptReady] = React.useState(false)
  const [otp, setOtp] = React.useState('')
  const [submittingOtp, setSubmittingOtp] = React.useState(false)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Polling status ─────────────────────────────────────────────
  const stopPolling = React.useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }, [])

  const beginPolling = React.useCallback(
    (ref: string) => {
      stopPolling()
      let elapsed = 0
      pollTimerRef.current = setInterval(async () => {
        elapsed += 3000
        if (elapsed > 200_000) {
          stopPolling()
          setStage('failed')
          setError("We didn't receive confirmation. If your phone showed Success, your dashboard will catch up shortly.")
          return
        }
        try {
          const res = await fetch(`/api/paystack/status/${encodeURIComponent(ref)}`)
          if (!res.ok) return
          const data = (await res.json()) as { status: string }
          if (data.status === 'success') {
            stopPolling()
            window.location.href = `/buy/success?ref=${ref}`
          } else if (data.status === 'failed') {
            stopPolling()
            setStage('failed')
            setError('Payment was not completed.')
          }
        } catch {
          /* keep polling */
        }
      }, 3000)
    },
    [stopPolling],
  )

  React.useEffect(() => stopPolling, [stopPolling])

  // 3DS iframe → postMessage handshake (shortcuts the poller when supported)
  React.useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (typeof e.data !== 'object' || e.data === null) return
      const d = e.data as { type?: string; status?: string }
      if (d.type === 'omnix:3ds-done' && reference) {
        if (d.status === 'success') {
          stopPolling()
          window.location.href = `/buy/success?ref=${reference}`
        } else {
          stopPolling()
          setStage('failed')
          setError('3-D Secure declined the transaction.')
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [reference, stopPolling])

  // ── Charge response → next step ────────────────────────────────
  const handleChargeResponse = React.useCallback(
    (data: ChargeResponse) => {
      setReference(data.reference)
      switch (data.status) {
        case 'success':
          window.location.href = `/buy/success?ref=${data.reference}`
          break
        case 'open_url':
          setRedirectUrl(data.redirectUrl ?? null)
          setStage('3ds')
          beginPolling(data.reference)
          break
        case 'send_otp':
          setStage('otp')
          break
        case 'pay_offline':
        case 'pending':
          setStage('waiting')
          beginPolling(data.reference)
          break
        case 'failed':
        default:
          setStage('failed')
          setError(data.displayText ?? 'Payment was declined.')
      }
    },
    [beginPolling],
  )

  // ── Form submit ────────────────────────────────────────────────
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStage('submitting')

    const formData = new FormData(event.currentTarget)

    try {
      const body: Record<string, unknown> = { licenseId, purpose, channel }

      if (channel === 'mpesa') {
        body.phone = (formData.get('phone') as string) ?? ''
      } else {
        // Card — encrypt client-side via Paystack inline-js encrypt()
        const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
        if (!publicKey) throw new Error('Card payments are not configured (missing public key).')
        if (!window.PaystackPop) throw new Error('Encryption library has not loaded yet — try again in a moment.')
        const number = (formData.get('card_number') as string).replace(/\s/g, '')
        const expiryStr = (formData.get('expiry') as string).replace(/\D/g, '')
        const cvv = formData.get('cvv') as string
        if (number.length < 15 || expiryStr.length !== 4 || cvv.length < 3) {
          throw new Error('Please enter complete card details.')
        }
        const expiry_month = expiryStr.slice(0, 2)
        const expiry_year = `20${expiryStr.slice(2)}`
        const pop = new window.PaystackPop()
        if (!pop.encrypt) throw new Error('Paystack inline-js v2 did not expose encrypt().')
        body.encryptedCard = pop.encrypt(publicKey, { number, cvv, expiry_month, expiry_year })
      }

      const res = await fetch('/api/paystack/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `Payment failed (${res.status})`)
      }
      handleChargeResponse((await res.json()) as ChargeResponse)
    } catch (err) {
      setStage('failed')
      setError(err instanceof Error ? err.message : 'Payment could not start.')
    }
  }

  // ── OTP submission ─────────────────────────────────────────────
  const onSubmitOtp = async () => {
    if (!reference || otp.length < 4) return
    setSubmittingOtp(true)
    setError(null)
    try {
      const res = await fetch('/api/paystack/charge/submit-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, otp }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `OTP failed (${res.status})`)
      }
      handleChargeResponse((await res.json()) as ChargeResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP could not be submitted.')
    } finally {
      setSubmittingOtp(false)
    }
  }

  // ── Card field state for live formatting ───────────────────────
  const [cardNumber, setCardNumber] = React.useState('')
  const [expiry, setExpiry] = React.useState('')
  const brand = detectBrand(cardNumber)

  return (
    <>
      <Script
        src={PAYSTACK_INLINE_JS}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Channel tabs */}
        <div className="grid grid-cols-2 gap-2">
          <ChannelTab
            active={channel === 'mpesa'}
            onClick={() => setChannel('mpesa')}
            icon={Smartphone}
            label="M-Pesa"
          />
          <ChannelTab
            active={channel === 'card'}
            onClick={() => setChannel('card')}
            icon={CreditCard}
            label="Card"
          />
        </div>

        {/* Channel-specific fields */}
        {channel === 'mpesa' ? (
          <div>
            <label
              htmlFor="phone"
              className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
            >
              M-Pesa phone number <span className="text-[var(--color-accent)]">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="07XX XXX XXX"
              disabled={stage === 'waiting' || stage === 'submitting'}
              className="mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-[16px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
              We'll push a confirmation prompt to this phone. Enter your M-Pesa PIN to approve.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="card_number"
                className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
              >
                Card number <span className="text-[var(--color-accent)]">*</span>
              </label>
              <div className="relative mt-2">
                <input
                  id="card_number"
                  name="card_number"
                  required
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  disabled={stage === 'submitting'}
                  className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 pr-20 text-[16px] tabular-nums text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                {brand ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                    {brand}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="expiry"
                  className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
                >
                  Expiry <span className="text-[var(--color-accent)]">*</span>
                </label>
                <input
                  id="expiry"
                  name="expiry"
                  required
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM / YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  disabled={stage === 'submitting'}
                  className="mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-[16px] tabular-nums text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label
                  htmlFor="cvv"
                  className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
                >
                  CVV <span className="text-[var(--color-accent)]">*</span>
                </label>
                <input
                  id="cvv"
                  name="cvv"
                  required
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                  disabled={stage === 'submitting'}
                  className="mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-[16px] tabular-nums text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
              <Lock className="size-3" />
              Encrypted on your device. Card numbers never reach our server.
            </div>
          </div>
        )}

        {/* Stage panels */}
        {stage === 'waiting' ? (
          <div className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4">
            <div className="flex items-center gap-2.5">
              <div className="size-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
              <span className="text-[13px] font-medium text-[var(--color-fg)]">
                {channel === 'mpesa' ? 'Confirm the prompt on your phone' : 'Waiting for confirmation'}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-[var(--color-fg-muted)]">
              We poll every 3 seconds. This page will move forward automatically.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={stage === 'submitting' || stage === 'waiting' || stage === 'otp' || stage === '3ds'}
          className="w-full"
        >
          {stage === 'submitting'
            ? 'Starting payment…'
            : stage === 'waiting'
              ? 'Awaiting confirmation…'
              : `Pay ${currency} ${amount.toLocaleString()}`}
        </Button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
          <Lock className="size-3" />
          Secured by Paystack · We never store card details
        </div>
      </form>

      {/* OTP modal */}
      {stage === 'otp' ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6">
            <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">Enter the OTP</h3>
            <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">
              Your bank just sent a one-time code to your phone. Enter it below.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="mt-4 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-3 text-center text-[18px] tracking-[0.4em] tabular-nums text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStage('idle')
                  setOtp('')
                }}
                disabled={submittingOtp}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={onSubmitOtp}
                disabled={submittingOtp || otp.length < 4}
              >
                {submittingOtp ? 'Verifying…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3DS iframe modal */}
      {stage === '3ds' && redirectUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2"
        >
          <div className="flex h-full max-h-[680px] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <span className="text-[13px] font-semibold text-[var(--color-fg)]">Card verification</span>
              <button
                type="button"
                className="text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                onClick={() => {
                  stopPolling()
                  setStage('idle')
                  setRedirectUrl(null)
                }}
              >
                Cancel
              </button>
            </div>
            <iframe
              title="3-D Secure verification"
              src={redirectUrl}
              className="flex-1 bg-white"
            />
            <div className="border-t border-[var(--color-border)] px-4 py-2 text-center text-[11px] text-[var(--color-fg-subtle)]">
              We're polling for confirmation. This window closes automatically.
            </div>
          </div>
        </div>
      ) : null}

      {/* Tiny script-loaded indicator (debug-friendly) */}
      {channel === 'card' && !scriptReady ? (
        <p className="mt-3 text-center text-[11px] text-[var(--color-fg-subtle)]">
          Loading secure card encryption…
        </p>
      ) : null}
    </>
  )
}

function ChannelTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border p-4 text-[13px] font-medium transition-colors',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
      )}
    >
      <Icon className="size-5" />
      {label}
    </button>
  )
}

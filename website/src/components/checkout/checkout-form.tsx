'use client'

import * as React from 'react'
import { Banknote, CreditCard, Lock, Smartphone } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Channel = 'mpesa' | 'card' | 'bank'

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
  const [submitting, setSubmitting] = React.useState(false)
  const [polling, setPolling] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const phone = formData.get('phone') as string

    try {
      const res = await fetch('/api/paystack/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId,
          purpose,
          amount,
          channel,
          phone,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Could not start payment')
      }
      const data = (await res.json()) as {
        reference: string
        accessCode?: string
        authorizationUrl?: string
      }

      if (channel === 'card' && data.authorizationUrl) {
        window.location.href = data.authorizationUrl
        return
      }

      // M-Pesa or bank — start polling
      setPolling(true)
      pollPayment(data.reference)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment')
      setSubmitting(false)
    }
  }

  async function pollPayment(reference: string) {
    const start = Date.now()
    const timeoutMs = 90 * 1000

    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`/api/paystack/status/${reference}`)
        if (res.ok) {
          const data = (await res.json()) as { status: string }
          if (data.status === 'success') {
            window.location.href = `/buy/success?ref=${reference}`
            return
          }
          if (data.status === 'failed') {
            window.location.href = `/buy/cancelled?ref=${reference}`
            return
          }
        }
      } catch {
        // ignore — keep polling
      }
      await new Promise((r) => setTimeout(r, 4000))
    }
    setPolling(false)
    setSubmitting(false)
    setError(
      "We didn't receive confirmation in 90 seconds. If your phone showed Success, we'll catch up — refresh the dashboard.",
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Channel tabs */}
      <div className="grid grid-cols-3 gap-2">
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
        <ChannelTab
          active={channel === 'bank'}
          onClick={() => setChannel('bank')}
          icon={Banknote}
          label="Bank"
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
            placeholder="+254 7XX XXX XXX"
            disabled={polling}
            className="mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-[16px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
            We'll push a confirmation prompt to this phone. Enter your M-Pesa PIN when it arrives.
          </p>
        </div>
      ) : channel === 'card' ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)]">
          <Lock className="mb-2 size-4 text-[var(--color-accent)]" />
          You'll be redirected to Paystack's secure card form. Card numbers never reach our
          servers.
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)]">
          We'll generate a dedicated NUBAN account number for this transaction. Transfer the
          amount, and we'll auto-poll for confirmation.
        </div>
      )}

      {polling ? (
        <div className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4">
          <div className="flex items-center gap-2.5">
            <div className="size-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            <span className="text-[13px] font-medium text-[var(--color-fg)]">
              {channel === 'mpesa'
                ? 'Confirm the prompt on your phone'
                : 'Waiting for confirmation'}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-fg-muted)]">
            We poll every 4 seconds. This page will move forward automatically.
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
        disabled={submitting || polling}
        className="w-full"
      >
        {polling
          ? 'Awaiting confirmation...'
          : submitting
            ? 'Starting payment...'
            : `Pay ${currency} ${amount.toLocaleString()}`}
      </Button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
        <Lock className="size-3" />
        Secured by Paystack · We never store card details
      </div>
    </form>
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

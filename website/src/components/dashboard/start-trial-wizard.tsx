'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pill, Storefront, ForkKnife, Hammer, ArrowRight, CheckCircle, Copy,
} from '@phosphor-icons/react'

type Variant = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

interface VariantOption {
  id: Variant
  name: string
  tagline: string
  Icon: typeof Pill
  recommended?: boolean
}

// Pro is intentionally OFF the trial wizard for now — we're not selling
// it publicly, so offering it as a trial pick would create dashboard
// confusion (a user starts a Pro trial, can't buy it, can't downgrade).
// Existing Pro licensees still see their licence via the licences list;
// they don't need this wizard. Re-add { id: 'pro', ...recommended: true }
// to this array when Pro goes back on sale.
const VARIANTS: VariantOption[] = [
  { id: 'dawa',        name: 'Omnix Dawa',        tagline: 'Pharmacy management',                       Icon: Pill,        recommended: true },
  { id: 'retail',      name: 'Omnix Retail',      tagline: 'Shops, mini-marts, dukas',                  Icon: Storefront },
  { id: 'hospitality', name: 'Omnix Hospitality', tagline: 'Restaurants, bars, lodges',                 Icon: ForkKnife },
  { id: 'hardware',    name: 'Omnix Hardware',    tagline: 'Hardware stores, contractors',              Icon: Hammer },
]

interface StartedLicense {
  licenseKey: string
  variant: Variant
  trialEndsAt: string
}

interface Props {
  /** When set (via /dashboard?variant=X), preselect that variant. */
  defaultVariant?: Variant
  /** When the customer already has licences for these variants, hide them
   *  from the picker and offer the remaining ones. Empty = show all. */
  ownedVariants?: string[]
  /** Compact rendering for the "add another variant" surface on a
   *  dashboard that already has licences. */
  compact?: boolean
}

export function StartTrialWizard({ defaultVariant = 'dawa', ownedVariants = [], compact = false }: Props) {
  const router = useRouter()
  const owned = new Set(ownedVariants)
  const available = VARIANTS.filter((v) => !owned.has(v.id))
  // If everything is taken, render a soft "you have all variants" footnote
  // instead of a full wizard.
  const allTaken = available.length === 0
  const initialPick: Variant = available.find((v) => v.id === defaultVariant)?.id ?? available[0]?.id ?? 'dawa'
  const [picked, setPicked] = useState<Variant>(initialPick)
  const [busy, startTransition] = useTransition()
  const [started, setStarted] = useState<StartedLicense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function start() {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/dashboard/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: picked }),
      })
      const j = await res.json()
      if (j.ok) {
        setStarted({
          licenseKey: j.license.licenseKey,
          variant: j.license.variant,
          trialEndsAt: j.license.trialEndsAt,
        })
        router.refresh()
      } else {
        setError(j.error ?? 'Could not start the trial. Please try again.')
      }
    })
  }

  if (started) {
    return <TrialStartedSuccess license={started} copied={copied} setCopied={setCopied} />
  }

  if (allTaken) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-[12px] text-[var(--color-fg-muted)]">
        You already have a licence for every Omnix variant. Need a paid licence?{' '}
        <a href="/buy" className="text-[var(--color-fg)] underline-offset-4 hover:underline">Buy one →</a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] ${compact ? 'p-4' : 'p-6'}`}>
        <header className={compact ? 'mb-3' : 'mb-5'}>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            {compact ? 'Try another trade' : 'Step 1 · Pick your trade'}
          </span>
          {!compact && (
            <h2
              style={{ fontFamily: 'var(--font-display)' }}
              className="mt-1.5 text-[22px] font-medium tracking-[-0.01em] text-[var(--color-fg)]"
            >
              Which Omnix variant runs your business?
            </h2>
          )}
        </header>

        <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-3`}>
          {available.map((v) => {
            const isPicked = picked === v.id
            return (
              <button
                key={v.id}
                onClick={() => setPicked(v.id)}
                className={`text-left rounded-md border p-4 transition-colors ${
                  isPicked
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-border-strong)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <v.Icon
                    weight="regular"
                    className="size-5 shrink-0 mt-0.5"
                    style={{ color: isPicked ? 'var(--color-accent)' : 'var(--color-fg-muted)' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--color-fg)]">{v.name}</span>
                      {v.recommended ? (
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.22em] rounded-sm border px-1.5 py-0.5"
                          style={{ color: 'var(--color-accent)', borderColor: 'var(--color-accent-line)' }}
                        >
                          Pick this if unsure
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-fg-muted)]">{v.tagline}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <footer className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-5">
          <p className="text-[12px] text-[var(--color-fg-muted)] leading-[1.55]">
            30-day trial · runs offline · no card needed. Upgrade to a perpetual licence any time before day 30 to keep going without interruption.
          </p>
          <button
            onClick={start}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-[13px] font-medium text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {busy ? 'Starting…' : 'Start free trial'}
            <ArrowRight weight="bold" className="size-3.5" />
          </button>
        </footer>

        {error ? (
          <div className="mt-4 text-[12px]" style={{ color: 'var(--color-negative)' }}>{error}</div>
        ) : null}
      </div>
    </div>
  )
}

function TrialStartedSuccess({
  license, copied, setCopied,
}: {
  license: StartedLicense
  copied: boolean
  setCopied: (v: boolean) => void
}) {
  const variantOpt = VARIANTS.find((v) => v.id === license.variant)
  const expiresOn = new Date(license.trialEndsAt).toISOString().slice(0, 10)

  function copy() {
    navigator.clipboard?.writeText(license.licenseKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-6">
        <div className="flex items-start gap-3">
          <CheckCircle weight="fill" className="size-6 shrink-0" style={{ color: 'var(--color-accent)' }} />
          <div className="min-w-0">
            <h2
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-[22px] font-medium tracking-[-0.01em] text-[var(--color-fg)]"
            >
              {variantOpt?.name} trial started.
            </h2>
            <p className="mt-1.5 text-[13px] text-[var(--color-fg-muted)] leading-[1.55]">
              You have until <strong className="text-[var(--color-fg)]">{expiresOn}</strong> to try every feature. Save this key — you'll paste it into Omnix on first launch.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] mb-2">
          Your trial licence key
        </div>
        <div className="flex items-center gap-3">
          <code
            className="flex-1 font-mono text-[16px] tabular-nums tracking-[0.08em] text-[var(--color-fg)] select-all py-2"
            style={{ wordBreak: 'break-all' }}
          >
            {license.licenseKey}
          </code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-2 text-[12px] hover:border-[var(--color-border-strong)] transition-colors shrink-0"
          >
            <Copy weight="regular" className="size-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Big Upgrade CTA — sits above "Next steps" so it's visible without
          scrolling. The variant is locked to the trial we just issued so
          the user can't accidentally pay for the wrong module.
          Pro trials skip this entirely: Pro isn't on sale publicly right
          now, so there's no purchase path to send the user down. */}
      {license.variant !== 'pro' && (
        <div className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface)] p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Skip the wait
              </span>
              <h3
                style={{ fontFamily: 'var(--font-display)' }}
                className="text-[18px] font-medium tracking-[-0.01em] text-[var(--color-fg)]"
              >
                Already convinced? Upgrade to a perpetual licence.
              </h3>
              <p className="text-[12.5px] text-[var(--color-fg-muted)] leading-[1.55]">
                KES 30,000 once · {variantOpt?.name}. Pay any time during your trial — your data carries over without re-installing.
              </p>
            </div>
            <a
              href={`/buy?variant=${encodeURIComponent(license.variant)}`}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-5 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-[var(--color-accent)]/90 transition-colors cursor-pointer"
            >
              Upgrade · {variantOpt?.name ?? license.variant}
              <ArrowRight weight="bold" className="size-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] mb-3">
          Next steps
        </h3>
        <ol className="space-y-3 text-[13px] text-[var(--color-fg)] leading-[1.55]">
          <li className="flex gap-3">
            <span className="font-mono text-[11px] text-[var(--color-accent)] mt-0.5">01</span>
            <span>
              <a href="/dashboard/downloads" className="underline-offset-4 hover:underline">
                Download {variantOpt?.name}
              </a> for Windows.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[11px] text-[var(--color-accent)] mt-0.5">02</span>
            <span>Run the installer and open Omnix.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[11px] text-[var(--color-accent)] mt-0.5">03</span>
            <span>Paste this key on the activation screen.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[11px] text-[var(--color-accent)] mt-0.5">04</span>
            <span>Import your products + ring up your first sale.</span>
          </li>
        </ol>
      </div>
    </div>
  )
}

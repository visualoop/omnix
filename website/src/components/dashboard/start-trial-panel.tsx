'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy } from '@/components/icons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format-date'

export const DASHBOARD_TRIAL_VARIANTS = [
  { id: 'dawa', name: 'Pharmacy', detail: 'Chemists, clinics and dispensaries' },
  { id: 'retail', name: 'Retail', detail: 'Shops, mini-marts and general retail' },
  { id: 'hospitality', name: 'Hospitality', detail: 'Restaurants, bars, hotels and lodges' },
  { id: 'hardware', name: 'Hardware & Equipment', detail: 'Stores, yards and equipment dealers' },
  { id: 'salon', name: 'Salon & Spa', detail: 'Salons, barbershops and spas' },
] as const

export type DashboardTrialVariant = (typeof DASHBOARD_TRIAL_VARIANTS)[number]['id']

interface TrialLicense {
  licenseKey: string
  variant: DashboardTrialVariant
  trialEndsAt: string
}

interface TrialResponse {
  ok?: boolean
  error?: string
  license?: TrialLicense
}

interface StartTrialPanelProps {
  availableVariants?: readonly DashboardTrialVariant[]
  defaultVariant?: DashboardTrialVariant
  downloadHref?: string
}

export function StartTrialPanel({
  availableVariants = DASHBOARD_TRIAL_VARIANTS.map((product) => product.id),
  defaultVariant = 'dawa',
  downloadHref = '/dashboard/downloads',
}: StartTrialPanelProps) {
  const router = useRouter()
  const available = DASHBOARD_TRIAL_VARIANTS.filter((product) => availableVariants.includes(product.id))
  const initialVariant = available.some((product) => product.id === defaultVariant)
    ? defaultVariant
    : available[0]?.id ?? 'dawa'
  const [selected, setSelected] = useState<DashboardTrialVariant>(initialVariant)
  const [started, setStarted] = useState<TrialLicense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  if (available.length === 0) return null

  function startTrial() {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/dashboard/trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variant: selected }),
        })
        const result = (await response.json().catch(() => null)) as TrialResponse | null
        if (!response.ok || !result?.ok || !result.license) {
          setError(result?.error ?? 'The trial could not be started. Please try again.')
          return
        }
        setStarted(result.license)
        router.refresh()
      } catch {
        setError('The trial could not be started. Check your connection and try again.')
      }
    })
  }

  async function copyKey() {
    if (!started) return
    try {
      await navigator.clipboard.writeText(started.licenseKey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError('Could not copy automatically. Select the key and copy it manually.')
    }
  }

  if (started) {
    const product = DASHBOARD_TRIAL_VARIANTS.find((candidate) => candidate.id === started.variant)
    return (
      <section aria-labelledby="trial-ready-title" className="flex flex-col gap-4">
        <Alert variant="success" title="Your 30-day trial is ready">
          {product?.name ?? 'Omnix'} is available until {formatDate(started.trialEndsAt)}. No card was charged.
        </Alert>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:p-5">
          <div className="flex items-center gap-2 text-[var(--color-positive)]">
            <CheckCircle2 className="size-4" aria-hidden />
            <h2 id="trial-ready-title" className="font-display text-[17px] font-semibold text-[var(--color-fg)]">
              Copy this key before you install
            </h2>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-fg-muted)]">
            Paste it into Omnix on first launch. Your business data remains on this PC if you later choose a perpetual licence.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 select-all break-all rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 font-mono text-[13px] tracking-[0.06em] text-[var(--color-fg)]">
              {started.licenseKey}
            </code>
            <Button type="button" variant="outline" onClick={copyKey}>
              <Copy className="size-4" aria-hidden />
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-5 text-[var(--color-fg-subtle)]">
              After 30 days, open Licences if you decide to keep using Omnix.
            </p>
            <Button asChild>
              <Link href={downloadHref}>Download for Windows</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="start-trial-title" className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:p-6">
      <header className="max-w-2xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
          30-day trial
        </span>
        <h2 id="start-trial-title" className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Try it in your business first.
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-fg-muted)]">
          Choose the product that matches your trade. The full Windows app works for 30 days, including offline, with no card required.
        </p>
      </header>

      <fieldset className="mt-5">
        <legend className="sr-only">Choose a product for your trial</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((product) => {
            const active = selected === product.id
            return (
              <button
                key={product.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(product.id)}
                className={cn(
                  'min-h-20 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left outline-none transition-[transform,background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98]',
                  'focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-border-strong)]',
                )}
              >
                <span className="block text-[13px] font-semibold text-[var(--color-fg)]">{product.name}</span>
                <span className="mt-1 block text-[11px] leading-4 text-[var(--color-fg-muted)]">{product.detail}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {error ? (
        <Alert className="mt-4" variant="error" title="Could not start the trial">
          {error}
        </Alert>
      ) : null}

      <footer className="mt-5 flex flex-col gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-[var(--color-fg-subtle)]">
          One trial per product and device. No payment details needed.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="ghost">
            <Link href="/contact?type=demo">Book a demo instead</Link>
          </Button>
          <Button type="button" onClick={startTrial} disabled={pending}>
            {pending ? 'Preparing your trial…' : 'Start 30-day trial'}
          </Button>
        </div>
      </footer>
    </section>
  )
}

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
'use client'

import * as React from 'react'
import Link from 'next/link'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  trackConversion,
  type ConversionLocale,
  type ConversionProduct,
} from '@/lib/analytics/track'

const PRODUCTS = [
  { value: 'pharmacy', label: 'Pharmacy', detail: 'Dispensing, expiry, stock and patient records' },
  { value: 'retail', label: 'Retail', detail: 'POS and inventory for shops and mini-marts' },
  { value: 'hospitality', label: 'Hospitality', detail: 'Restaurant POS, kitchen orders and rooms' },
  { value: 'hardware', label: 'Hardware & Equipment', detail: 'Quotations, contractor accounts, serialized equipment and stock' },
  { value: 'salon', label: 'Salon & Spa', detail: 'Appointments, services, staff commissions and checkout' },
] as const

const PRIORITIES = [
  { value: 'pos', label: 'Faster POS' },
  { value: 'inventory', label: 'Inventory control' },
  { value: 'mpesa', label: 'M-Pesa reconciliation' },
  { value: 'etims', label: 'KRA eTIMS' },
  { value: 'migration', label: 'Data migration' },
  { value: 'reporting', label: 'Business reports' },
  { value: 'multi-location', label: 'Multiple locations' },
  { value: 'pharmacy-workflows', label: 'Pharmacy workflows' },
  { value: 'hospitality-workflows', label: 'Hospitality workflows' },
  { value: 'salon-workflows', label: 'Salon workflows' },
] as const

const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

type Product = (typeof PRODUCTS)[number]['value']
type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string; fields?: Record<string, string[]> }
  | { kind: 'success'; reference: string }

export interface DemoBookingFormProps {
  initialProduct?: Product
  locale: string
  whatsappUrl: string | null
}

export function DemoBookingForm({ initialProduct, locale, whatsappUrl }: DemoBookingFormProps) {
  const [state, setState] = React.useState<FormState>({ kind: 'idle' })
  const [preferredChannel, setPreferredChannel] = React.useState('whatsapp')
  const [preferredWindow, setPreferredWindow] = React.useState('anytime')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = (name: string) => String(data.get(name) ?? '').trim()
    const params = new URLSearchParams(window.location.search)
    const attribution = Object.fromEntries(
      ATTRIBUTION_KEYS.flatMap((key) => {
        const value = params.get(key)?.trim()
        return value ? [[key, value.slice(0, 160)]] : []
      }),
    )

    setState({ kind: 'submitting' })

    try {
      const response = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: text('fullName'),
          workEmail: text('workEmail'),
          phone: text('phone'),
          businessName: text('businessName'),
          product: text('product'),
          locationCount: Number(text('locationCount')),
          currentSystem: text('currentSystem') || undefined,
          priorities: data.getAll('priorities').map(String),
          notes: text('notes') || undefined,
          preferredChannel: text('preferredChannel'),
          preferredWindow: text('preferredWindow'),
          locale,
          sourcePath: window.location.pathname,
          referrer: document.referrer || undefined,
          attribution,
          marketingOptIn: data.has('marketingOptIn'),
          website: text('website'),
        }),
      })
      const result = await response.json().catch(() => null) as null | {
        ok?: boolean
        error?: string
        reference?: string
        fields?: Record<string, string[]>
      }

      if (!response.ok || !result?.ok || !result.reference) {
        const message = response.status === 429
          ? 'Too many requests were sent from this connection. Wait a few minutes, then try again.'
          : response.status === 503
            ? 'Demo requests are temporarily unavailable. Use WhatsApp or try again shortly.'
            : 'Check the highlighted details and try again.'
        setState({ kind: 'error', message, fields: result?.fields })
        return
      }

      setState({ kind: 'success', reference: result.reference })
      // Conversion signal only after a persisted success. Closed dimensions —
      // never the name, email, phone, business name, notes, or reference.
      trackConversion('generate_lead', {
        product: text('product') as ConversionProduct,
        locale: locale as ConversionLocale,
        surface: 'demo_form',
      })
      form.reset()
    } catch {
      setState({
        kind: 'error',
        message: 'The request could not be sent. Check your connection and try again, or use WhatsApp.',
      })
    }
  }

  if (state.kind === 'success') {
    return (
      <div className="border-y border-[var(--color-border)] py-8 sm:py-10" role="status" aria-live="polite">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-positive)]">
          Request recorded · {state.reference}
        </p>
        <h2 className="mt-3 text-balance text-[clamp(1.75rem,5vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-fg)]">
          We have what we need to prepare.
        </h2>
        <p className="mt-4 max-w-[55ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
          A member of the Omnix team will use your chosen channel to confirm a suitable demo time. A copy of the request has been sent to your email when delivery is available.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          {whatsappUrl ? (
            <Button asChild size="lg">
              <a href={whatsappUrl}>Continue on WhatsApp</a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="lg" onClick={() => setState({ kind: 'idle' })}>
            Send another request
          </Button>
        </div>
      </div>
    )
  }

  const fieldError = (name: string) => state.kind === 'error' ? state.fields?.[name]?.[0] : undefined

  return (
    <form onSubmit={onSubmit} className="grid min-w-0 gap-10" noValidate>
      <fieldset className="min-w-0">
        <legend className="text-[16px] font-semibold text-[var(--color-fg)]">1. Choose your business</legend>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">We will prepare the matching workflows.</p>
        <div className="mt-5 grid min-w-0 gap-2 sm:grid-cols-2">
          {PRODUCTS.map((product) => (
            <label key={product.value} className="group relative min-w-0 cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="product"
                value={product.value}
                defaultChecked={(initialProduct ?? 'pharmacy') === product.value}
                required
              />
              <span className={cn(
                'grid min-h-24 content-start rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4',
                'transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                'group-hover:border-[var(--color-fg-subtle)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-line)]',
                'peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent-soft)]',
              )}>
                <span className="font-ui text-[14px] font-semibold text-[var(--color-fg)]">{product.label}</span>
                <span className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">{product.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldError('product') ? <p role="alert" className="mt-2 text-[12px] text-[var(--color-negative)]">{fieldError('product')}</p> : null}
      </fieldset>

      <fieldset className="grid min-w-0 gap-4">
        <legend className="mb-5 text-[16px] font-semibold text-[var(--color-fg)]">2. Tell us about the setup</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field label="Business name" required error={fieldError('businessName')}>
            <Input name="businessName" autoComplete="organization" placeholder="Your business name" />
          </Field>
          <Field label="Number of locations" required error={fieldError('locationCount')}>
            <Input name="locationCount" type="number" inputMode="numeric" min={1} max={250} defaultValue={1} />
          </Field>
        </div>
        <Field label="What do you use now?" optional error={fieldError('currentSystem')}>
          <Input name="currentSystem" placeholder="Books, spreadsheets, or another POS" maxLength={160} />
        </Field>

        <div>
          <p className="text-[12px] font-semibold text-[var(--color-fg)]">What should the demo focus on?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PRIORITIES.map((priority) => (
              <label key={priority.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]">
                <Checkbox name="priorities" value={priority.value} />
                <span>{priority.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Anything specific to show?" optional error={fieldError('notes')}>
          <Textarea name="notes" maxLength={2000} placeholder="A workflow, report, payment method, or migration question" />
        </Field>
      </fieldset>

      <fieldset className="grid min-w-0 gap-4">
        <legend className="mb-5 text-[16px] font-semibold text-[var(--color-fg)]">3. Where should we reach you?</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={fieldError('fullName')}>
            <Input name="fullName" autoComplete="name" placeholder="Your name" />
          </Field>
          <Field label="Work email" required error={fieldError('workEmail')}>
            <Input name="workEmail" type="email" autoComplete="email" inputMode="email" placeholder="you@business.co.ke" />
          </Field>
        </div>
        <Field label="Phone or WhatsApp number" required error={fieldError('phone')} description="Include the country code if you are outside Kenya.">
          <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+254 7XX XXX XXX" />
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor="preferred-channel" className="font-ui text-[12px] font-semibold text-[var(--color-fg)]">
              Preferred channel <span className="text-[var(--color-accent)]">*</span>
            </label>
            <select
              id="preferred-channel"
              name="preferredChannel"
              value={preferredChannel}
              onChange={(event) => setPreferredChannel(event.target.value)}
              required
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5 font-sans text-[14px] text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone call</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor="preferred-window" className="font-ui text-[12px] font-semibold text-[var(--color-fg)]">
              Best contact window <span className="text-[var(--color-accent)]">*</span>
            </label>
            <select
              id="preferred-window"
              name="preferredWindow"
              value={preferredWindow}
              onChange={(event) => setPreferredWindow(event.target.value)}
              required
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5 font-sans text-[14px] text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]"
            >
              <option value="morning">Morning · 8am–12pm EAT</option>
              <option value="afternoon">Afternoon · 12pm–5pm EAT</option>
              <option value="evening">Evening · 5pm–7pm EAT</option>
              <option value="anytime">Any time</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
        <label htmlFor="demo-website">Website</label>
        <Input id="demo-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-5 text-[var(--color-fg-muted)]">
        <Checkbox name="marketingOptIn" value="true" className="mt-0.5" />
        <span>Email me concise product updates. This is optional and separate from this demo request.</span>
      </label>

      {state.kind === 'error' ? <Alert variant="error" title="The request was not sent">{state.message}</Alert> : null}

      <div className="grid gap-3 border-t border-[var(--color-border)] pt-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <Button type="submit" size="lg" disabled={state.kind === 'submitting'}>
          {state.kind === 'submitting' ? 'Recording request…' : 'Book my demo'}
        </Button>
        <p className="text-[11px] leading-5 text-[var(--color-fg-subtle)]">
          By sending this request, you agree that Omnix may use these details to arrange the demo. Read the{' '}
          <Link href={`/${locale}/privacy`} className="underline underline-offset-4 hover:text-[var(--color-fg)]">privacy policy</Link>.
        </p>
      </div>
    </form>
  )
}

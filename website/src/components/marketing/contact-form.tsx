/* Hallmark · Working Counter · procedural contact routing · no simulated delivery */
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export interface ContactFormProps {
  locale: string
  supportEmail: string
  whatsappUrl: string | null
  whatsappDisplay: string | null
}

export function ContactForm({
  locale,
  supportEmail,
  whatsappUrl,
  whatsappDisplay,
}: ContactFormProps) {
  const demoHref = `/${locale}/contact?type=demo`
  const whatsappHref = whatsappUrl
    ? `${whatsappUrl}${whatsappUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent('Hi Omnix, I would like to ask about Omnix for my business.')}`
    : null

  return (
    <section aria-labelledby="contact-routes-heading" className="min-w-0">
      <div className="grid min-w-0 gap-px border-y border-[var(--color-border)] bg-[var(--color-border)] lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="min-w-0 bg-[var(--color-bg)] py-8 lg:py-10 lg:pr-12">
          <h2 id="contact-routes-heading" className="max-w-[12ch] text-[clamp(2rem,5vw,4.25rem)] leading-[0.95] tracking-[-0.05em]">
            See your own workflow in Omnix.
          </h2>
          <p className="mt-5 max-w-[56ch] text-[14px] leading-6 text-[var(--color-fg-muted)] sm:text-[15px]">
            The demo form records your business type, locations, priorities, and preferred contact channel so the team can prepare the relevant counter and back-office flow.
          </p>
          <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={demoHref}>Book a demo</Link>
            </Button>
            {whatsappHref ? (
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  Ask on WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 bg-[var(--color-bg)] py-8 lg:py-10 lg:pl-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">What each action does</p>
          <ol className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            <li className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-5">
              <Icon.ClipboardList className="mt-0.5 size-5 text-[var(--color-accent)]" weight="bold" />
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold tracking-[-0.02em]">Demo request</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">Opens the dedicated form. A successful submission is stored for follow-up and returns a request reference.</p>
              </div>
            </li>
            {whatsappHref ? (
              <li className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-5">
                <Icon.WhatsApp className="mt-0.5 size-5 text-[var(--color-accent)]" weight="bold" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold tracking-[-0.02em]">WhatsApp</h3>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">Opens the configured Omnix chat{whatsappDisplay ? ` at ${whatsappDisplay}` : ''}. This page does not send a message for you.</p>
                </div>
              </li>
            ) : null}
            <li className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-5">
              <Icon.Email className="mt-0.5 size-5 text-[var(--color-accent)]" weight="bold" />
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold tracking-[-0.02em]">Support email</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">Opens your email application with the Omnix support address. Sending remains under your control.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 border-b border-[var(--color-border)] py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-fg)]">Already using Omnix?</p>
          <p className="mt-1 max-w-[65ch] text-[12px] leading-5 text-[var(--color-fg-muted)]">
            Include the affected device, Omnix version, and the steps that produced the issue. Do not email passwords or backup passwords.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <a href={`mailto:${supportEmail}?subject=${encodeURIComponent('Omnix support request')}`}>Email support</a>
        </Button>
      </div>
    </section>
  )
}

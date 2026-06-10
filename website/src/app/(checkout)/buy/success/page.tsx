import Link from 'next/link'
import { ArrowRight, CheckCircle2, Download, FileText, Sparkles } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata = { title: 'Payment successful' }

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; reference?: string; trxref?: string }>
}) {
  const settings = await getSiteSettings();
  const params = await searchParams
  // Paystack's hosted-checkout redirect uses ?reference= and ?trxref=.
  // Our in-app popup uses ?ref=. Accept either.
  const ref = params.ref ?? params.reference ?? params.trxref ?? null

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pt-12 pb-20">
      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-10 text-center lg:p-14">
          <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="mt-6 font-display text-[clamp(32px,4vw,48px)] font-medium leading-[1.05] text-[var(--color-fg)]">
            Payment received.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-[16px] leading-[1.55] text-[var(--color-fg-muted)]">
            Your licence is active. We've sent the receipt to your email and the licence key is
            in your dashboard.
          </p>
          {ref ? (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-1.5 font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
              <Sparkles className="size-3 text-[var(--color-accent)]" />
              Reference {ref}
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <NextStep
            icon={Download}
            title="Download installer"
            body="Get Omnix for Windows. Install in under five minutes."
            cta="Open downloads"
            href="/dashboard/downloads"
          />
          <NextStep
            icon={FileText}
            title="Read first-sale guide"
            body="From product import to your first KRA-receipted sale."
            cta="Read guide"
            href="/docs/getting-started"
          />
          <NextStep
            icon={ArrowRight}
            title="Manage licence"
            body="Activate machines, add cloud backup, invite staff."
            cta="Open dashboard"
            href="/dashboard"
          />
        </div>

        <div className="mt-12 text-center">
          <p className="text-[13px] text-[var(--color-fg-subtle)]">
            Stuck or unsure?{' '}
            <a
              href={settings.whatsappUrl ?? `mailto:${settings.supportEmail}`}
              className="text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              WhatsApp the owner
            </a>{' '}
            — usually answered within an hour.
          </p>
        </div>
      </div>
    </div>
  )
}

function NextStep({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  cta: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]"
    >
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="font-display text-[16px] font-medium text-[var(--color-fg)]">
          {title}
        </h3>
        <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-fg-muted)]">
          {body}
        </p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-accent)]">
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

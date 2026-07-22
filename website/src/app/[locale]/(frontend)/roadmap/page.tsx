/* Hallmark · Working Counter · roadmap ledger · shipped, planned, exploring */
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/roadmap`
  return {
    title: 'Roadmap — shipped, planned, exploring',
    description:
      'The honest Omnix roadmap: what has shipped, what is being built now, and what we are still exploring. No calendar promises — the order changes as the business does.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/roadmap'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'The Omnix roadmap',
      description: 'What has shipped, what is in progress, and what we are exploring — without dated promises.',
      type: 'website',
    }),
  }
}

interface RoadmapItem {
  title: string
  body: string
}

interface Lane {
  id: 'shipped' | 'in-progress' | 'exploring'
  label: string
  note: string
  dot: string
  items: RoadmapItem[]
}

// Lanes describe status, never a delivery date. "Shipped" items reference the
// release they landed in (see the changelog); nothing here is a promise. A lane
// may legitimately be sparse or empty — we only list what is factual and
// publicly committed, never speculative positioning.
const LANES: Lane[] = [
  {
    id: 'shipped',
    label: 'Shipped',
    note: 'In customers’ hands now — see the changelog for the release it landed in.',
    dot: 'bg-[var(--color-positive)]',
    items: [
      {
        title: 'Module identity refresh (v0.14)',
        body: 'Pharmacy, Retail, Hardware and Hospitality each got a distinct, disciplined accent identity across the desktop app.',
      },
      {
        title: 'Transactional sales & voids (v0.14)',
        body: 'Every sale, void and refund is all-or-nothing, with integer-cents money end to end so receipts and reports always reconcile.',
      },
      {
        title: 'M-Pesa sandbox auto-confirm',
        body: 'Test the till flow end to end even when Safaricom’s sandbox does not deliver a callback. Production payments are untouched.',
      },
    ],
  },
  {
    id: 'in-progress',
    label: 'In progress',
    note: 'Being built now. Scope is firm; timing is not committed.',
    dot: 'bg-[var(--color-accent)]',
    items: [
      {
        title: 'Industry pages on the website',
        body: 'Dedicated pages for pharmacies, retail, restaurants, hardware and multi-branch operators with real workflows and trade-specific proof.',
      },
    ],
  },
  {
    id: 'exploring',
    label: 'Exploring',
    note: 'Ideas we are investigating. These may change shape or not ship at all.',
    dot: 'bg-[var(--color-fg-subtle)]',
    items: [
      {
        title: 'Further verticals',
        body: 'Electronics (IMEI, warranty, repairs) and deeper salon/spa tooling — driven by demand, not assumption.',
      },
    ],
  },
]

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const changelogHref = `/${locale}/changelog`
  const demoHref = `/${locale}/contact?type=demo`

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        {/* Masthead */}
        <header className="grid min-w-0 gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div className="min-w-0">
            <p className="caption-mono text-[var(--color-accent)]">Public roadmap</p>
            <h1 className="mt-4 max-w-[16ch] text-balance text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--color-fg)]">
              Shipped, planned, and exploring.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              The honest version, in three lanes. No calendar promises — the order moves as the
              business does. Shipped work is verifiable in the changelog; everything else is a
              direction, not a date.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={changelogHref}>See what shipped</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a demo</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-px border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-3">
          {LANES.map((lane) => (
            <section
              key={lane.id}
              aria-labelledby={`lane-${lane.id}`}
              className="min-w-0 bg-[var(--color-bg)] px-0 py-10 sm:py-12 md:px-6 lg:px-8"
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className={`size-2.5 rounded-full ${lane.dot}`} />
                <h2
                  id={`lane-${lane.id}`}
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-fg)]"
                >
                  {lane.label}
                </h2>
              </div>
              <p className="mt-3 max-w-[40ch] text-[12px] leading-5 text-[var(--color-fg-subtle)]">
                {lane.note}
              </p>
              {lane.items.length === 0 ? (
                <p className="mt-7 max-w-[40ch] text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
                  Nothing publicly committed here yet.
                </p>
              ) : (
                <ul className="mt-7 space-y-6">
                  {lane.items.map((item) => (
                    <li key={item.title} className="border-l border-[var(--color-border-strong)] pl-5">
                      <h3 className="text-[15px] font-semibold leading-[1.25] tracking-[-0.01em] text-[var(--color-fg)]">
                        {item.title}
                      </h3>
                      <p className="mt-2 max-w-[44ch] text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Closing — demo-led, no gradient band, no signup/trial CTA */}
        <section
          aria-labelledby="roadmap-cta"
          className="mt-12 grid min-w-0 gap-6 border-t-2 border-[var(--color-fg)] py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:py-12"
        >
          <div className="min-w-0">
            <h2
              id="roadmap-cta"
              className="text-[clamp(1.5rem,3.5vw,2.4rem)] leading-none tracking-[-0.04em] text-[var(--color-fg)]"
            >
              Want something on this list?
            </h2>
            <p className="mt-4 max-w-[60ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
              The fastest way to shape the roadmap is to show us how you work. Book a demo and tell
              us what would make the difference for your counter.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={demoHref}>Book a demo</Link>
          </Button>
        </section>
      </PageContainer>
    </div>
  )
}

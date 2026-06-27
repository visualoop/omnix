import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { MigrationScene } from '@/components/marketing/illustrations/scenes'

export const metadata: Metadata = {
  title: 'Switch to Omnix in a day — migration & onboarding',
  description:
    'Bring your products, customers, suppliers and opening stock in one afternoon. The Omnix AI assistant harmonises any spreadsheet — even with messy headers — and previews everything before you commit.',
}

const STEPS = [
  {
    n: '01',
    title: 'Export from your current tool',
    body: 'Whatever you use — a subscription POS, QuickBooks, a stack of Excel files, a paper book typed into Sheets — Omnix can take it. Export products, customers, suppliers, and a stock snapshot as CSV or Excel. We accept whatever columns you have; we don\'t require a specific template.',
  },
  {
    n: '02',
    title: 'Drop the file. AI maps the columns.',
    body: 'Open Omnix → Inventory → Import, drop your file in. The AI assistant detects the structure, maps your headers to Omnix fields (in English or Swahili), normalises units and prices, and flags duplicates against your existing catalogue. Headers like "Bei ya Kuuza" or "Item code" or "qty pakd" all resolve automatically.',
  },
  {
    n: '03',
    title: 'Preview every row before commit',
    body: 'Nothing imports until you say so. You see exactly what will be created, what will be merged, and what was unclear. Edit anything that needs a human touch — categories, prices, supplier names — and the AI learns your mappings for next time.',
  },
  {
    n: '04',
    title: 'Open the day',
    body: 'Receipts print, stock decrements, M-Pesa reconciles, eTIMS files. Your accountant sees real numbers from day one. The old subscription? You can cancel the day after the first till close.',
  },
]

const SCENARIOS = [
  { title: 'From a subscription POS', body: 'Most cloud POS tools export products, customers and a stock snapshot. We\'ve seen exports from common Kenyan POS systems work first time.' },
  { title: 'From Excel spreadsheets', body: 'Even three or four overlapping sheets with different column orders — the assistant maps them all to one canonical catalogue and previews dedupe candidates.' },
  { title: 'From paper books', body: 'Type the book into one sheet (or photograph the pages — we\'re shipping vision OCR). The assistant fills in categories, tax classes and units.' },
  { title: 'Mid-month switch', body: 'Open Omnix alongside your old tool for a week. When the till closes match, retire the old subscription. We\'ll help you do the cutover safely.' },
]

const CHECKLIST = [
  'Owner has a KRA PIN ready',
  'Computer running Windows 10 / 11 (64-bit, 4 GB RAM minimum)',
  'M-Pesa Daraja credentials (or your Paybill/Till details for manual flow)',
  'eTIMS control unit details from KRA',
  'A spreadsheet of products with name, buying price, selling price',
  'A list of regular customers (optional but recommended)',
  'A list of suppliers with phone numbers',
]

export default async function MigrationPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="Migration & onboarding"
        title={<>Switch in <em>an afternoon.</em></>}
        description="The single biggest reason owners stay on bad software is the fear of moving. Omnix's AI assistant does the painful part — the mapping, the matching, the unit-normalising — and previews every row before anything saves."
      >
        <div className="mt-6 flex items-center gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Link href="/contact" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            Talk to us about your data <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </PageHero>

      {/* ── Scene ─────────────────────────────────────────────────────── */}
      <section className="-mt-8 pb-8">
        <div className="container-wide">
          <div className="mx-auto max-w-[860px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-[var(--color-accent)] sm:p-12">
            <MigrationScene className="block w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ── Steps ──────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">The four steps</span>
            <h2 className="headline-section mt-5 text-balance">
              From your data to a working till. <em>Same day.</em>
            </h2>
          </div>
          <ol className="mt-16 space-y-12">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-1 gap-6 md:grid-cols-[120px_1fr] md:gap-12">
                <span className="font-[family-name:var(--font-display)] text-[clamp(56px,6vw,88px)] font-light leading-none text-[var(--color-accent)]">
                  {s.n}
                </span>
                <div>
                  <h3 className="headline-sub text-[26px]">{s.title}</h3>
                  <p className="mt-3 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[56ch]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Scenarios ──────────────────────────────────────────────────── */}
      <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">Common moves</span>
            <h2 className="headline-section mt-5 text-balance">
              Whatever you&rsquo;re leaving, we&rsquo;ve probably seen it.
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-2">
            {SCENARIOS.map((s) => (
              <div key={s.title} className="bg-[var(--color-bg)] p-7 lg:p-9">
                <h3 className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[var(--color-fg)]">{s.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[44ch]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Checklist ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <span className="eyebrow">Before you start</span>
              <h2 className="headline-section mt-5 text-balance">
                What to have <em>ready.</em>
              </h2>
              <p className="lede mt-7">
                None of this is mandatory; everything can be filled in later. But a clean
                start makes the first day smoother and the AI assistant smarter — it learns
                your mappings as you go.
              </p>
            </div>
            <ul className="space-y-3">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-3 border-b border-[var(--color-border)] pb-3">
                  <Icon.Check className="mt-1 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                  <span className="text-[15px] leading-[1.5] text-[var(--color-fg)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}

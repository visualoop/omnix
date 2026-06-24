import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { OnePriceSection } from '@/components/landing/one-price-section'
import { FaqSection } from '@/components/landing/faq-section'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { PageHero } from '@/components/marketing/page-hero'
import { cn } from '@/lib/cn'
import { CURRENCIES, formatPrice, currencyForCountry, type SupportedCurrency } from '@/lib/currency'
import { pricing } from '@/config/pricing'
import { COUNTRY_TO_CURRENCY } from '@/i18n/routing'

export const metadata: Metadata = {
  title: 'Pricing — pay once, use forever',
  description:
    'Pay once, perpetual licence. Pick a trade variant or Pro for all four. No annual fees, no subscription. Free 30-day trial.',
}

interface VariantTile {
  id: string
  name: string
  tagline: string
  href: string
  price: string
  badge?: string
}

/**
 * Resolve the currency to render in. Order of preference:
 *   1. The locale URL prefix (/us/pricing → USD, /ke/pricing → KES, etc.)
 *   2. The omnix_currency cookie set by middleware
 *   3. USD as a final fallback
 *
 * locale is passed from the [locale] route segment.
 */
async function resolveCurrency(locale: string | undefined): Promise<SupportedCurrency> {
  if (locale) {
    const fromLocale = COUNTRY_TO_CURRENCY[locale.toLowerCase()]
    if (fromLocale && fromLocale in CURRENCIES) return fromLocale as SupportedCurrency
  }
  const cookieStore = await cookies()
  const c = cookieStore.get('omnix_currency')?.value
  if (c && c in CURRENCIES) return c as SupportedCurrency
  return currencyForCountry(undefined)
}

function buildVariants(currency: SupportedCurrency): ReadonlyArray<VariantTile> {
  const proPrice = formatPrice(pricing.business.oneTimeFee[currency], currency)
  const tradePrice = formatPrice(pricing.starter.oneTimeFee[currency], currency)
  return [
    { id: 'pro', name: 'Omnix Pro', tagline: 'All four trades — multi-trade businesses', href: '/pro', price: proPrice, badge: 'Recommended' },
    { id: 'dawa', name: 'Omnix Dawa', tagline: 'Pharmacy management', price: tradePrice, href: '/dawa' },
    { id: 'retail', name: 'Omnix Retail', tagline: 'Shops, mini-marts, dukas', price: tradePrice, href: '/retail' },
    { id: 'hospitality', name: 'Omnix Hospitality', tagline: 'Restaurants, bars, lodges', price: tradePrice, href: '/hospitality' },
    { id: 'hardware', name: 'Omnix Hardware', tagline: 'Hardware stores, contractors', price: tradePrice, href: '/hardware' },
  ]
}

function buildTiers(currency: SupportedCurrency) {
  const trialDays = 30
  const tradePriceNum = pricing.starter.oneTimeFee[currency]
  const proPriceNum = pricing.business.oneTimeFee[currency]
  const tradePrice = formatPrice(tradePriceNum, currency)
  const proPrice = formatPrice(proPriceNum, currency)
  return [
    {
      name: 'Free trial',
      cadence: `${trialDays} days · no card`,
      price: formatPrice(0, currency),
      body: 'Pick any variant. Multi-branch, multi-PC. The trial database becomes your live database the day you pay.',
      href: '/signup',
      cta: 'Start free trial',
      primary: false,
    },
    {
      name: 'Omnix licence',
      cadence: 'one-time · perpetual',
      price: tradePrice,
      body: `Per device. Trade variants (Dawa / Retail / Hospitality / Hardware) ${tradePrice} one-time. Pro (all four) ${proPrice} one-time. Perpetual licence — no annual fees.`,
      href: '/signup?intent=buy',
      cta: 'Buy a licence',
      primary: true,
    },
    {
      name: 'Custom',
      cadence: 'chains · NGOs · on-prem',
      price: 'Talk to us',
      body: '5+ branches, custom integrations, dedicated onboarding, signed SLA, on-prem deployment. We meet your CFO, build the install plan, and stand up the system.',
      href: '/contact?type=enterprise',
      cta: 'Book a call',
      primary: false,
    },
  ] as const
}

function buildAddons(currency: SupportedCurrency) {
  const cloud = pricing.cloudBackupMonthly[currency]
  const extraMachine = pricing.extraMachineOneTime[currency]
  const trainingDayKES = 25_000
  // On-site training is a Kenya-only number; we don't expose it for global
  // visitors yet. Keep the KES copy on /ke; hide elsewhere.
  const trainingPrice = currency === 'KES'
    ? `${formatPrice(trainingDayKES, 'KES')} · per day`
    : 'On request'
  return [
    { name: 'Cloud backup',        price: `${formatPrice(cloud, currency)} · / month / branch`, body: 'Encrypted nightly snapshots to Cloudflare R2. Restore in minutes after a stolen or lost machine.' },
    { name: 'Extra machine seat',  price: `${formatPrice(extraMachine, currency)} · one-time`,    body: 'Raise the number of PCs that can activate against your licence beyond the included 10.' },
    { name: 'Major upgrade',       price: '50% off · list price',                                  body: 'When v2.x ships, current owners pay half. Stay on v1.x as long as you like.' },
    { name: 'On-site training',    price: trainingPrice,                                           body: 'A trainer walks your team through setup, POS, payroll and KRA filings in your office.' },
  ] as const
}

const COMPARE: ReadonlyArray<readonly [string, string, string, string]> = [
  ['All current modules', 'check', 'check', 'check'],
  ['Branches', '1', 'Up to 5', 'Unlimited'],
  ['Workstations (PCs)', '3', '10', 'Unlimited'],
  ['Trial duration', '30 days', '—', '—'],
  ['Maintenance / statutory updates', '30-day window', '1 year free', 'Continuous + SLA'],
  ['M-Pesa STK + reconciliation', 'check', 'check', 'check'],
  ['KRA eTIMS auto-receipt', 'check', 'check', 'check'],
  ['NHIF / SHA insurance billing', 'check', 'check', 'check'],
  ['Cloud backup', 'add-on', 'add-on', 'check'],
  ['Priority WhatsApp support', 'dash', 'check', 'check'],
  ['Dedicated onboarding', 'dash', 'dash', 'check'],
  ['Custom integrations', 'dash', 'dash', 'check'],
  ['On-prem deployment', 'dash', 'dash', 'check'],
  ['Service Level Agreement', 'dash', 'dash', 'check'],
  ['Refund window after payment', 'n/a', '14 days', 'Per contract'],
]

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [settings, currency] = await Promise.all([getSiteSettings(), resolveCurrency(locale)])
  const VARIANTS = buildVariants(currency)
  const TIERS = buildTiers(currency)
  const ADDONS = buildAddons(currency)
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={<>Pay once. <em>Use forever.</em></>}
        description="One product, one fee. No subscriptions, no per-user upcharges, no surprise renewal emails. Free 30-day trial first — you only pay if you keep it."
      />

      <OnePriceSection
        price={pricing.starter.oneTimeFee[currency].toLocaleString('en-US')}
        currency={CURRENCIES[currency].symbol}
      />

      <section className="section-tight">
        <div className="container-wide">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">Pick your trade</span>
            <h2 className="headline-section mt-5 text-balance">Same price. <em>Five variants.</em></h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">
              The licence price is the same regardless of variant. Pick the binary that's purpose-built for your trade — or pick Pro if you run more than one.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {VARIANTS.map((v) => (
              <Link
                key={v.id}
                href={v.href}
                className="group relative flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-accent)]/40"
              >
                {v.badge ? (
                  <span className="absolute right-3 top-3 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-0.5 font-[family-name:var(--font-ui)] text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    {v.badge}
                  </span>
                ) : null}
                <div className="font-[family-name:var(--font-display)] text-[20px] font-normal text-[var(--color-fg)] leading-tight">
                  {v.name}
                </div>
                <div className="text-[13px] text-[var(--color-fg-muted)] leading-snug">
                  {v.tagline}
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[13px] font-medium tabular-nums text-[var(--color-accent)]">
                  {v.price}
                </div>
                <div className="font-[family-name:var(--font-ui)] mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                  Read more
                  <Icon.ArrowRight className="size-3" weight="bold" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-wide">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">Three ways in</span>
            <h2 className="headline-section mt-5 text-balance">Same software. <em>Three doors.</em></h2>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className={cn('relative flex flex-col gap-8 p-8 lg:p-12', tier.primary ? 'bg-[var(--color-surface-2)]' : 'bg-[var(--color-surface)]')}>
                <div>
                  <div className="caption-mono">{tier.cadence}</div>
                  <h3 className="font-[family-name:var(--font-display)] mt-3 text-[clamp(28px,2.4vw,36px)] font-normal leading-[1.05] tracking-[-0.018em] text-[var(--color-fg)]">{tier.name}</h3>
                </div>
                <div className="font-[family-name:var(--font-display)] text-[clamp(40px,4.5vw,56px)] font-light leading-none tracking-[-0.025em] text-[var(--color-fg)]">{tier.price}</div>
                <p className="text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[36ch]">{tier.body}</p>
                <Button asChild size="lg" variant={tier.primary ? 'default' : 'outline'} className="mt-auto w-full">
                  <Link href={tier.href} className="gap-2">{tier.cta}<Icon.ArrowRight className="size-3.5" weight="bold" /></Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-default">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">Optional add-ons</span>
            <h2 className="headline-section mt-5 text-balance">Add what you need. <em>Skip what you don&rsquo;t.</em></h2>
          </div>
          <ul>
            {ADDONS.map((addon, i) => (
              <li key={addon.name} className={i === ADDONS.length - 1 ? 'border-y border-[var(--color-border)] py-7' : 'border-t border-[var(--color-border)] py-7'}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_2fr] md:gap-12">
                  <div className="font-[family-name:var(--font-display)] text-[clamp(20px,1.8vw,24px)] font-normal leading-tight text-[var(--color-fg)]">{addon.name}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--color-accent)]">{addon.price}</div>
                  <p className="text-[15px] leading-[1.6] text-[var(--color-fg-muted)]">{addon.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-tight bg-[var(--color-surface)]/40">
        <div className="container-wide">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">What&rsquo;s in each tier</span>
            <h2 className="headline-section mt-5 text-balance">Honest <em>by line.</em></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-start font-[family-name:var(--font-ui)] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border-strong)]">
                  <th className="py-5 pr-6 font-[family-name:var(--font-display)] text-[16px] font-normal text-[var(--color-fg)]">Capability</th>
                  <th className="px-6 py-5 text-center text-[var(--color-fg-muted)]">Free trial</th>
                  <th className="px-6 py-5 text-center text-[var(--color-accent)]">Omnix licence</th>
                  <th className="px-6 py-5 text-center text-[var(--color-fg-muted)]">Custom</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row[0]} className={i === COMPARE.length - 1 ? '' : 'border-b border-[var(--color-border)]'}>
                    <td className="py-4 pr-6 text-[var(--color-fg)]">{row[0]}</td>
                    <td className="px-6 py-4 text-center"><Cell value={row[1]} /></td>
                    <td className="px-6 py-4 text-center"><Cell value={row[2]} /></td>
                    <td className="px-6 py-4 text-center"><Cell value={row[3]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What's actually included — expanded inventory of every category
          so cold visitors don't have to read between the lines. Used to
          back the "fair price" claim on /pricing. */}
      <section className="section-tight">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">What&rsquo;s actually included</span>
            <h2 className="headline-section mt-5 text-balance">
              Every line, <em>in the box.</em>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[60ch]">
              No tier-locked features. The fee buys the whole product. The list below
              shows what arrives the moment you install &mdash; same for every variant,
              same for every business size.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[2fr_1fr]">
            {/* Left column — full feature list grouped by category */}
            <div className="flex flex-col gap-7">
              {[
                {
                  group: 'Core',
                  items: [
                    'Point of sale (cash, M-Pesa STK push, card, credit, layby)',
                    'Inventory + batches + expiry + barcode scanner',
                    'Customers + suppliers + multi-branch ledgers',
                    'Accounting (P&L, expenses, petty cash, banking)',
                    'Cash register with shift open/close + Z-report',
                  ],
                },
                {
                  group: 'Compliance pack',
                  items: [
                    'KRA eTIMS sale signing on every receipt',
                    'VAT3 PDF — populated for the period, branded with your masthead',
                    'P9 yearly tax certificate per employee',
                    'P10 monthly PAYE batch for iTax filing',
                    'GRN (Goods Received Note) with batch + expiry',
                    'Pharmacy controlled-substances register',
                  ],
                },
                {
                  group: 'Procurement',
                  items: [
                    'Mixed-currency purchase orders with FX snapshot at receipt',
                    'Three-way match (PO ↔ GRN ↔ supplier invoice)',
                    'Approval workflow for high-value POs',
                    'Reverse-GRN for receiving errors',
                    'Partial receipts + supplier balance tracking',
                  ],
                },
                {
                  group: 'Reports',
                  items: [
                    'P&L · day book · top products · payment mix',
                    'Aged receivables · aged payables',
                    'Reorder list · dead stock · stock-take variance',
                    'Insurance claims batch (SHA + private)',
                    'Every report exports to a branded PDF in one click',
                  ],
                },
                {
                  group: 'Ops + multi-branch',
                  items: [
                    'Customer display on a second monitor (idle playlist + cart)',
                    'LAN sync between master + client tills (no internet needed)',
                    'Per-machine RSA-signed licence',
                    'Cloud backup add-on (encrypted, your key)',
                    'In-app AI assistant (BYOK, free tiers work)',
                  ],
                },
              ].map(({ group, items }) => (
                <div key={group}>
                  <div className="caption-mono mb-3">{group}</div>
                  <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="py-2.5 text-[14px] leading-[1.55] text-[var(--color-fg)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Right column — v0.10 highlights sidebar */}
            <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-7 self-start">
              <span className="eyebrow">New in v0.10</span>
              <h3
                style={{ fontFamily: 'var(--font-display, serif)' }}
                className="mt-3 text-[24px] font-normal leading-[1.1] tracking-[-0.01em]"
              >
                A bigger box, same price.
              </h3>
              <ul className="mt-5 flex flex-col gap-4">
                {[
                  {
                    title: '16 branded PDFs',
                    body: 'VAT3, P9, P10, GRN, hardware quote, Z-report, aged AR/AP and more.',
                    href: '/#pdf-pack',
                  },
                  {
                    title: 'PO lifecycle hardening',
                    body: 'Mixed currency, approval thresholds, three-way match, reverse-GRN.',
                    href: '/docs/purchase-orders',
                  },
                  {
                    title: 'Customer display playlist',
                    body: 'Image, video, or iframe slides on the idle screen of your second monitor.',
                    href: '/docs/customer-display',
                  },
                  {
                    title: '14 entity detail pages',
                    body: 'Product, customer, supplier, sale, employee — every record gets its own page.',
                    href: '/changelog',
                  },
                  {
                    title: '7-step onboarding wizard',
                    body: 'Skips optional steps. Captures only what licensing actually needs.',
                    href: '/docs/onboarding',
                  },
                ].map((h) => (
                  <li key={h.title} className="border-t border-[var(--color-border)] pt-4 first:border-0 first:pt-0">
                    <Link href={h.href} className="group block">
                      <div className="text-[14px] font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
                        {h.title}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-fg-muted)]">
                        {h.body}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/changelog"
                className="caption-mono mt-7 inline-flex items-center gap-1.5 hover:underline"
              >
                Full changelog <Icon.ArrowRight className="size-3" weight="bold" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <FaqSection />
      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}

function Cell({ value }: { value: string }) {
  if (value === 'check') return <Icon.Check className="mx-auto size-4 text-[var(--color-accent)]" weight="bold" />
  if (value === 'dash') return <span className="text-[var(--color-fg-subtle)]">—</span>
  return <span className="text-[var(--color-fg)]">{value}</span>
}

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
import { CURRENCIES, formatPrice, tierPrice, type SupportedCurrency, type PricingTierShape } from '@/lib/currency'

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

interface PricingShape {
  currency?: string
  trialDays?: number
  starter?: PricingTierShape & { maxBranches?: number; maxMachines?: number }
  business?: PricingTierShape & { maxBranches?: number; maxMachines?: number }
  enterprise?: { priceLabel?: string }
  cloudBackupMonthly?: number
  extraBranchOneTime?: number
  extraMachineOneTime?: number
}

async function getPricing(): Promise<PricingShape> {
  // Pricing was a Payload global; lives in static config now.
  const { pricing } = await import('@/config/pricing')
  // The PricingShape type expects per-currency maps OR singular values
  // depending on call sites. Static config is per-currency-map shape.
  return pricing as unknown as PricingShape
}

async function getActiveCurrency(): Promise<SupportedCurrency> {
  const cookieStore = await cookies()
  const c = cookieStore.get('omnix_currency')?.value as SupportedCurrency | undefined
  if (c && c in CURRENCIES) return c
  return 'KES'
}

function buildVariants(p: PricingShape, currency: SupportedCurrency): ReadonlyArray<VariantTile> {
  const proPrice = formatPrice(tierPrice(p.business, currency), currency)
  const tradePrice = formatPrice(tierPrice(p.starter, currency), currency)
  return [
    { id: 'pro', name: 'Omnix Pro', tagline: 'All four trades — multi-trade businesses', href: '/pro', price: proPrice, badge: 'Recommended' },
    { id: 'dawa', name: 'Omnix Dawa', tagline: 'Pharmacy management', price: tradePrice, href: '/dawa' },
    { id: 'retail', name: 'Omnix Retail', tagline: 'Shops, mini-marts, dukas', price: tradePrice, href: '/retail' },
    { id: 'hospitality', name: 'Omnix Hospitality', tagline: 'Restaurants, bars, lodges', price: tradePrice, href: '/hospitality' },
    { id: 'hardware', name: 'Omnix Hardware', tagline: 'Hardware stores, contractors', price: tradePrice, href: '/hardware' },
  ]
}

function buildTiers(p: PricingShape, currency: SupportedCurrency) {
  const trialDays = p.trialDays ?? 30
  const tradePriceNum = tierPrice(p.starter, currency)
  const proPriceNum = tierPrice(p.business, currency)
  const enterprisePrice = p.enterprise?.priceLabel ?? 'Talk to us'
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
      price: enterprisePrice,
      body: '5+ branches, custom integrations, dedicated onboarding, signed SLA, on-prem deployment. We meet your CFO, build the install plan, and stand up the system.',
      href: '/contact?type=enterprise',
      cta: 'Book a call',
      primary: false,
    },
  ] as const
}

function buildAddons(p: PricingShape, currency: SupportedCurrency) {
  const cloud = p.cloudBackupMonthly ?? 500
  const extraMachine = p.extraMachineOneTime ?? 5_000
  return [
    { name: 'Cloud backup', price: `${formatPrice(cloud, currency)} · / month / branch`, body: 'Encrypted nightly snapshots to Cloudflare R2. Restore in minutes after a stolen or lost machine.' },
    { name: 'Extra machine seat', price: `${formatPrice(extraMachine, currency)} · one-time`, body: 'Raise the number of PCs that can activate against your licence beyond the included 10.' },
    { name: 'Major upgrade', price: '50% off · list price', body: 'When v2.x ships, current owners pay half. Stay on v1.x as long as you like.' },
    { name: 'On-site training', price: `${formatPrice(25_000, currency)} · per day`, body: 'A trainer walks your team through setup, POS, payroll and KRA filings in your office.' },
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

export default async function PricingPage() {
  const [settings, pricing, currency] = await Promise.all([getSiteSettings(), getPricing(), getActiveCurrency()])
  const VARIANTS = buildVariants(pricing, currency)
  const TIERS = buildTiers(pricing, currency)
  const ADDONS = buildAddons(pricing, currency)
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={<>Pay once. <em>Use forever.</em></>}
        description="One product, one fee. No subscriptions, no per-user upcharges, no surprise renewal emails. Free 30-day trial first — you only pay if you keep it."
      />

      <OnePriceSection
        price={tierPrice(pricing.starter, currency).toLocaleString('en-US')}
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

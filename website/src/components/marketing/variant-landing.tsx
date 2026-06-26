import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { CURRENCIES, formatPrice, tierPrice, type PricingTierShape, type SupportedCurrency } from '@/lib/currency'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { SoftwareJsonLd } from '@/components/seo/jsonld'

export type VariantId = 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'pro'

interface VariantData {
  productName?: string
  tagline?: string
  metaTitle?: string
  metaDescription?: string
  hero?: {
    eyebrow?: string
    titlePrefix?: string
    titleEmphasis?: string
    titleSuffix?: string
    description?: string
  }
  whoFor?: {
    eyebrow?: string
    items?: { label: string }[]
  }
  signatureFeatures?: { title: string; description: string }[]
  compliance?: { item: string }[]
  pricingNote?: string
  cta?: {
    buyHref?: string
    downloadHref?: string
    buyLabel?: string
    trialLabel?: string
  }
}

/**
 * Default content per variant. Used when the CMS global doesn't yet
 * have a row for this variant (cold-boot, or the seed migration hasn't
 * run). Values match the previously hardcoded copy so behavior stays
 * identical between "before CMS" and "CMS empty".
 */
const FALLBACK: Record<VariantId, VariantData> = {
  pro: {
    productName: 'Omnix Pro',
    tagline: 'All four trades on one machine',
    hero: {
      eyebrow: 'Omnix Pro',
      titlePrefix: 'One install. ',
      titleEmphasis: 'Every',
      titleSuffix: ' trade.',
      description:
        'Pharmacy, retail, hospitality, hardware — all four modules unlocked on one machine. Switch between trades without switching software.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Multi-trade businesses' },
        { label: 'Holding companies' },
        { label: 'Retail + pharmacy combos' },
        { label: 'Hotels with shops' },
        { label: 'Diversified SMEs' },
        { label: 'Founders running 2+ businesses' },
      ],
    },
    signatureFeatures: [
      { title: 'All four modules', description: 'Dawa + Retail + Hospitality + Hardware unlocked on the same install. Pick which one each branch uses.' },
      { title: 'Per-branch configuration', description: 'Branch A runs Dawa, Branch B runs Retail. Same database, same reports, different POS layouts.' },
      { title: 'Unified reporting', description: 'P&L across all trades. KRA eTIMS submissions in one place. Inventory across modules.' },
      { title: 'AI assistant', description: 'A trade-aware AI inside the app. "Top performing branch this month?" "Why is hardware margin trailing retail?"' },
      { title: 'KRA eTIMS, one signing', description: 'Every sale across every trade signed and submitted from a single eTIMS device.' },
      { title: 'LAN multi-device', description: 'Designate a master, every branch syncs over LAN. No internet required.' },
      { title: 'Per-machine licence', description: 'RSA-signed licence per device. Pay once, own forever.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'PPB pharmacy controls (Dawa)' },
      { item: 'KEBS retail compliance' },
      { item: 'Hospitality F&B levy' },
      { item: 'Hardware bonded warehouse' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=pro', downloadHref: '/signup?variant=pro', buyLabel: 'Buy Omnix Pro', trialLabel: 'Start 30-day free trial' },
  },
  dawa: {
    productName: 'Omnix Dawa',
    tagline: 'Pharmacy management for Kenyan chemists',
    hero: {
      eyebrow: 'Omnix Dawa',
      titlePrefix: 'Pharmacy POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), KRA eTIMS receipts, SHA & private insurance claims, prescriptions, expiry tracking and a controlled-substance register. The chemist till that\'s calm and compliant.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Independent chemists' },
        { label: 'Pharmacy chains (1–10 branches)' },
        { label: 'Hospital pharmacies' },
        { label: 'Clinic dispensaries' },
        { label: 'PPB-licensed pharmacists' },
        { label: 'Mama na mtoto chemists' },
      ],
    },
    signatureFeatures: [
      { title: 'Prescriptions, properly', description: 'Patient profiles with allergies, conditions, and medication history. Drug-drug warnings at point of sale. Refill tracking with automatic dose calculations.' },
      { title: 'Expiry that actually works', description: 'Batch-level expiry tracking with 30/60/90-day alerts. The till sells the soonest-expiring batch first by default. No more pharmacy waste.' },
      { title: 'Controlled register, daily', description: 'Statutory daily register for narcotics and psychotropics. PPB-format export. Pharmacist-on-duty tracking with sign-on/sign-off.' },
      { title: 'SHA + private insurance', description: 'Member verification, copay split, claim submission. NHIF, AAR, Jubilee, CIC and any other private payer with API. Reconciliation built in.' },
      { title: 'KRA eTIMS, automatic', description: 'Every sale is signed and submitted. VAT exemption for medicaments. Pharmacy-specific HS codes pre-loaded. No third-party plugin.' },
      { title: 'Multi-branch sync', description: 'Run two or more chemists on the same network — stock, prices, customers, debts all sync over LAN. Clinic dispensary on a Surface tablet? Works the same.' },
      { title: 'AI concierge built in', description: 'A chemist-aware AI assistant inside the app. Ask "what\'s expiring next month?" or "explain this eTIMS error" — gets answers from your live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing on every sale' },
      { item: 'PPB controlled-substance daily register' },
      { item: 'SHA + NHIF + private insurance claims' },
      { item: 'PPB pharmacist-of-record tracking' },
      { item: 'Schedule II–IV narcotic logging' },
      { item: 'Per-machine signed licence (Argon2 + RSA)' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees. No per-prescription fees, no subscription, no surprises.',
    cta: { buyHref: '/buy?variant=dawa', downloadHref: '/signup?variant=dawa', buyLabel: 'Buy Omnix Dawa', trialLabel: 'Start 30-day free trial' },
  },
  retail: {
    productName: 'Omnix Retail',
    tagline: 'Retail POS for shops, mini-marts, and dukas',
    hero: {
      eyebrow: 'Omnix Retail',
      titlePrefix: 'Retail POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), barcode scanning, layby, customer credit, supplier reconciliation and KRA eTIMS — built for shops, mini-marts and dukas.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Mini-marts and dukas' },
        { label: 'Boutiques and clothing stores' },
        { label: 'Bookshops and stationery' },
        { label: 'Electronics shops' },
        { label: 'Beauty supply shops' },
        { label: 'Multi-branch retail chains' },
      ],
    },
    signatureFeatures: [
      { title: 'Barcode-first POS', description: 'Scan, weigh, sell. SKU + barcode lookup with 50ms response. Custom keyboard shortcuts for top sellers.' },
      { title: 'Layby + customer credit', description: 'Layby with deposit tracking. Per-customer credit limits with auto-block when exceeded. M-Pesa STK push to clear debts.' },
      { title: 'Supplier reconciliation', description: 'Goods received notes, supplier accounts, payable ledger. Automatic 3-way match between PO, GRN, and supplier invoice.' },
      { title: 'M-Pesa STK push', description: 'Native Daraja integration. Customer pays from their phone, the till closes the sale automatically. No till float juggling.' },
      { title: 'KRA eTIMS, hands-free', description: 'Every receipt signed and submitted. VAT3 return generated automatically. eTIMS device on the till works for every branch.' },
      { title: 'Multi-branch + LAN', description: 'Designate a master shop, the rest sync over LAN. Stock transfers between branches with two-step approval.' },
      { title: 'AI insights', description: 'Bestsellers, slow movers, margin per category — ask in plain English. "Why was Tuesday so quiet?"' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'KEBS standardisation marks' },
      { item: 'M-Pesa STK push (Daraja)' },
      { item: 'KRA VAT3 return generator' },
      { item: 'Per-machine signed licence' },
      { item: 'Argon2 password hashing' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=retail', downloadHref: '/signup?variant=retail', buyLabel: 'Buy Omnix Retail', trialLabel: 'Start 30-day free trial' },
  },
  hospitality: {
    productName: 'Omnix Hospitality',
    tagline: 'POS for restaurants, bars, lodges',
    hero: {
      eyebrow: 'Omnix Hospitality',
      titlePrefix: 'Restaurant & bar POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: '',
      description:
        'Lipa na M-Pesa at the table, KOT printing, room folios, recipe costing, F&B levy and KRA eTIMS — for restaurants, bars and lodges across Kenya.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Restaurants and cafes' },
        { label: 'Bars and pubs' },
        { label: 'Lodges and small hotels' },
        { label: 'Catering operations' },
        { label: 'Quick-service kitchens' },
        { label: 'Members clubs' },
      ],
    },
    signatureFeatures: [
      { title: 'KOT to kitchen', description: 'Print Kitchen Order Tickets to multiple stations (grill, hot, cold, bar). Order modifiers, course timing, "fire" command from waiter.' },
      { title: 'Table & folio management', description: 'Floor map, drag tables, transfer items between tables, split bills, room charges to folios. Open tabs, paid tabs, all in one screen.' },
      { title: 'Recipe costing', description: 'Per-dish ingredient breakdowns. Real-time food cost per plate. Yield tracking on cuts and prep.' },
      { title: 'F&B levy + KRA eTIMS', description: 'Hospitality 2% F&B levy auto-calculated. KRA eTIMS signing on every receipt. VAT and levy reports for KRA filing.' },
      { title: 'M-Pesa till + card', description: 'Every payment method including M-Pesa Pochi for tips. Combined splits (cash + card + M-Pesa) on one bill.' },
      { title: 'Multi-station LAN', description: 'POS at the bar, KOT at the grill, billing at the till — all syncing over LAN. Designate a master server, the rest follow.' },
      { title: 'AI assistant', description: '"Top selling cocktail this month?" "Plates with margin under 30%?" Plain-English questions over your live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'F&B levy auto-calculation' },
      { item: 'TRA tourism levy support' },
      { item: 'M-Pesa STK + Pochi' },
      { item: 'PPB liquor licence tracking' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hospitality', downloadHref: '/signup?variant=hospitality', buyLabel: 'Buy Omnix Hospitality', trialLabel: 'Start 30-day free trial' },
  },
  hardware: {
    productName: 'Omnix Hardware',
    tagline: 'POS for hardware stores and contractors',
    hero: {
      eyebrow: 'Omnix Hardware',
      titlePrefix: 'Hardware POS with ',
      titleEmphasis: 'M-Pesa',
      titleSuffix: ' for Kenya',
      description:
        'Lipa na M-Pesa (STK push, Paybill & Till), bulk pricing tiers, contractor accounts, quotations, parts catalogues, deliveries, GRNs and KRA eTIMS — for hardware stores supplying construction.',
    },
    whoFor: {
      eyebrow: 'Built for',
      items: [
        { label: 'Hardware stores' },
        { label: 'Building material suppliers' },
        { label: 'Plumbing & electrical wholesalers' },
        { label: 'Tile & sanitary ware shops' },
        { label: 'Contractor supply yards' },
        { label: 'Multi-branch hardware chains' },
      ],
    },
    signatureFeatures: [
      { title: 'Bulk pricing tiers', description: 'Per-product price brackets (1–10, 11–100, 100+). Contractor discount sheets. Project-specific quotes that auto-apply at the till.' },
      { title: 'Contractor accounts', description: 'Per-contractor credit limit, statement, project tagging. Tied to KRA PIN for invoicing. Auto-reminders when balance is overdue.' },
      { title: 'Parts catalogue + variants', description: 'SKUs with sub-variants (size, gauge, finish). Cross-reference codes (Crown vs Plascon vs Bauer). Smart search across all spelling variants.' },
      { title: 'Deliveries + GRNs', description: 'Track delivery vehicle, off-load time, delivery proof. Goods Received Notes with three-way match. Truck-load layby for contractors.' },
      { title: 'KRA eTIMS, every invoice', description: 'Every contractor invoice signed. VAT for taxable items, exemption for exports. EFD-ready for cash sales above KES 5K.' },
      { title: 'Multi-branch + LAN', description: 'Branch A receives stock, Branch B sells. All synced over LAN. Inter-branch transfer slips with approval.' },
      { title: 'AI for hardware', description: '"Iron sheets sold this week?" "Top contractor by spend this quarter?" Plain-English over live data.' },
    ],
    compliance: [
      { item: 'KRA eTIMS auto-signing' },
      { item: 'KRA VAT3 return generator' },
      { item: 'KEBS standardisation marks' },
      { item: 'M-Pesa STK + Pochi' },
      { item: 'NCA contractor verification' },
      { item: 'Per-machine signed licence' },
    ],
    pricingNote: 'One-time licence per device — perpetual licence, no annual fees, no subscription.',
    cta: { buyHref: '/buy?variant=hardware', downloadHref: '/signup?variant=hardware', buyLabel: 'Buy Omnix Hardware', trialLabel: 'Start 30-day free trial' },
  },
}

/**
 * Read variant-specific copy from the CMS. Falls back to the canonical
 * defaults above if the global isn't seeded yet.
 */
async function getVariantContent(variant: VariantId, _locale: string): Promise<VariantData> {
  // Trade landings are static config now (was a Payload global).
  // Always returns the FALLBACK shape — locale-specific overrides can
  // be added later via i18n message files.
  return FALLBACK[variant]
}

/**
 * Read the headline price for this variant from the static pricing config.
 *   Pro    → business.oneTimeFee
 *   others → starter.oneTimeFee
 */
async function getVariantPrice(variant: VariantId): Promise<{ amount: number; currency: SupportedCurrency; display: string }> {
  const { pricing } = await import('@/config/pricing')
  const { COUNTRY_TO_CURRENCY } = await import('@/i18n/routing')
  const locale = await getLocale()
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get('omnix_currency')?.value as SupportedCurrency | undefined

  // Locale URL is the strongest signal (a /us/* page should always price in
  // USD even if the visitor's cookie disagrees). Cookie is the secondary
  // hint. Default falls back to USD (Paystack's universal currency) so a
  // missing cookie + unknown locale doesn't render a Kenya price to the
  // wrong audience.
  const fromLocale = COUNTRY_TO_CURRENCY[locale.toLowerCase()] as SupportedCurrency | undefined
  const currency: SupportedCurrency = (fromLocale && fromLocale in CURRENCIES)
    ? fromLocale
    : (cookieValue && cookieValue in CURRENCIES ? cookieValue : 'USD')

  const tier = variant === 'pro' ? pricing.business : pricing.starter
  const amount = tier.oneTimeFee[currency] ?? tier.oneTimeFee.USD
  return { amount, currency, display: formatPrice(amount, currency) }
}

function HeroTitle({
  prefix,
  emphasis,
  suffix,
}: {
  prefix?: string
  emphasis?: string
  suffix?: string
}) {
  if (!emphasis) return <>{prefix ?? ''}</>
  return (
    <>
      {prefix ?? ''}
      <em>{emphasis}</em>
      {suffix ?? ''}
    </>
  )
}

export async function VariantLanding({ variant }: { variant: VariantId }) {
  const locale = await getLocale()
  const [content, settings, price, slotImage] = await Promise.all([
    getVariantContent(variant, locale),
    getSiteSettings(),
    getVariantPrice(variant),
    // Admin-uploaded module hero (per /admin/media). Falls back to the
    // default glow pattern when nothing is uploaded for this variant.
    (async () => {
      try {
        const { getSlotImage } = await import('@/lib/media-slots')
        return await getSlotImage(`module.${variant}.hero`)
      } catch {
        return null
      }
    })(),
  ])

  const productName = content.productName ?? FALLBACK[variant].productName ?? 'Omnix'
  const hero = content.hero ?? FALLBACK[variant].hero ?? {}
  const whoFor = content.whoFor ?? FALLBACK[variant].whoFor ?? { items: [] }
  const features = content.signatureFeatures ?? FALLBACK[variant].signatureFeatures ?? []
  const compliance = content.compliance ?? FALLBACK[variant].compliance ?? []
  const pricingNote = content.pricingNote ?? FALLBACK[variant].pricingNote ?? ''
  const cta = content.cta ?? FALLBACK[variant].cta ?? {}
  const buyHref = cta.buyHref ?? `/buy?variant=${variant}`
  const downloadHref = cta.downloadHref ?? `/signup?variant=${variant}`
  const buyLabel = cta.buyLabel ?? `Buy ${productName}`
  const trialLabel = cta.trialLabel ?? 'Start 30-day free trial'

  return (
    <>
      <SoftwareJsonLd variant={variant} currency={price.currency} locale={locale} />
      <PageHero
        eyebrow={hero.eyebrow ?? productName}
        title={
          <HeroTitle
            prefix={hero.titlePrefix}
            emphasis={hero.titleEmphasis}
            suffix={hero.titleSuffix}
          />
        }
        description={hero.description ?? ''}
        backgroundImage={slotImage ? { url: slotImage.url, alt: slotImage.alt } : null}
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={buyHref}>{buyLabel}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={downloadHref}>{trialLabel}</Link>
          </Button>
        </div>
      </PageHero>

      {/* ── Who it's for ──────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
        <div className="container-default">
          <span className="caption-mono">{whoFor.eyebrow ?? 'Built for'}</span>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {(whoFor.items ?? []).map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]">
                <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Signature features ────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12">
            <span className="caption-mono">What you get</span>
            <h2 className="headline-sub mt-3">
              {productName} — purpose-built for your trade
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal leading-tight text-[var(--color-fg)]">
                  {f.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ────────────────────────────────────────── */}
      {compliance.length > 0 && (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
          <div className="container-default">
            <span className="caption-mono">Compliant with</span>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {compliance.map((c, i) => (
                <li key={`${c.item}-${i}`} className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]">
                  <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                  {c.item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Pricing note ──────────────────────────────────────── */}
      <section className="section">
        <div className="container-default text-center">
          <span className="caption-mono">Pricing</span>
          <h2 className="font-[family-name:var(--font-display)] mt-3 text-[clamp(40px,5vw,72px)] font-normal leading-[1.05] text-[var(--color-fg)]">
            {CURRENCIES[price.currency].symbol} <em>{price.amount.toLocaleString('en-US')}</em>
          </h2>
          <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] max-w-[44ch] mx-auto">
            {pricingNote}
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={buyHref}>{buyLabel}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={downloadHref}>{trialLabel}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* v0.10 highlights — same shape across every variant landing.
          Anchors the cold visitor on what shipped recently without
          competing with the variant-specific feature copy above. */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">New in v0.10</span>
            <h2 className="headline-section mt-5 text-balance">
              The latest, <em>by way of compliance.</em>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
              The fee buys every Kenyan-tax filing as a branded PDF, the procurement
              workflow Kenyan finance offices actually need, and a customer display that
              looks the part on your second monitor.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
            {[
              {
                eyebrow: 'Compliance',
                title: '16 branded PDFs',
                body: 'VAT3, P9, P10, GRN, hardware quote, Z-report, aged AR/AP and more.',
                href: '/#pdf-pack',
              },
              {
                eyebrow: 'Procurement',
                title: 'PO lifecycle hardening',
                body: 'Mixed currency, approval thresholds, three-way match, reverse-GRN.',
                href: '/docs/purchase-orders',
              },
              {
                eyebrow: 'Front-of-house',
                title: 'Customer display playlist',
                body: 'Image, YouTube, or iframe slides on the second monitor while idle.',
                href: '/docs/customer-display',
              },
            ].map((h) => (
              <li
                key={h.title}
                className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {h.eyebrow}
                </span>
                <h3
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="text-[22px] font-medium leading-[1.1] tracking-[-0.01em]"
                >
                  {h.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
                  {h.body}
                </p>
                <Link
                  href={h.href}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                >
                  Read more →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}

/** Read just metadata for generateMetadata() in each trade page. */
export async function getVariantMetadata(variant: VariantId): Promise<{ title: string; description: string }> {
  const locale = await getLocale()
  const c = await getVariantContent(variant, locale)
  const fb = FALLBACK[variant]
  return {
    title: c.metaTitle ?? `${c.productName ?? fb.productName} — ${c.tagline ?? fb.tagline}`,
    description:
      c.metaDescription ?? c.tagline ?? fb.tagline ?? 'Offline-first ERP platform for Kenyan SMEs.',
  }
}

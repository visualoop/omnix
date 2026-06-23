/**
 * JSON-LD structured-data components.
 *
 * Two scopes:
 *
 *   <OrgJsonLd />              site-wide. Mounted in the [locale] layout.
 *   <SoftwareJsonLd variant /> per-product. Mounted on /{c}/{variant}.
 *
 * Designed to be cheap (no client bundle) — they render server-side as a
 * <script type="application/ld+json"> tag with the right shape per the
 * SEO strategy doc §6.
 */
import { siteBranding } from '@/lib/platform-settings'
import { pricing, type SupportedCurrency } from '@/config/pricing'

interface OrgProps {
  brandUrl: string
}

export async function OrgJsonLd({ brandUrl = 'https://omnix.co.ke' }: Partial<OrgProps> = {}) {
  const b = await siteBranding().catch(() => null)
  const same: string[] = []
  if (b?.social.twitter) same.push(b.social.twitter)
  if (b?.social.linkedin) same.push(b.social.linkedin)
  if (b?.social.facebook) same.push(b.social.facebook)
  if (b?.social.youtube) same.push(b.social.youtube)
  if (b?.social.instagram) same.push(b.social.instagram)
  if (b?.social.github) same.push(b.social.github)

  const contactPoints = [
    b?.phoneKenya
      ? { '@type': 'ContactPoint', telephone: b.phoneKenya, contactType: 'customer support', areaServed: 'KE' }
      : null,
    {
      '@type': 'ContactPoint',
      email: b?.supportEmail ?? 'support@omnix.co.ke',
      contactType: 'customer support',
      areaServed: ['Worldwide'],
    },
  ].filter(Boolean)

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${brandUrl}/#org`,
    name: b?.legalName ?? 'Omnix',
    alternateName: 'Omnix ERP',
    url: brandUrl,
    logo: `${brandUrl}/favicon.svg`,
    description: b?.tagline ?? 'Offline-first ERP for Kenyan SMEs',
    sameAs: same.length > 0 ? same : undefined,
    contactPoint: contactPoints,
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

interface SoftwareProps {
  variant: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
  currency: SupportedCurrency
  brandUrl?: string
  locale: string
}

const VARIANT_NAMES: Record<SoftwareProps['variant'], string> = {
  pro: 'Omnix Pro',
  dawa: 'Omnix Dawa',
  retail: 'Omnix Retail',
  hospitality: 'Omnix Hospitality',
  hardware: 'Omnix Hardware',
}

const VARIANT_DESCRIPTIONS: Record<SoftwareProps['variant'], string> = {
  pro: 'Multi-trade ERP for businesses spanning pharmacy, retail, hospitality and hardware. One offline-first binary, perpetual licence.',
  dawa: 'Pharmacy ERP and POS — prescriptions, drug labels, expiry tracking, controlled-substance register, KRA eTIMS, SHA insurance billing. Offline-first.',
  retail: 'Retail ERP and POS for shops, mini-marts and dukas. Variants, layby, shrinkage, fast till. Offline-first, M-Pesa native.',
  hospitality: 'Hospitality ERP for restaurants, bars and lodges. Tables, KOT, recipe costing, room bookings, folios. Offline-first.',
  hardware: 'Hardware-store ERP. Bulk pricing, quotations, delivery notes, contractor accounts. Offline-first.',
}

export function SoftwareJsonLd({ variant, currency, locale, brandUrl = 'https://omnix.co.ke' }: SoftwareProps) {
  const tier = variant === 'pro' ? pricing.business : pricing.starter
  const priceValue = tier.oneTimeFee[currency]

  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: VARIANT_NAMES[variant],
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'EnterpriseResourcePlanning',
    operatingSystem: 'Windows 10, Windows 11',
    description: VARIANT_DESCRIPTIONS[variant],
    url: `${brandUrl}/${locale}/${variant}`,
    publisher: { '@id': `${brandUrl}/#org` },
    offers: {
      '@type': 'Offer',
      price: String(priceValue),
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      url: `${brandUrl}/${locale}/buy?variant=${variant}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/**
 * FAQPage JSON-LD — pricing + key blog posts.
 */
interface FAQEntry {
  question: string
  answer: string
}
export function FAQJsonLd({ entries }: { entries: FAQEntry[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  }
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

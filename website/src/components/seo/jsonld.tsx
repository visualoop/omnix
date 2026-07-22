/**
 * JSON-LD structured-data components.
 *
 * Scopes:
 *
 *   <OrgJsonLd />                  site-wide. Mounted in the [locale] layout.
 *   <SoftwareJsonLd product />     per-product. Mounted on the five canonical
 *                                  product pages (/pharmacy, /retail, …).
 *   <ArticleJsonLd />              blog posts, docs, guides, location hubs.
 *   <BreadcrumbJsonLd />           index + detail trails.
 *   <FAQJsonLd />                  only where the rendered Q&A matches exactly.
 *
 * Honesty rules (Task 28 §6):
 *   - SoftwareApplication/Offer price is derived from @/config/pricing, never
 *     hand-typed; operatingSystem is Windows; the Offer states price only —
 *     no stock status, no rating, no reviews, no customer counts, no address
 *     or local office and no fabricated dates.
 *   - Location hubs use Article + Breadcrumb only — never a local-business,
 *     address, review or rating type.
 *   - Every payload is serialized through {@link safeJsonLd} so a stray "<" /
 *     "</script>" or U+2028/U+2029 in the data can never terminate the inline
 *     <script> or break the document.
 */
import { pricing, type SupportedCurrency } from '@/config/pricing'
import { siteBranding } from '@/lib/platform-settings'

/**
 * Serialize a JSON-LD object for safe embedding inside an inline
 * <script type="application/ld+json">. Escaping "<" defeats `</script>`
 * injection; escaping the line/paragraph separators keeps the JS string
 * grammar valid.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  )
}

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
    alternateName: 'Omnix POS',
    url: brandUrl,
    logo: `${brandUrl}/favicon.svg`,
    description: b?.tagline ?? 'Offline-first POS + business software for Kenyan SMEs',
    sameAs: same.length > 0 ? same : undefined,
    contactPoint: contactPoints,
  }

  return <JsonLdScript data={data} />
}

/**
 * The five public products. Each maps to its canonical product route so the
 * SoftwareApplication `url` and its Offer `url` point at a real, indexable,
 * non-redirecting page — never /buy, /dawa or /modules/[slug].
 */
export type ProductId = 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'

const PRODUCT_NAMES: Record<ProductId, string> = {
  pharmacy: 'Omnix Pharmacy',
  retail: 'Omnix Retail',
  hospitality: 'Omnix Hospitality',
  hardware: 'Omnix Hardware & Equipment',
  salon: 'Omnix Salon & Spa',
}

const PRODUCT_DESCRIPTIONS: Record<ProductId, string> = {
  pharmacy:
    'Pharmacy software and pharmacy POS with dispensing, prescriptions and patient records, batch and expiry stock, controlled register, M-Pesa, KRA eTIMS, SHA and private insurance workflows. Offline-first Windows desktop app.',
  retail:
    'Retail POS and inventory for shops, mini-marts and dukas: variants, returns, held sales, promotions, restock alerts, M-Pesa and KRA eTIMS. Offline-first Windows desktop app.',
  hospitality:
    'Restaurant, bar and hotel POS: kitchen orders, tables, recipe costing, rooms, bookings and guest folios, M-Pesa and KRA eTIMS. Offline-first Windows desktop app.',
  hardware:
    'Hardware and equipment POS: quotations, delivery notes, contractor credit, bulk pricing and serialized units, M-Pesa and KRA eTIMS. Offline-first Windows desktop app.',
  salon:
    'Salon and spa software: appointment diary, service checkout, staff skills and commissions, packages and memberships, back-bar stock, M-Pesa and KRA eTIMS. Offline-first Windows desktop app.',
}

interface SoftwareProps {
  product: ProductId
  currency: SupportedCurrency
  locale: string
  brandUrl?: string
}

/**
 * SoftwareApplication + Offer for one canonical product page. Price comes
 * from the shared pricing config (starter, perpetual one-time licence) in the
 * visitor's currency. Price only — no stock status, rating or review is claimed.
 */
export function SoftwareJsonLd({ product, currency, locale, brandUrl = 'https://omnix.co.ke' }: SoftwareProps) {
  const priceValue = pricing.starter.oneTimeFee[currency]
  const productUrl = `${brandUrl}/${locale}/${product}`

  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_NAMES[product],
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Windows 10, Windows 11',
    description: PRODUCT_DESCRIPTIONS[product],
    url: productUrl,
    publisher: { '@id': `${brandUrl}/#org` },
    offers: {
      '@type': 'Offer',
      price: String(priceValue),
      priceCurrency: currency,
      url: productUrl,
    },
  }

  return <JsonLdScript data={data} />
}

/**
 * FAQPage JSON-LD. Only render this when the entries match the Q&A actually
 * rendered on the page, one-for-one.
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
  return <JsonLdScript data={data} />
}

/**
 * BreadcrumbList JSON-LD — the ordered crumbs (label + absolute url).
 */
export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; url: string }> }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
  return <JsonLdScript data={data} />
}

/**
 * Article JSON-LD — blog posts, docs, guides and location hubs. Dates are
 * passed by the caller from authored source data, never build-time now().
 */
export function ArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  dateModified,
  imageUrl,
  brandUrl = 'https://omnix.co.ke',
}: {
  headline: string
  description?: string
  url: string
  datePublished?: string
  dateModified?: string
  imageUrl?: string
  brandUrl?: string
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    image: imageUrl,
    datePublished,
    dateModified: dateModified ?? datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@id': `${brandUrl}/#org` },
    publisher: { '@id': `${brandUrl}/#org` },
  }
  return <JsonLdScript data={data} />
}

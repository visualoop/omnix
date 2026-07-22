import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LocationHub } from '@/components/marketing/location-hub'
import { LocationsIndex } from '@/components/marketing/locations-index'
import {
  KENYA_LOCATIONS,
  LOCATION_PRODUCT_META,
  PLANNED_CITIES,
  REQUIRED_PRODUCT_IDS,
  type KenyaLocation,
  type LocationProductLink,
  isPublishableLocation,
  locationBySlug,
  locationGateIssues,
  locationPricingFacts,
  locationUniquenessIssues,
  publishedLocationBySlug,
  publishedLocations,
  publishedLocationSlugs,
} from '@/config/locations'
import { pricing } from '@/config/pricing'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const ROUTE_DIR = 'src/app/[locale]/(frontend)'

const SOURCES = {
  indexPage: read(`${ROUTE_DIR}/locations/page.tsx`),
  detailPage: read(`${ROUTE_DIR}/locations/[slug]/page.tsx`),
  sitemap: read('src/app/sitemap.ts'),
  routeInventory: read('src/config/route-inventory.ts'),
} as const

/** A complete, materially-unique, approved fixture that passes the gate. */
function makeProducts(): LocationProductLink[] {
  return [
    {
      id: 'pharmacy',
      ...LOCATION_PRODUCT_META.pharmacy,
      localWorkflow:
        'For a Nairobi chemist, dispensing, batch and expiry tracking and SHA claims run on the counter, while eTIMS and M-Pesa reach out when the line is up.',
    },
    {
      id: 'retail',
      ...LOCATION_PRODUCT_META.retail,
      localWorkflow:
        'A Nairobi mini-mart gets barcode sales, held sales and stock that moves as it sells, quick enough for a busy CBD counter through the day.',
    },
    {
      id: 'hospitality',
      ...LOCATION_PRODUCT_META.hospitality,
      localWorkflow:
        'A Nairobi cafe or bar can hold tables open, fire orders to the kitchen and split a bill, with recipe costing tied back to stock.',
    },
    {
      id: 'hardware',
      ...LOCATION_PRODUCT_META.hardware,
      localWorkflow:
        'A Nairobi hardware store quotes contractors, sells on account with statements and issues delivery notes as goods leave the yard.',
    },
    {
      id: 'salon',
      ...LOCATION_PRODUCT_META.salon,
      localWorkflow:
        'A Nairobi salon books by stylist, tracks back-bar stock and works out commission at checkout, all held on one shared diary.',
    },
  ]
}

function makeLocation(overrides: Partial<KenyaLocation> = {}): KenyaLocation {
  return {
    slug: 'nairobi',
    city: 'Nairobi',
    county: 'Nairobi',
    region: 'Nairobi Metropolitan',
    status: 'published',
    audit: { approvedBy: 'Test Reviewer', approvedAt: '2026-07-21', reviewNotes: 'Fixture.' },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Nairobi shops · Omnix',
    metaDescription:
      'How Nairobi businesses choose Omnix: the way counters trade in the city, which of the five products fits, what keeps working offline, and the one-time licence.',
    keywords: ['POS Nairobi', 'business software Nairobi', 'Nairobi shop software', 'M-Pesa POS Nairobi', 'offline POS Nairobi'],
    ogTitle: 'Choosing Omnix in Nairobi',
    ogDescription:
      'A buying guide for Nairobi owners: local operating patterns, the five products, the offline boundary and honest pricing.',
    kicker: 'City guide · Nairobi',
    title: 'Choosing business software',
    titleAccent: 'in Nairobi.',
    intro:
      'Nairobi runs at a different pace from the towns around it: high foot traffic, plenty of card and M-Pesa payments, and staff who need a till that keeps up. This guide walks how counters in the city actually trade, shows which of the five Omnix products fits, and is honest about what needs a connection and what does not.',
    contextIntro:
      'The city concentrates a large share of Kenya\u2019s formal retail, so competition and rent both run high for owners.',
    contextPoints: [
      'Nairobi is Kenya\u2019s capital and its main commercial hub, with dense retail across the CBD and estates.',
      'Card and M-Pesa payments are common, so owners expect several tender types on a single sale.',
      'Rents and staff costs push owners toward software that speeds up service rather than adding steps.',
    ],
    operatingIntro:
      'Most counters here trade long hours with more than one cashier, so speed and a clean shift handover matter.',
    operatingPatterns: [
      'Long trading hours with several cashiers sharing one system across a shift.',
      'A mix of walk-in cash, M-Pesa and card, often recorded on the same sale.',
      'Frequent restocking from nearby suppliers, so receiving goods needs to be quick.',
    ],
    productIntro: 'The same five products serve the city; the difference is which trade you are in.',
    products: makeProducts(),
    boundaryIntro:
      'The honest question anywhere in Kenya is what happens when the connection drops. Keep the local job and the connected job apart.',
    local: [
      'Ringing up sales and choosing the payment method.',
      'Printing and reprinting receipts.',
      'Recording stock movement as items sell.',
    ],
    connected: [
      'Sending an M-Pesa STK push to the customer\u2019s phone.',
      'Submitting a sale to KRA eTIMS, retried when the connection returns.',
    ],
    evaluationIntro: 'Take these to any vendor selling into the city, not only to us, before you commit.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet is down?',
      'Does it use your own M-Pesa account, and who pays the transaction fee?',
      'Is the price a one-time licence or a recurring subscription?',
    ],
    sources: [
      {
        claim: 'Nairobi is Kenya\u2019s capital and a county in the 47-county system.',
        note: 'Kenyan administrative geography; Nairobi is both a city and a county.',
      },
    ],
    ...overrides,
  }
}

afterEach(cleanup)

/** Task 19 publishes exactly these three; the other seven stay drafts. */
/** All ten planned cities are now published, in registry (display) order. */
const ALL_PUBLISHED = [
  'nairobi',
  'mombasa',
  'nakuru',
  'kisumu',
  'eldoret',
  'thika',
  'machakos',
  'meru',
  'nyeri',
  'kisii',
] as const

describe('Task 18/20 — location registry: all ten planned cities published', () => {
  it('keeps the ten planned cities, every one publishable through the gate', () => {
    expect(KENYA_LOCATIONS).toHaveLength(PLANNED_CITIES.length)
    const slugs = KENYA_LOCATIONS.map((l) => l.slug).sort()
    const expected = PLANNED_CITIES.map((c) => (c === 'Nairobi' ? 'nairobi' : c.toLowerCase())).sort()
    expect(slugs).toEqual(expected)
    for (const loc of KENYA_LOCATIONS) {
      expect(loc.status, `${loc.slug} is published`).toBe('published')
      expect(loc.audit.approvedBy?.trim(), `${loc.slug} carries an approval label`).toBeTruthy()
      expect(loc.audit.approvedAt?.trim(), `${loc.slug} carries an approval date`).toBeTruthy()
      expect(locationGateIssues(loc), `${loc.slug} gate is empty`).toEqual([])
      expect(isPublishableLocation(loc), `${loc.slug} passes the gate`).toBe(true)
    }
  })

  it('publishes all ten cities in display order, each retrievable by slug', () => {
    expect(publishedLocations()).toHaveLength(10)
    expect(publishedLocationSlugs()).toEqual([...ALL_PUBLISHED])
    for (const loc of KENYA_LOCATIONS) {
      expect(publishedLocationBySlug(loc.slug)?.slug).toBe(loc.slug)
    }
    // The seven formerly-draft cities now carry real, gate-passing content.
    expect(locationBySlug('kisumu')?.city).toBe('Kisumu')
    expect(isPublishableLocation(locationBySlug('kisumu')!)).toBe(true)
    expect(locationBySlug('kisii')?.city).toBe('Kisii')
    expect(isPublishableLocation(locationBySlug('kisii')!)).toBe(true)
    expect(locationBySlug('does-not-exist')).toBeNull()
  })
})

describe('Task 18 — publication gate: success', () => {
  it('accepts a complete, approved, materially-unique location', () => {
    const loc = makeLocation()
    expect(locationGateIssues(loc)).toEqual([])
    expect(isPublishableLocation(loc)).toBe(true)
    // Every required product id is present with a matching link.
    const ids = loc.products.map((p) => p.id).sort()
    expect(ids).toEqual([...REQUIRED_PRODUCT_IDS].sort())
  })
})

describe('Task 18 — publication gate: failure modes', () => {
  it('rejects publication without an explicit published status', () => {
    expect(locationGateIssues(makeLocation({ status: 'draft' }))).toContain('status')
    expect(locationGateIssues(makeLocation({ status: 'approved' }))).toContain('status')
  })

  it('rejects publication without a signed approval', () => {
    const noApprover = makeLocation({ audit: { approvedBy: null, approvedAt: '2026-07-21', reviewNotes: '' } })
    const noDate = makeLocation({ audit: { approvedBy: 'X', approvedAt: null, reviewNotes: '' } })
    expect(locationGateIssues(noApprover)).toContain('approval')
    expect(locationGateIssues(noDate)).toContain('approval')
  })

  it('rejects thin / incomplete entries', () => {
    expect(locationGateIssues(makeLocation({ intro: 'Too short.' }))).toContain('thin:intro')
    expect(locationGateIssues(makeLocation({ local: [] }))).toContain('thin:local')
    expect(locationGateIssues(makeLocation({ connected: ['only one'] }))).toContain('thin:connected')
    expect(locationGateIssues(makeLocation({ contextPoints: ['a', 'b'] }))).toContain('thin:contextPoints')
    expect(locationGateIssues(makeLocation({ evaluationPoints: [] }))).toContain('thin:evaluationPoints')
    expect(locationGateIssues(makeLocation({ metaDescription: 'short' }))).toContain('thin:metaDescription')
  })

  it('requires all five products with matching links and local copy', () => {
    expect(locationGateIssues(makeLocation({ products: makeProducts().slice(0, 3) }))).toContain('products')
    const wrongPath = makeProducts()
    wrongPath[0] = { ...wrongPath[0], path: '/wrong' }
    expect(locationGateIssues(makeLocation({ products: wrongPath }))).toContain('products')
    const thinCopy = makeProducts()
    thinCopy[1] = { ...thinCopy[1], localWorkflow: 'too short' }
    expect(locationGateIssues(makeLocation({ products: thinCopy }))).toContain('products')
  })

  it('requires source / evidence notes for factual claims', () => {
    expect(locationGateIssues(makeLocation({ sources: [] }))).toContain('sources')
    expect(locationGateIssues(makeLocation({ sources: [{ claim: 'x', note: '' }] }))).toContain('sources')
  })

  it('rejects placeholder / TODO text', () => {
    expect(locationGateIssues(makeLocation({ contextIntro: 'TODO: write the local context here soon.' }))).toContain(
      'placeholder',
    )
    expect(locationGateIssues(makeLocation({ operatingIntro: 'Local operating patterns coming soon for owners.' }))).toContain(
      'placeholder',
    )
  })

  it('rejects unsupported superlatives, metrics, certifications and response times', () => {
    expect(locationGateIssues(makeLocation({ title: 'The best software' }))).toContain('superlative')
    expect(locationGateIssues(makeLocation({ ogDescription: 'The leading POS built for faster counters everywhere here.' }))).toContain(
      'superlative',
    )
    expect(locationGateIssues(makeLocation({ contextPoints: makeLocation().contextPoints.concat('Shops here see 30% more sales.') }))).toContain(
      'metric',
    )
    expect(locationGateIssues(makeLocation({ ogDescription: 'Omnix is fully compliant and certified for every Kenyan business.' }))).toContain(
      'certification',
    )
    expect(locationGateIssues(makeLocation({ operatingIntro: 'We answer within 2 hours with 24/7 support for owners.' }))).toContain(
      'response-time',
    )
  })

  it('rejects AI / Pro-tier / trial acquisition framing', () => {
    expect(locationGateIssues(makeLocation({ intro: makeLocation().intro + ' Start your free trial today in Nairobi now.' }))).toContain(
      'ai-pro-trial',
    )
    expect(locationGateIssues(makeLocation({ productIntro: 'The AI assistant helps you pick a plan for the city today.' }))).toContain(
      'ai-pro-trial',
    )
    expect(locationGateIssues(makeLocation({ productIntro: 'A full ERP for the city that owners can rely on daily.' }))).toContain(
      'ai-pro-trial',
    )
  })

  it('rejects office / presence / address / testimonial claims', () => {
    expect(locationGateIssues(makeLocation({ contextIntro: 'Visit our office in the CBD any weekday for a chat.' }))).toContain(
      'local-presence',
    )
    expect(locationGateIssues(makeLocation({ operatingIntro: 'Our team in the city sets you up and stays close by.' }))).toContain(
      'local-presence',
    )
    expect(locationGateIssues(makeLocation({ ogDescription: 'Trusted by hundreds of shops with glowing testimonials daily.' }))).toContain(
      'local-presence',
    )
  })

  it('rejects keyword stuffing', () => {
    const tooMany = makeLocation({ keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] })
    expect(locationGateIssues(tooMany)).toContain('keyword-stuffing')
    const dupes = makeLocation({ keywords: ['POS Nairobi', 'POS Nairobi', 'x'] })
    expect(locationGateIssues(dupes)).toContain('keyword-stuffing')
    const stuffed = makeLocation({
      intro:
        'Nairobi Nairobi Nairobi Nairobi Nairobi shops need software and this Nairobi guide covers the Nairobi counter for every Nairobi owner in the city today.',
    })
    expect(locationGateIssues(stuffed)).toContain('keyword-stuffing')
  })

  it('rejects mismatched city names (copy-paste tell)', () => {
    // Foreign city in the headline.
    expect(locationGateIssues(makeLocation({ titleAccent: 'in Mombasa.' }))).toContain('city-mismatch')
    // Own city missing from the headline/intro.
    const missing = makeLocation({ title: 'Choosing software', titleAccent: 'for your shop.', metaTitle: 'Business software and POS for shops · Omnix', intro: 'This guide walks how counters actually trade, shows which of the five Omnix products fits, and is honest about what needs a connection and what does not for owners.' })
    expect(locationGateIssues(missing)).toContain('city-mismatch')
  })

  it('rejects duplicated blocks within an entry', () => {
    const dupPoints = makeLocation({ contextPoints: ['same point', 'same point', 'same point'] })
    expect(locationGateIssues(dupPoints)).toContain('duplicate-block')
    const introIsMeta = makeLocation({ intro: makeLocation().metaDescription })
    // intro === metaDescription is a templating tell (also trips other checks; the code is present).
    expect(locationGateIssues(introIsMeta)).toContain('duplicate-block')
  })
})

describe('Task 18 — registry uniqueness / no doorway content', () => {
  it('flags duplicated headlines, metadata or blocks across the registry', () => {
    const a = makeLocation({ slug: 'nairobi', city: 'Nairobi' })
    const b = makeLocation({ slug: 'mombasa', city: 'Mombasa', title: 'Choosing business software', titleAccent: 'in Mombasa.' })
    // Same metaTitle / metaDescription / intro across two cities is a doorway pattern.
    expect(locationUniquenessIssues([a, b])).toEqual(
      expect.arrayContaining(['duplicate:metaTitle', 'duplicate:metaDescription', 'duplicate:intro']),
    )
  })

  it('passes uniqueness when every field is materially distinct', () => {
    const a = makeLocation({ slug: 'nairobi', city: 'Nairobi' })
    const b = makeLocation({
      slug: 'mombasa',
      city: 'Mombasa',
      title: 'Choosing coastal business software',
      titleAccent: 'in Mombasa.',
      metaTitle: 'Business software and POS for Mombasa shops · Omnix',
      metaDescription:
        'How Mombasa businesses choose Omnix at the coast: how counters trade, which of the five products fits, what works offline, and the one-time licence.',
      ogDescription: 'A buying guide for Mombasa owners at the coast, with honest offline and pricing facts.',
      intro:
        'Mombasa trades to a coastal rhythm with tourism peaks and port logistics. This guide walks how counters in Mombasa actually trade, shows which of the five Omnix products fits, and is honest about the offline boundary.',
      contextPoints: [
        'Mombasa is a coastal city and county, with the country\u2019s main seaport driving trade.',
        'Tourism seasons swing footfall, so owners plan stock around peak and quiet months.',
        'Ferry and island logistics shape delivery timing across the county.',
      ],
      operatingPatterns: [
        'Seasonal trade with sharp peaks around holiday travel.',
        'Cash and M-Pesa dominate, with card common in tourist areas.',
        'Stock planning that leans on shipping and clearing timelines.',
      ],
      evaluationPoints: [
        'Does it cope with sharp seasonal swings in sales volume?',
        'Does it keep working when coastal connectivity dips?',
        'Can it handle stock that arrives in large, irregular shipments?',
      ],
    })
    expect(locationUniquenessIssues([a, b])).toEqual([])
  })

  it('exposes only mutually-distinct published entries (first wins on any collision)', () => {
    // All ten hubs are materially distinct; no doorway clone slips into render/sitemap.
    expect(publishedLocations()).toHaveLength(10)
    // The exported published set is internally unique by construction.
    expect(locationUniquenessIssues(publishedLocations())).toEqual([])
  })
})

describe('Task 18 — pricing derived from config, not restated', () => {
  it('derives the perpetual licence and optional compliance facts from pricing config', () => {
    const facts = locationPricingFacts()
    expect(facts.oneTime).toBe(`KES ${pricing.starter.oneTimeFee.KES.toLocaleString('en-US')}`)
    expect(facts.maintenanceYearly).toBe(`KES ${pricing.starter.maintenanceYearly.KES.toLocaleString('en-US')}`)
    expect(facts.oneTime).toBe('KES 30,000')
    expect(facts.maintenanceYearly).toBe('KES 12,000')
  })
})

describe('Task 18 — LocationHub render', () => {
  const loc = makeLocation()

  it('renders a buyer-useful hub, the office disclaimer and the derived pricing facts', () => {
    render(<LocationHub location={loc} locale="ke" />)
    const root = document.querySelector('[data-location-hub="nairobi"]')
    expect(root).not.toBeNull()

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Choosing business software')
    for (const heading of [
      /nairobi, nairobi county/i,
      /nairobi counters actually trade/i,
      /which one fits/i,
      /what runs on the device/i,
      /platform facts/i,
      /questions worth asking/i,
      /local claims/i,
    ]) {
      expect(screen.getByRole('heading', { name: heading }), `heading ${heading}`).toBeTruthy()
    }

    const text = root?.textContent ?? ''
    // Explicit "this is a buying guide, not a local office" statement.
    expect(text).toMatch(/do not operate a local office/i)
    // Pricing derived from config.
    expect(text).toContain('KES 30,000')
    expect(text).toContain('KES 12,000')
    expect(text).toMatch(/perpetual/i)
    expect(text).toMatch(/Windows/)
    // Local / connected boundary.
    expect(text).toMatch(/M-Pesa/)
    expect(text).toMatch(/eTIMS/)
    // On-page contents anchors.
    expect(document.querySelector('a[href="#products"]')).toBeTruthy()
    expect(document.querySelector('a[href="#boundary"]')).toBeTruthy()
  })

  it('shows the five products, each with matching product + demo links (locale-aware)', () => {
    render(<LocationHub location={loc} locale="ng" whatsappUrl="https://wa.me/254700000000" />)

    for (const id of REQUIRED_PRODUCT_IDS) {
      const item = document.querySelector(`[data-location-product="${id}"]`)
      expect(item, `product ${id}`).not.toBeNull()
      const productLink = item?.querySelector('[data-location-product-link]')
      expect(productLink?.getAttribute('href')).toBe(`/ng${LOCATION_PRODUCT_META[id].path}`)
    }

    // Demo-led conversion, locale-aware.
    for (const link of screen.getAllByRole('link', { name: /Book a demo/ })) {
      expect(link.getAttribute('href')).toMatch(/^\/ng\/contact\?type=demo/)
    }
    // Per-product demo pre-selection.
    const pharmacyDemo = document
      .querySelector('[data-location-product="pharmacy"]')
      ?.querySelector('a[href*="product=pharmacy"]')
    expect(pharmacyDemo?.getAttribute('href')).toBe('/ng/contact?type=demo&product=pharmacy')

    // WhatsApp secondary.
    const whatsapp = screen.getByRole('link', { name: /Ask on WhatsApp/ })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
  })

  it('carries no banned marketing claims in the rendered output', () => {
    render(<LocationHub location={loc} locale="ke" />)
    const text = document.querySelector('[data-location-hub]')?.textContent ?? ''
    // Note: the disclaimer legitimately DENIES an office; we only ban positive puffery here.
    expect(text).not.toMatch(/\bbest\b|#1|\bleading\b|guarantee[sd]? compliance|\btrial\b|\b24\/7\b|\d+\s*%/i)
  })
})

describe('Task 18 — LocationsIndex render', () => {
  it('lists published hubs with locale-aware links and a demo CTA', () => {
    const loc = makeLocation()
    render(<LocationsIndex locale="ke" locations={[loc]} whatsappUrl={null} />)

    const row = document.querySelector('[data-location-row="nairobi"]')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('href')).toBe('/ke/locations/nairobi')
    for (const link of screen.getAllByRole('link', { name: /Book a demo/ })) {
      expect(link.getAttribute('href')).toBe('/ke/contact?type=demo')
    }
  })

  it('renders a useful no-published state when nothing is published', () => {
    render(<LocationsIndex locale="ke" locations={[]} whatsappUrl={null} />)
    const empty = document.querySelector('[data-location-empty]')
    expect(empty).not.toBeNull()
    expect(document.querySelector('[data-location-row]')).toBeNull()
    expect(screen.getByRole('link', { name: /Compare the five products/ }).getAttribute('href')).toBe('/ke/modules')
    expect(screen.getByRole('link', { name: /Read the buyer guides/ }).getAttribute('href')).toBe('/ke/guides')
    // The hero and the empty panel each carry a legitimate "Book a demo" CTA,
    // so there are several matching links; every one must point at the
    // locale-aware demo contact route.
    const demoLinks = screen.getAllByRole('link', { name: /Book a demo/ })
    expect(demoLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of demoLinks) {
      expect(link.getAttribute('href')).toBe('/ke/contact?type=demo')
    }
  })
})

describe('Task 18 — routing, schema and sitemap wiring', () => {
  it('gives the index a Kenya-only canonical, helper, redirect and Breadcrumb schema only', () => {
    // Task 28: local city hubs are Kenya-only content, so the canonical always
    // resolves to /ke/locations regardless of the visitor's market.
    expect(SOURCES.indexPage).toContain('const canonical = `${SITE_URL}/ke/locations`')
    expect(SOURCES.indexPage).toContain("buildKenyaOnlyAlternatesLanguages('/locations')")
    // Non-ke markets 308 (permanentRedirect) to /ke; the /ke page renders
    // with locale="ke".
    expect(SOURCES.indexPage).toContain('permanentRedirect')
    expect(SOURCES.indexPage).toContain("locale !== 'ke'")
    expect(SOURCES.indexPage).toContain('locale="ke"')
    expect(SOURCES.indexPage).toContain('BreadcrumbJsonLd')
    expect(SOURCES.indexPage).not.toContain('SoftwareJsonLd')
    // An empty index is not advertised for indexing, even on /ke.
    expect(SOURCES.indexPage).toContain('publishedLocations().length > 0')
    expect(SOURCES.indexPage).toMatch(/hasPublished\s*\?\s*undefined\s*:\s*\{\s*index:\s*false/)
  })

  it('gives the detail route a Kenya-only canonical/helper/redirect, honest safe schema and 404s unknown slugs', () => {
    expect(SOURCES.detailPage).toContain('const canonical = `${SITE_URL}/ke/locations/${location.slug}`')
    expect(SOURCES.detailPage).toContain('buildKenyaOnlyAlternatesLanguages(`/locations/${location.slug}`)')
    // Non-ke markets 308 to /ke; the /ke page renders with locale="ke".
    expect(SOURCES.detailPage).toContain('permanentRedirect')
    expect(SOURCES.detailPage).toContain("locale === 'ke' ? undefined : { index: false, follow: true }")
    expect(SOURCES.detailPage).toContain('locale="ke"')
    expect(SOURCES.detailPage).toContain('ArticleJsonLd')
    expect(SOURCES.detailPage).toContain('BreadcrumbJsonLd')
    // A city buying guide is editorial content, never the product or a fake local business.
    expect(SOURCES.detailPage).not.toContain('SoftwareJsonLd')
    for (const banned of ['LocalBusiness', 'PostalAddress', 'aggregateRating', 'AggregateRating', 'Review', 'review:', 'ratingValue']) {
      expect(SOURCES.detailPage, `no ${banned} schema`).not.toContain(banned)
    }
    // Unknown / unpublished slugs 404 and are never indexed.
    expect(SOURCES.detailPage).toContain('notFound()')
    expect(SOURCES.detailPage).toContain('robots: { index: false, follow: false }')
    // Static params derive only from approved slugs.
    expect(SOURCES.detailPage).toContain('publishedLocationSlugs()')
  })

  it('confirms neither JSON-LD helper ever emits LocalBusiness/address/review/rating', () => {
    const jsonld = read('src/components/seo/jsonld.tsx')
    for (const banned of ['LocalBusiness', 'PostalAddress', 'aggregateRating', 'ratingValue']) {
      expect(jsonld, `jsonld helpers avoid ${banned}`).not.toContain(banned)
    }
  })

  it('adds published locations plus the gated index to the sitemap', () => {
    expect(SOURCES.sitemap).toContain('publishedLocations')
    expect(SOURCES.sitemap).toContain("'/locations'")
    expect(SOURCES.sitemap).toContain('/locations/${loc.slug}')
    // The index is only emitted when at least one city is published.
    expect(SOURCES.sitemap).toContain('locations.length > 0')
  })

  it('records both new routes in the route inventory', () => {
    expect(SOURCES.routeInventory).toContain("'/[locale]/locations'")
    expect(SOURCES.routeInventory).toContain("'/[locale]/locations/[slug]'")
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Task 19 — Nairobi, Mombasa and Nakuru published through the strict gate.
 * ──────────────────────────────────────────────────────────────────────────*/

/** The published set, in registry (display) order. */
const PUBLISHED_LOCS = publishedLocations()

/** Public-facing corpus only. Deliberately excludes audit fields (non-public). */
function publicLocationCorpus(loc: KenyaLocation): string {
  return [
    loc.metaTitle,
    loc.metaDescription,
    loc.ogTitle,
    loc.ogDescription,
    loc.kicker,
    loc.title,
    loc.titleAccent,
    loc.intro,
    loc.contextIntro,
    ...loc.contextPoints,
    loc.operatingIntro,
    ...loc.operatingPatterns,
    loc.productIntro,
    ...loc.products.map((p) => p.localWorkflow),
    loc.boundaryIntro,
    ...loc.local,
    ...loc.connected,
    loc.evaluationIntro,
    ...loc.evaluationPoints,
    ...loc.sources.flatMap((s) => [s.claim, s.note]),
    ...loc.keywords,
  ].join('\n')
}

describe('Task 19 — three city hubs published through the strict gate', () => {
  it('publishes all ten cities in registry order, each with an empty gate', () => {
    expect(publishedLocationSlugs()).toEqual([
      'nairobi',
      'mombasa',
      'nakuru',
      'kisumu',
      'eldoret',
      'thika',
      'machakos',
      'meru',
      'nyeri',
      'kisii',
    ])
    for (const loc of PUBLISHED_LOCS) {
      expect(locationGateIssues(loc), `${loc.slug} gate issues`).toEqual([])
      expect(isPublishableLocation(loc), `${loc.slug} publishable`).toBe(true)
      expect(loc.status).toBe('published')
    }
    expect(locationUniquenessIssues(PUBLISHED_LOCS)).toEqual([])
  })

  it('records a transparent, non-public process label, never a fabricated human approver', () => {
    for (const loc of PUBLISHED_LOCS) {
      expect(loc.audit.approvedBy).toMatch(/Kiro editorial review/i)
      expect(loc.audit.approvedBy).not.toMatch(/\b(Mr|Mrs|Ms|Dr)\.?\b/)
      expect(loc.audit.approvedAt).toBe('2026-07-21')
      // The audit label is never surfaced to the visitor.
      render(<LocationHub location={loc} locale="ke" />)
      const text = document.querySelector('[data-location-hub]')?.textContent ?? ''
      expect(text, `${loc.slug} hides the audit label`).not.toContain(loc.audit.approvedBy!)
      cleanup()
    }
  })
})

describe('Task 19 — materially unique, not city-name substitution', () => {
  const UNIQUE_FIELDS: Array<keyof KenyaLocation> = [
    'slug',
    'city',
    'title',
    'titleAccent',
    'metaTitle',
    'metaDescription',
    'ogTitle',
    'ogDescription',
    'intro',
    'contextIntro',
    'operatingIntro',
    'boundaryIntro',
    'evaluationIntro',
    'productIntro',
  ]

  it('keeps every headline, lede, metadata and intro field distinct across all ten', () => {
    for (const field of UNIQUE_FIELDS) {
      const values = PUBLISHED_LOCS.map((l) => String(l[field]).trim().toLowerCase())
      expect(new Set(values).size, `${field} distinct per city`).toBe(values.length)
    }
  })

  it('gives each city a distinct context, operating, evaluation and boundary body', () => {
    const listKeys: Array<'contextPoints' | 'operatingPatterns' | 'evaluationPoints' | 'local' | 'connected'> =
      ['contextPoints', 'operatingPatterns', 'evaluationPoints', 'local', 'connected']
    for (const key of listKeys) {
      const joined = PUBLISHED_LOCS.map((l) => (l[key] as string[]).join('~').trim().toLowerCase())
      expect(new Set(joined).size, `${key} distinct per city`).toBe(joined.length)
    }
  })

  it('writes a distinct, city-local workflow for each product across all ten cities', () => {
    for (const id of REQUIRED_PRODUCT_IDS) {
      const copies = PUBLISHED_LOCS.map(
        (l) => l.products.find((p) => p.id === id)!.localWorkflow.trim().toLowerCase(),
      )
      expect(copies, `${id} present for all ten`).toHaveLength(10)
      expect(new Set(copies).size, `${id} localWorkflow distinct per city`).toBe(10)
      for (const c of copies) expect(c.length, `${id} localWorkflow length`).toBeGreaterThanOrEqual(60)
    }
  })

  it('addresses each city\u2019s genuinely different operating context', () => {
    const bySlug = (slug: string) => PUBLISHED_LOCS.find((l) => l.slug === slug)!
    // Nairobi: dense mixed-format trade + branch/device + delivery/traffic.
    expect(publicLocationCorpus(bySlug('nairobi'))).toMatch(/branch|device|traffic|CBD/i)
    // Mombasa: coast/port-linked trade + hospitality.
    expect(publicLocationCorpus(bySlug('mombasa'))).toMatch(/port|coast|container|hotel|touris/i)
    // Nakuru: regional distribution / agri-linked + mixed urban.
    expect(publicLocationCorpus(bySlug('nakuru'))).toMatch(/wholesale|distribut|agri|farm|by the case/i)
    // Kisumu: lake / western-region trade + fast-moving produce.
    expect(publicLocationCorpus(bySlug('kisumu'))).toMatch(/lake|victoria|western|fish|reseller/i)
    // Eldoret: North Rift grain belt + distribution corridor.
    expect(publicLocationCorpus(bySlug('eldoret'))).toMatch(/grain|north rift|dairy|harvest|corridor/i)
    // Thika: industrial / manufacturing + business-to-business distribution.
    expect(publicLocationCorpus(bySlug('thika'))).toMatch(/factory|industrial|manufactur|business-to-business|plant/i)
    // Machakos: county-service town + dryland + commuter/metro proximity.
    expect(publicLocationCorpus(bySlug('machakos'))).toMatch(/county headquarters|dryland|salaried|commute|rainfall/i)
    // Meru: Mount Kenya highland farming (coffee, tea, dairy, miraa).
    expect(publicLocationCorpus(bySlug('meru'))).toMatch(/mount kenya|miraa|coffee|dairy|crop calendar/i)
    // Nyeri: central highlands + service town + hospitality route.
    expect(publicLocationCorpus(bySlug('nyeri'))).toMatch(/aberdare|highland|administrative|hotel|visitor/i)
    // Kisii: dense Gusii highlands + smallholder + many small transactions.
    expect(publicLocationCorpus(bySlug('kisii'))).toMatch(/gusii|densely|smallholder|soapstone|small sales/i)
  })
})

describe('Task 19 — exactly five products, config-derived pricing, demo primary + WhatsApp secondary', () => {
  it('navigates to exactly the five products with matching links and city-local copy', () => {
    for (const loc of PUBLISHED_LOCS) {
      expect(loc.products, `${loc.slug} product count`).toHaveLength(REQUIRED_PRODUCT_IDS.length)
      const ids = loc.products.map((p) => p.id).sort()
      expect(ids).toEqual([...REQUIRED_PRODUCT_IDS].sort())
      for (const p of loc.products) {
        const meta = LOCATION_PRODUCT_META[p.id]
        expect(p.path).toBe(meta.path)
        expect(p.demoProduct).toBe(meta.demoProduct)
        expect(p.path.startsWith('/')).toBe(true)
        expect(p.localWorkflow.trim().length).toBeGreaterThanOrEqual(60)
      }
    }
  })

  it('keeps the KES 30,000 perpetual licence and optional KES 12,000 updates config-derived', () => {
    const facts = locationPricingFacts()
    expect(facts.oneTime).toBe(`KES ${pricing.starter.oneTimeFee.KES.toLocaleString('en-US')}`)
    expect(facts.maintenanceYearly).toBe(`KES ${pricing.starter.maintenanceYearly.KES.toLocaleString('en-US')}`)
    expect(facts.oneTime).toBe('KES 30,000')
    expect(facts.maintenanceYearly).toBe('KES 12,000')
  })

  it('renders demo-primary, configured WhatsApp secondary and locale-aware product links per city', () => {
    for (const loc of PUBLISHED_LOCS) {
      render(<LocationHub location={loc} locale="ke" whatsappUrl="https://wa.me/254700000000" />)
      for (const link of screen.getAllByRole('link', { name: /Book a demo/ })) {
        expect(link.getAttribute('href')).toMatch(/^\/ke\/contact\?type=demo/)
      }
      expect(screen.getByRole('link', { name: /Ask on WhatsApp/ }).getAttribute('href')).toMatch(
        /^https:\/\/wa\.me\/254700000000\?text=/,
      )
      for (const id of REQUIRED_PRODUCT_IDS) {
        const item = document.querySelector(`[data-location-product="${id}"]`)
        expect(item, `${loc.slug} product ${id}`).not.toBeNull()
        expect(item?.querySelector('[data-location-product-link]')?.getAttribute('href')).toBe(
          `/ke${LOCATION_PRODUCT_META[id].path}`,
        )
      }
      const text = document.querySelector('[data-location-hub]')?.textContent ?? ''
      expect(text).toContain('KES 30,000')
      expect(text).toContain('KES 12,000')
      cleanup()
    }
  })
})

describe('Task 19 — honest claims: no local presence, no puffery, explicit boundary', () => {
  it('makes no presence, superlative, metric, certification, response-time or AI/Pro/trial claim', () => {
    for (const loc of PUBLISHED_LOCS) {
      const corpus = publicLocationCorpus(loc)
      expect(corpus, `${loc.slug} superlative`).not.toMatch(
        /\bbest\b|#1|\bnumber one\b|\bleading\b|\btop[- ]rated\b|world[- ]class|revolutionar|\bunmatched\b|\bunrivall?ed\b|\bmost popular\b|\bfastest\b|\bcheapest\b|\blargest\b|\bbiggest\b/i,
      )
      expect(corpus, `${loc.slug} competitor`).not.toMatch(
        /\b(better|worse|cheaper|faster|superior)\s+than\b|\bunlike (other|competing|the)\b/i,
      )
      expect(corpus, `${loc.slug} metric`).not.toMatch(/\d+\s*%|\bsave (up to )?(ksh|kes|\$|\d)/i)
      expect(corpus, `${loc.slug} counts`).not.toMatch(
        /\d[\d,]*\+?\s*(customers|businesses|shops|users|pharmacies|clients|installs|downloads|stores|outlets)\b/i,
      )
      expect(corpus, `${loc.slug} certification`).not.toMatch(
        /\bcertified\b|fully compliant|guarantee[sd]?\s+(compliance|success|results|uptime)|\baccredited\b/i,
      )
      expect(corpus, `${loc.slug} response-time`).not.toMatch(
        /\bwithin\s+\d+\s*(minutes?|hours?|days?)\b|\b24\/7\b|same[- ]day (support|response|setup|install)|round[- ]the[- ]clock/i,
      )
      expect(corpus, `${loc.slug} ai/pro/trial`).not.toMatch(
        /\bAI\b|artificial intelligence|\bERP\b|\btrial\b|\bsign up\b|\bregister now\b|\bcreate an account\b/i,
      )
      expect(corpus, `${loc.slug} presence`).not.toMatch(
        /\boffice\b|\bshowroom\b|\bour branch(es)?\b|\bbased in\b|\blocated (at|in)\b|\bvisit (us|our)\b|\bwalk into\b|\bnear you\b|\bour (shop|store|team|staff)\b|\btestimonial|\btrusted by\b/i,
      )
    }
  })

  it('uses no em or en dashes anywhere in the public copy', () => {
    for (const loc of PUBLISHED_LOCS) {
      expect(publicLocationCorpus(loc), `${loc.slug} dashes`).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('keeps M-Pesa and eTIMS on the connected side and STK push out of the local list', () => {
    for (const loc of PUBLISHED_LOCS) {
      const connected = loc.connected.join(' ')
      const local = loc.local.join(' ')
      expect(connected, `${loc.slug} M-Pesa connected`).toMatch(/M-Pesa/)
      expect(connected, `${loc.slug} eTIMS connected`).toMatch(/eTIMS/)
      expect(connected, `${loc.slug} retry note`).toMatch(/retried when the (line|connection) returns/i)
      expect(local, `${loc.slug} no STK in local`).not.toMatch(/STK push/i)
    }
  })
})

describe('Task 19 — source quality for each published city', () => {
  // Official-source host policy. Every evidence note must point at an official
  // Kenyan authority: KNBS (knbs.or.ke), a state corporation like the Kenya
  // Ports Authority (kpa.co.ke), or a county/city government (*.go.ke). No
  // Wikipedia, SEO blogs, commercial directories or news listicles count as
  // evidence, so those hosts are refused outright.
  const OFFICIAL_HOST = /(knbs\.or\.ke|kpa\.co\.ke|[a-z][a-z0-9-]*\.go\.ke)/i
  const FORBIDDEN_HOST =
    /wikipedia|wikiwand|wikivoyage|wikidata|\bwiki\b|blogspot|wordpress|medium\.com|facebook|linkedin|tuko|opencounty|datanyze|zoominfo|listicle|\btop\s*\d+\b/i
  const PUBLISHER =
    /Kenya National Bureau of Statistics|Kenya Ports Authority|Kenya administrative|County Government|City of|official site/i
  const BUYER = /buyer|owner|matter|weight|plan|norm|receiving|trade|counter|density/i

  it('gives each city sourced local claims with a URL, an official publisher and a buyer angle', () => {
    for (const loc of PUBLISHED_LOCS) {
      expect(loc.sources.length, `${loc.slug} has sources`).toBeGreaterThanOrEqual(1)
      for (const s of loc.sources) {
        expect(s.claim.trim().length, `${loc.slug} claim length`).toBeGreaterThanOrEqual(20)
        expect(s.note, `${loc.slug} note names a publisher`).toMatch(PUBLISHER)
        expect(s.note, `${loc.slug} note carries an official-host URL`).toMatch(OFFICIAL_HOST)
        expect(s.note, `${loc.slug} note ties to buyer evaluation`).toMatch(BUYER)
      }
    }
  })

  it('cites only official authority hosts, never Wikipedia, blogs or directories', () => {
    for (const loc of PUBLISHED_LOCS) {
      for (const s of loc.sources) {
        expect(s.note, `${loc.slug} note avoids non-official hosts`).not.toMatch(FORBIDDEN_HOST)
      }
    }
  })

  it('grounds the seven Task 20 cities in their own county/city authority host', () => {
    const expected: Record<string, RegExp> = {
      kisumu: /kisumu\.go\.ke/i,
      eldoret: /uasingishu\.go\.ke/i,
      thika: /kiambu\.go\.ke/i,
      machakos: /machakos\.go\.ke/i,
      meru: /meru\.go\.ke/i,
      nyeri: /nyeri\.go\.ke/i,
      kisii: /kisii\.go\.ke/i,
    }
    for (const [slug, host] of Object.entries(expected)) {
      const loc = PUBLISHED_LOCS.find((l) => l.slug === slug)!
      const notes = loc.sources.map((s) => s.note).join(' ')
      expect(notes, `${slug} cites its own county authority`).toMatch(host)
      expect(notes, `${slug} also cites KNBS`).toMatch(/knbs\.or\.ke/i)
    }
  })
})

describe('Task 19 — each published hub renders buyer-useful and honest', () => {
  it('renders heading, county context, disclaimer, platform facts and boundary per city', () => {
    for (const loc of PUBLISHED_LOCS) {
      render(<LocationHub location={loc} locale="ke" />)
      const root = document.querySelector(`[data-location-hub="${loc.slug}"]`)
      expect(root, `${loc.slug} hub root`).not.toBeNull()
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(loc.title)
      expect(
        screen.getByRole('heading', { name: new RegExp(`${loc.city}, ${loc.county} County`, 'i') }),
        `${loc.slug} county heading`,
      ).toBeTruthy()
      const text = root?.textContent ?? ''
      expect(text, `${loc.slug} office disclaimer`).toMatch(/do not operate a local office/i)
      expect(text).toContain('KES 30,000')
      expect(text).toContain('KES 12,000')
      expect(text).toMatch(/perpetual/i)
      expect(text).toMatch(/Windows/)
      expect(text).toMatch(/M-Pesa/)
      expect(text).toMatch(/eTIMS/)
      expect(document.querySelector('a[href="#products"]')).toBeTruthy()
      expect(document.querySelector('a[href="#boundary"]')).toBeTruthy()
      cleanup()
    }
  })

  it('lists all ten published cities on the index with locale-aware links', () => {
    render(<LocationsIndex locale="ke" locations={PUBLISHED_LOCS} whatsappUrl={null} />)
    for (const loc of PUBLISHED_LOCS) {
      const row = document.querySelector(`[data-location-row="${loc.slug}"]`)
      expect(row, `row ${loc.slug}`).not.toBeNull()
      expect(row?.getAttribute('href')).toBe(`/ke/locations/${loc.slug}`)
    }
    expect(document.querySelectorAll('[data-location-row]')).toHaveLength(10)
    for (const link of screen.getAllByRole('link', { name: /Book a demo/ })) {
      expect(link.getAttribute('href')).toBe('/ke/contact?type=demo')
    }
  })
})

describe('Task 19 — static params and sitemap cover all ten published slugs', () => {
  it('derives generateStaticParams and sitemap rows from the published set', () => {
    expect(publishedLocationSlugs()).toEqual([
      'nairobi',
      'mombasa',
      'nakuru',
      'kisumu',
      'eldoret',
      'thika',
      'machakos',
      'meru',
      'nyeri',
      'kisii',
    ])
    // generateStaticParams derives only from approved, gate-passing slugs.
    expect(SOURCES.detailPage).toContain('return publishedLocationSlugs().map((slug) => ({ slug }))')
    // The sitemap loops the published locations behind the length gate.
    expect(SOURCES.sitemap).toContain('const locations = publishedLocations()')
    expect(SOURCES.sitemap).toContain('/locations/${loc.slug}')
    // Route counts are unchanged: still exactly the two location routes.
    expect(SOURCES.routeInventory).toContain("'/[locale]/locations'")
    expect(SOURCES.routeInventory).toContain("'/[locale]/locations/[slug]'")
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Task 20 - the seven new hubs (Kisumu, Eldoret, Thika, Machakos, Meru, Nyeri,
 * Kisii) published, each materially distinct and honest. The shared blocks
 * above already iterate the full published set (all ten); this block pins the
 * Task 20 additions specifically so a regression on any one is caught by name.
 * ──────────────────────────────────────────────────────────────────────────*/

const TASK20_SLUGS = ['kisumu', 'eldoret', 'thika', 'machakos', 'meru', 'nyeri', 'kisii'] as const

describe('Task 20 - seven new city hubs published through the gate', () => {
  it('publishes each of the seven new cities with an empty gate and real audit label', () => {
    for (const slug of TASK20_SLUGS) {
      const loc = publishedLocationBySlug(slug)
      expect(loc, `${slug} is published`).not.toBeNull()
      expect(locationGateIssues(loc!), `${slug} gate is empty`).toEqual([])
      expect(loc!.audit.approvedBy).toBe('Kiro editorial review (Task 20)')
      expect(loc!.audit.approvedAt).toBe('2026-07-21')
      expect(loc!.updated).toBe('2026-07-21')
    }
  })

  it('renders each new hub with its county heading, office disclaimer and platform facts', () => {
    for (const slug of TASK20_SLUGS) {
      const loc = publishedLocationBySlug(slug)!
      render(<LocationHub location={loc} locale="ke" />)
      const root = document.querySelector(`[data-location-hub="${slug}"]`)
      expect(root, `${slug} hub root`).not.toBeNull()
      expect(
        screen.getByRole('heading', { name: new RegExp(`${loc.city}, ${loc.county} County`, 'i') }),
        `${slug} county heading`,
      ).toBeTruthy()
      const text = root?.textContent ?? ''
      expect(text, `${slug} office disclaimer`).toMatch(/do not operate a local office/i)
      expect(text, `${slug} names its city as a buying guide`).toMatch(
        new RegExp(`buying guide for businesses in ${loc.city}`, 'i'),
      )
      expect(text).toContain('KES 30,000')
      expect(text).toContain('KES 12,000')
      expect(text).toMatch(/perpetual/i)
      expect(text).toMatch(/Windows/)
      // Exactly five product links, no more, no fewer.
      expect(document.querySelectorAll('[data-location-product]')).toHaveLength(5)
      cleanup()
    }
  })

  it('keeps each new city\u2019s headline, lede and metadata distinct from the other nine', () => {
    const fields: Array<keyof KenyaLocation> = ['title', 'titleAccent', 'metaTitle', 'metaDescription', 'ogDescription', 'intro']
    for (const slug of TASK20_SLUGS) {
      const loc = publishedLocationBySlug(slug)!
      for (const field of fields) {
        const mine = String(loc[field]).trim().toLowerCase()
        const others = KENYA_LOCATIONS.filter((l) => l.slug !== slug).map((l) =>
          String(l[field]).trim().toLowerCase(),
        )
        expect(others, `${slug} ${String(field)} is not reused elsewhere`).not.toContain(mine)
      }
    }
  })

  it('confirms the whole published set clears the gate and the uniqueness filter', () => {
    for (const loc of publishedLocations()) {
      expect(locationGateIssues(loc), `${loc.slug} gate`).toEqual([])
    }
    expect(locationUniquenessIssues(publishedLocations())).toEqual([])
  })
})

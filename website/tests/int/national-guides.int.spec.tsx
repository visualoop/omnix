import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BuyerGuide } from '@/components/marketing/buyer-guide'
import { GuidesIndex } from '@/components/marketing/guides-index'
import {
  BUYER_GUIDES,
  type BuyerGuide as BuyerGuideType,
  guideBySlug,
  guidePricingFacts,
  isPublishedGuide,
  publishedGuideBySlug,
  publishedGuides,
  publishedGuideSlugs,
} from '@/config/guides'
import { pricing } from '@/config/pricing'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const ROUTE_DIR = 'src/app/[locale]/(frontend)'

const SOURCES = {
  indexPage: read(`${ROUTE_DIR}/guides/page.tsx`),
  detailPage: read(`${ROUTE_DIR}/guides/[slug]/page.tsx`),
  sitemap: read('src/app/sitemap.ts'),
  routeInventory: read('src/config/route-inventory.ts'),
} as const

/** The six decision-query areas the brief asks the guide set to cover. */
const EXPECTED_SLUGS = [
  'pos-system-kenya',
  'inventory-management-software-kenya',
  'pharmacy-software-kenya',
  'restaurant-pos-kenya',
  'hardware-shop-pos-kenya',
  'salon-appointment-software-kenya',
] as const

/** Product page + demo pre-selection each guide must hand off to. */
const PRODUCT_HANDOFF: Record<string, { path: string; demoProduct: string }> = {
  'pos-system-kenya': { path: '/retail', demoProduct: 'retail' },
  'inventory-management-software-kenya': { path: '/retail', demoProduct: 'retail' },
  'pharmacy-software-kenya': { path: '/pharmacy', demoProduct: 'pharmacy' },
  'restaurant-pos-kenya': { path: '/hospitality', demoProduct: 'hospitality' },
  'hardware-shop-pos-kenya': { path: '/hardware', demoProduct: 'hardware' },
  'salon-appointment-software-kenya': { path: '/salon', demoProduct: 'salon' },
}

function guideCorpus(guide: BuyerGuideType): string {
  return [
    guide.metaTitle,
    guide.metaDescription,
    guide.ogTitle,
    guide.ogDescription,
    guide.kicker,
    guide.title,
    guide.titleAccent,
    guide.lede,
    guide.audienceIntro,
    ...guide.forYou,
    ...guide.notForYou,
    guide.workflowIntro,
    ...guide.workflow.flatMap((s) => [s.marker, s.title, s.body]),
    guide.boundaryIntro,
    ...guide.local,
    ...guide.connected,
    guide.migrationIntro,
    ...guide.migrationQuestions,
    guide.evaluationIntro,
    ...guide.evaluationQuestions,
    guide.productIntro,
    guide.product.label,
    guide.product.body,
    ...guide.keywords,
  ].join('\n')
}

const FULL_CORPUS = BUYER_GUIDES.map(guideCorpus).join('\n')

afterEach(cleanup)

describe('Task 17 — national buyer-guide registry', () => {
  it('covers the six decision-query areas and every entry is published and gate-passing', () => {
    expect(publishedGuides()).toHaveLength(6)
    expect(publishedGuideSlugs().sort()).toEqual([...EXPECTED_SLUGS].sort())
    for (const guide of BUYER_GUIDES) {
      expect(isPublishedGuide(guide), `${guide.slug} passes the publication gate`).toBe(true)
    }
  })

  it('hands each guide off to its matching product page and demo pre-selection', () => {
    for (const guide of publishedGuides()) {
      const expected = PRODUCT_HANDOFF[guide.slug]
      expect(expected, `${guide.slug} has a mapped product`).toBeTruthy()
      expect(guide.product.path).toBe(expected.path)
      expect(guide.product.demoProduct).toBe(expected.demoProduct)
    }
  })
})

describe('Task 17 — publication-quality gate', () => {
  it('rejects a thin guide, an unpublished guide, and an incomplete boundary', () => {
    const base = BUYER_GUIDES[0]

    expect(isPublishedGuide({ ...base, published: false })).toBe(false)
    expect(isPublishedGuide({ ...base, workflow: base.workflow.slice(0, 2) })).toBe(false)
    expect(isPublishedGuide({ ...base, connected: [] })).toBe(false)
    expect(isPublishedGuide({ ...base, forYou: base.forYou.slice(0, 1) })).toBe(false)
    expect(isPublishedGuide({ ...base, evaluationQuestions: base.evaluationQuestions.slice(0, 2) })).toBe(false)
    expect(isPublishedGuide({ ...base, lede: 'Too short.' })).toBe(false)
    expect(isPublishedGuide({ ...base, product: { ...base.product, body: 'Short.' } })).toBe(false)
  })

  it('excludes an unpublished slug from render, params and lookup', () => {
    expect(guideBySlug('does-not-exist')).toBeNull()
    expect(publishedGuideBySlug('does-not-exist')).toBeNull()
    expect(publishedGuideSlugs()).not.toContain('does-not-exist')
  })
})

describe('Task 17 — material distinctness (no thin templating)', () => {
  const fields: Array<keyof BuyerGuideType> = [
    'slug',
    'title',
    'lede',
    'metaTitle',
    'metaDescription',
    'ogDescription',
    'audienceIntro',
    'workflowIntro',
    'boundaryIntro',
    'migrationIntro',
    'evaluationIntro',
  ]

  it('keeps every headline, lede and metadata field unique across guides', () => {
    for (const field of fields) {
      const values = publishedGuides().map((g) => String(g[field]))
      expect(new Set(values).size, `${field} is unique per guide`).toBe(values.length)
    }
  })

  it('gives each guide a distinct workflow, audience and evaluation body', () => {
    const workflowText = publishedGuides().map((g) =>
      g.workflow.map((s) => `${s.title}|${s.body}`).join('~'),
    )
    expect(new Set(workflowText).size).toBe(workflowText.length)

    const forYouText = publishedGuides().map((g) => g.forYou.join('~'))
    expect(new Set(forYouText).size).toBe(forYouText.length)

    const evalText = publishedGuides().map((g) => g.evaluationQuestions.join('~'))
    expect(new Set(evalText).size).toBe(evalText.length)
  })

  it('carries the required substantive sections for every published guide', () => {
    for (const guide of publishedGuides()) {
      expect(guide.forYou.length, `${guide.slug} forYou`).toBeGreaterThanOrEqual(3)
      expect(guide.notForYou.length, `${guide.slug} notForYou`).toBeGreaterThanOrEqual(2)
      expect(guide.workflow.length, `${guide.slug} workflow`).toBeGreaterThanOrEqual(4)
      expect(guide.local.length, `${guide.slug} local`).toBeGreaterThanOrEqual(3)
      expect(guide.connected.length, `${guide.slug} connected`).toBeGreaterThanOrEqual(2)
      expect(guide.migrationQuestions.length, `${guide.slug} migration`).toBeGreaterThanOrEqual(3)
      expect(guide.evaluationQuestions.length, `${guide.slug} evaluation`).toBeGreaterThanOrEqual(4)
      // M-Pesa and eTIMS appear in the connected boundary where relevant.
      const connected = guide.connected.join(' ')
      expect(connected).toMatch(/M-Pesa/)
      expect(connected).toMatch(/eTIMS/)
    }
  })
})

describe('Task 17 — honest claims only', () => {
  it('makes no superlative, ranking or competitor-denigration claims', () => {
    expect(FULL_CORPUS).not.toMatch(/\bbest\b|#1|\bnumber one\b|\bleading\b|\btop[- ]rated\b|world[- ]class|revolutionary/i)
    expect(FULL_CORPUS).not.toMatch(/\b(better|worse|cheaper|faster) than\b/i)
    expect(FULL_CORPUS).not.toMatch(/\bunlike (other|competing|the)\b/i)
  })

  it('invents no savings, adoption, testimonials, customer counts or locations', () => {
    expect(FULL_CORPUS).not.toMatch(/\d+\s*%/)
    expect(FULL_CORPUS).not.toMatch(/\bsave (up to )?(ksh|kes|\d)/i)
    expect(FULL_CORPUS).not.toMatch(/\d[\d,]*\+?\s*(customers|businesses|shops|users|pharmacies|clients)/i)
    expect(FULL_CORPUS).not.toMatch(/offices? (in|across)|nationwide|countrywide|branches across/i)
    expect(FULL_CORPUS).not.toMatch(/testimonial|rated \d|\bstar rating\b/i)
  })

  it('promises no certification or regulatory guarantee, and keeps the honest disclaimer', () => {
    expect(FULL_CORPUS).not.toMatch(/\bcertified\b|fully compliant|guarantee[sd]? (compliance|success|results)|regulatory (approval|guarantee)/i)
    // The pharmacy guide keeps the honest "we do not certify" boundary.
    const pharmacy = guideBySlug('pharmacy-software-kenya')!
    expect(pharmacy.notForYou.join(' ')).toMatch(/statutory duty stays with the pharmacy/i)
  })

  it('avoids trial, Pro-tier and AI positioning', () => {
    expect(FULL_CORPUS).not.toMatch(/\btrial\b/i)
    expect(FULL_CORPUS).not.toMatch(/\bpro\b(?!duct|cess|cedure|vide|per|mpt|of)/i)
    expect(FULL_CORPUS).not.toMatch(/\bAI\b|artificial intelligence|\bERP\b/)
  })

  it('uses no em or en dashes anywhere in the guide copy', () => {
    expect(FULL_CORPUS).not.toMatch(/[\u2013\u2014]/)
  })

  it('never claims internet-required workflows run offline', () => {
    for (const guide of publishedGuides()) {
      const connected = guide.connected.join(' ')
      const local = guide.local.join(' ')
      // M-Pesa STK / eTIMS submission belong in connected, not local.
      expect(local).not.toMatch(/STK push/i)
      expect(connected).toMatch(/retried when the connection returns|needs? a connection|at the (counter|table|checkout)/i)
    }
  })
})

describe('Task 17 — pricing derived from config, not restated', () => {
  it('derives the perpetual licence and optional compliance facts from pricing config', () => {
    const facts = guidePricingFacts()
    expect(facts.oneTime).toBe(`KES ${pricing.starter.oneTimeFee.KES.toLocaleString('en-US')}`)
    expect(facts.maintenanceYearly).toBe(`KES ${pricing.starter.maintenanceYearly.KES.toLocaleString('en-US')}`)
    expect(facts.oneTime).toBe('KES 30,000')
    expect(facts.maintenanceYearly).toBe('KES 12,000')
  })
})

describe('Task 17 — BuyerGuide render', () => {
  const guide = guideBySlug('pos-system-kenya')!

  it('renders every required section and the derived platform facts', () => {
    render(<BuyerGuide guide={guide} locale="ke" />)
    const root = document.querySelector('[data-buyer-guide="pos-system-kenya"]')
    expect(root).not.toBeNull()

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('How to choose a POS system')
    for (const heading of [
      /who this is for/i,
      /walk the day/i,
      /what runs on the device/i,
      /platform facts/i,
      /moving your data/i,
      /any vendor|before you commit/i,
      /Omnix Retail/i,
    ]) {
      expect(screen.getByRole('heading', { name: heading }), `heading ${heading}`).toBeTruthy()
    }

    const text = root?.textContent ?? ''
    expect(text).toContain('KES 30,000')
    expect(text).toContain('KES 12,000')
    expect(text).toMatch(/perpetual/i)
    expect(text).toMatch(/Windows/)
    expect(text).toMatch(/M-Pesa/)
    expect(text).toMatch(/eTIMS/)
    // On-page contents rail anchors.
    expect(document.querySelector('a[href="#workflow"]')).toBeTruthy()
    expect(document.querySelector('a[href="#boundary"]')).toBeTruthy()
  })

  it('links to the matching product page and a locale-aware, product-scoped demo', () => {
    render(<BuyerGuide guide={guide} locale="ng" whatsappUrl="https://wa.me/254700000000" />)

    for (const link of screen.getAllByRole('link', { name: 'Book a demo' })) {
      expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=retail')
    }
    const productLinks = screen.getAllByRole('link', { name: 'View Omnix Retail' })
    expect(productLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of productLinks) {
      expect(link.getAttribute('href')).toBe('/ng/retail')
    }
    expect(screen.getByRole('link', { name: 'All buyer guides' }).getAttribute('href')).toBe('/ng/guides')

    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    }
  })

  it('carries no banned marketing claims in the rendered output', () => {
    render(<BuyerGuide guide={guide} locale="ke" />)
    const text = document.querySelector('[data-buyer-guide]')?.textContent ?? ''
    expect(text).not.toMatch(/\bbest\b|#1|\bleading\b|guarantee[sd]? compliance|\btrial\b/i)
  })
})

describe('Task 17 — GuidesIndex render', () => {
  it('lists every published guide with a locale-aware link and a demo CTA', () => {
    render(<GuidesIndex locale="ke" guides={publishedGuides()} whatsappUrl={null} />)

    for (const slug of EXPECTED_SLUGS) {
      const row = document.querySelector(`[data-guide-row="${slug}"]`)
      expect(row, `row for ${slug}`).not.toBeNull()
      expect(row?.getAttribute('href')).toBe(`/ke/guides/${slug}`)
    }
    expect(screen.getAllByRole('link', { name: /Book a demo/ }).length).toBeGreaterThanOrEqual(1)
    for (const link of screen.getAllByRole('link', { name: /Book a demo/ })) {
      expect(link.getAttribute('href')).toBe('/ke/contact?type=demo')
    }
    expect(screen.getByRole('link', { name: /Compare the five products/ }).getAttribute('href')).toBe(
      '/ke/modules',
    )
  })
})

describe('Task 17 — routing, schema and sitemap wiring', () => {
  it('gives the index a Kenya-only canonical, helper, redirect and Breadcrumb schema only', () => {
    // Task 28: national buyer guides are Kenya-only content, so the canonical
    // always resolves to /ke/guides regardless of the visitor's market.
    expect(SOURCES.indexPage).toContain('const canonical = `${SITE_URL}/ke/guides`')
    expect(SOURCES.indexPage).toContain("buildKenyaOnlyAlternatesLanguages('/guides')")
    // Non-ke markets 308 (permanentRedirect) to /ke and stay noindex,follow
    // as defence in depth; the /ke page renders with locale="ke".
    expect(SOURCES.indexPage).toContain('permanentRedirect')
    expect(SOURCES.indexPage).toContain("locale !== 'ke'")
    expect(SOURCES.indexPage).toContain("locale === 'ke' ? undefined : { index: false, follow: true }")
    expect(SOURCES.indexPage).toContain('locale="ke"')
    expect(SOURCES.indexPage).toContain('BreadcrumbJsonLd')
    expect(SOURCES.indexPage).not.toContain('SoftwareJsonLd')
  })

  it('gives the detail route a Kenya-only canonical/helper/redirect and honest Article + Breadcrumb schema', () => {
    expect(SOURCES.detailPage).toContain('const canonical = `${SITE_URL}/ke/guides/${guide.slug}`')
    expect(SOURCES.detailPage).toContain('buildKenyaOnlyAlternatesLanguages(`/guides/${guide.slug}`)')
    // Non-ke markets 308 to /ke; the /ke page renders with locale="ke".
    expect(SOURCES.detailPage).toContain('permanentRedirect')
    expect(SOURCES.detailPage).toContain("locale === 'ke' ? undefined : { index: false, follow: true }")
    expect(SOURCES.detailPage).toContain('locale="ke"')
    expect(SOURCES.detailPage).toContain('ArticleJsonLd')
    expect(SOURCES.detailPage).toContain('BreadcrumbJsonLd')
    // A buyer guide is editorial content, not the software product itself.
    expect(SOURCES.detailPage).not.toContain('SoftwareJsonLd')
    // Unpublished / unknown slugs 404 and are never indexed.
    expect(SOURCES.detailPage).toContain('notFound()')
    expect(SOURCES.detailPage).toContain('robots: { index: false, follow: false }')
    // Static params derive only from approved slugs.
    expect(SOURCES.detailPage).toContain('publishedGuideSlugs()')
  })

  it('includes only approved guides plus the index in the sitemap', () => {
    expect(SOURCES.sitemap).toContain('publishedGuides')
    expect(SOURCES.sitemap).toContain("'/guides'")
    expect(SOURCES.sitemap).toContain('/guides/${g.slug}')
  })

  it('records both new routes in the route inventory', () => {
    expect(SOURCES.routeInventory).toContain("'/[locale]/guides'")
    expect(SOURCES.routeInventory).toContain("'/[locale]/guides/[slug]'")
  })
})

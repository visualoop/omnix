import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LegalLayout } from '@/components/marketing/legal-layout'
import { postBySlug, publishedPosts } from '@/lib/blog-seed'
import { DOCS_SEED, docBySlug } from '@/lib/docs-seed'
import {
  DOC_PLACEHOLDER_MARKER,
  isDocPlaceholder,
  isPublishedDoc,
} from '@/lib/docs-visibility'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const ROUTE_DIR = 'src/app/[locale]/(frontend)'

const SOURCES = {
  blogList: read(`${ROUTE_DIR}/blog/page.tsx`),
  blogDetail: read(`${ROUTE_DIR}/blog/[slug]/page.tsx`),
  docsList: read(`${ROUTE_DIR}/docs/page.tsx`),
  docsDetail: read(`${ROUTE_DIR}/docs/[slug]/page.tsx`),
  changelog: read(`${ROUTE_DIR}/changelog/page.tsx`),
  roadmap: read(`${ROUTE_DIR}/roadmap/page.tsx`),
  terms: read(`${ROUTE_DIR}/terms/page.tsx`),
  privacy: read(`${ROUTE_DIR}/privacy/page.tsx`),
  refund: read(`${ROUTE_DIR}/refund-policy/page.tsx`),
  legalLayout: read('src/components/marketing/legal-layout.tsx'),
  sitemap: read('src/app/sitemap.ts'),
} as const

const CONTENT_PAGES: Array<[string, string, string]> = [
  ['blog', SOURCES.blogList, '/blog'],
  ['docs', SOURCES.docsList, '/docs'],
  ['changelog', SOURCES.changelog, '/changelog'],
  ['roadmap', SOURCES.roadmap, '/roadmap'],
]

const LEGAL_PAGES: Array<[string, string, string]> = [
  ['terms', SOURCES.terms, '/terms'],
  ['privacy', SOURCES.privacy, '/privacy'],
  ['refund-policy', SOURCES.refund, '/refund-policy'],
]

afterEach(cleanup)

describe('Task 16 — localized, indexable metadata', () => {
  it('gives every content and legal route a locale canonical and hreflang alternates', () => {
    for (const [route, source] of [...CONTENT_PAGES, ...LEGAL_PAGES]) {
      expect(source, `${route} canonical`).toContain(`const canonical = \`\${SITE_URL}/\${locale}/${route}\``)
      expect(source, `${route} hreflang`).toContain(`buildAlternatesLanguages('/${route}')`)
    }
  })
})

describe('Task 16 — Working Counter aesthetic, no legacy hero or slop', () => {
  it('drops the PageHero glow, gradients, and closing-cta signup band on every redesigned route', () => {
    const all = [...CONTENT_PAGES, ...LEGAL_PAGES].map(([, source]) => source).concat(SOURCES.blogDetail, SOURCES.docsDetail, SOURCES.legalLayout)
    for (const source of all) {
      expect(source).not.toContain('page-hero')
      expect(source).not.toContain('PageHero')
      expect(source).not.toContain('ClosingCtaSection')
      expect(source).not.toMatch(/radial-gradient|linear-gradient/)
    }
  })

  it('keeps CTAs demo-led and never ships trial, signup, or buy-variant links on marketing routes', () => {
    for (const [route, source] of CONTENT_PAGES) {
      expect(source, `${route} demo href`).toContain('`/${locale}/contact?type=demo`')
      expect(source, `${route} book a demo`).toContain('Book a demo')
      expect(source, `${route} no signup`).not.toContain('/signup')
      expect(source, `${route} no buy variant`).not.toMatch(/\/buy\?variant/)
      expect(source, `${route} no trial CTA`).not.toMatch(/free trial|start trial/i)
    }
  })
})

describe('Task 16/30 blog — fail-closed publication and broken-link fix', () => {
  it('drives the listing from the publication resolver so every card resolves', () => {
    expect(SOURCES.blogList).toContain("from '@/lib/blog-seed'")
    expect(SOURCES.blogList).toContain('publishedPosts()')
    // The previous hard-coded, 404-ing slugs must be gone.
    expect(SOURCES.blogList).not.toContain('why-offline-first')
    expect(SOURCES.blogList).not.toContain('pharmacy-compliance')
    expect(SOURCES.blogList).not.toContain('one-time-pricing')
    // Links carry the active locale.
    expect(SOURCES.blogList).toContain('`/${locale}/blog/${')
  })

  it('publishes only the reviewed factual article and fails legacy seeds closed', () => {
    const posts = publishedPosts()
    expect(posts.map((post) => post.slug)).toEqual(['offline-first-architecture'])
    expect(postBySlug('omnix-rebrand')).toBeNull()
    const corpus = posts.map((post) => `${post.title}\n${post.excerpt}\n${post.body}`).join('\n')
    expect(corpus).not.toMatch(/\bAI\b|\bPro\b|\btrial\b/i)
    expect(corpus).not.toMatch(/testimonial|first (?:three|paying) customer|customer interviews/i)
    expect(corpus).not.toMatch(/ten minutes|two hours per branch|forty-three minutes|eight to twelve hours/i)
  })

  it('renders the detail article without a placeholder gradient block and keeps JSON-LD', () => {
    expect(SOURCES.blogDetail).toContain('ArticleJsonLd')
    expect(SOURCES.blogDetail).toContain('`/${locale}/blog`')
    expect(SOURCES.blogDetail).not.toMatch(/opacity-25 sm:text-\[200px\]/)
    expect(SOURCES.blogDetail).toContain('robots: { index: false, follow: false }')
  })
})

describe('Task 16 docs — placeholder content is not indexable', () => {
  it('lists only published docs and links them within the locale', () => {
    expect(SOURCES.docsList).toContain("from '@/lib/docs-visibility'")
    expect(SOURCES.docsList).toContain('DOCS_SEED.filter(isPublishedDoc)')
    expect(SOURCES.docsList).toContain('`/${locale}/docs/${doc.slug}`')
  })

  it('noindexes scaffold detail pages and shows a written-later state, not raw TODO text', () => {
    expect(SOURCES.docsDetail).toContain('isDocPlaceholder')
    expect(SOURCES.docsDetail).toContain('robots: { index: false, follow: true }')
    expect(SOURCES.docsDetail).toContain('This guide is being written')
    // Missing docs are also excluded from the index.
    expect(SOURCES.docsDetail).toContain('robots: { index: false, follow: false }')
  })

  it('keeps placeholder scaffolds out of the sitemap', () => {
    expect(SOURCES.sitemap).toContain('isPublishedDoc')
    expect(SOURCES.sitemap).toContain('DOCS_SEED.filter(isPublishedDoc)')
  })
})

describe('Task 16 changelog & roadmap — honest, shipped vs planned', () => {
  it('keeps the changelog reading shipped releases from the database without exposing installers', () => {
    expect(SOURCES.changelog).toContain("export const dynamic = 'force-dynamic'")
    expect(SOURCES.changelog).toContain('.from(releases)')
    expect(SOURCES.changelog).toContain("eq(releases.channel, 'stable')")
    // No public installer links or download URLs.
    expect(SOURCES.changelog).not.toMatch(/releases\/download|windowsNsisUrl|windowsMsiUrl|\.exe\b|\.msi\b/)
    expect(SOURCES.changelog).not.toMatch(/href=\{[^}]*\.(exe|msi)/)
  })

  it('separates shipped, in-progress, and exploring on the roadmap without a dated promise', () => {
    for (const label of ["label: 'Shipped'", "label: 'In progress'", "label: 'Exploring'"]) {
      expect(SOURCES.roadmap).toContain(label)
    }
    // No quarter or calendar-year delivery promises.
    expect(SOURCES.roadmap).not.toMatch(/\bQ[1-4]\b|\b20\d{2}\b/)
  })
})

describe('Task 16 legal copy — evidence-led, no invented claims', () => {
  it('describes the perpetual per-device licence, optional compliance, protected installer, and Paystack', () => {
    expect(SOURCES.terms).toContain('perpetual')
    expect(SOURCES.terms).toContain('KES 30,000 one-time')
    expect(SOURCES.terms).toContain('KES 12,000')
    expect(SOURCES.terms).toContain('Paystack')
    expect(SOURCES.terms).toContain('customer dashboard')
    // The invented machine tiers are gone.
    expect(SOURCES.terms).not.toMatch(/10 for standard|unlimited for custom|3 for trial/)
    // Binding public model: no public Pro product, no KES 150,000 tier, no public trial.
    expect(SOURCES.terms).not.toContain('KES 150,000')
    expect(SOURCES.terms).not.toMatch(/Pro (licence|multi-trade|multi trade)/i)
    expect(SOURCES.terms).not.toMatch(/trial/i)
  })

  it('corrects the privacy claim that the local database is encrypted', () => {
    expect(SOURCES.privacy).not.toContain('encrypted SQLite database')
    expect(SOURCES.privacy).toContain('does not encrypt the local database file')
    expect(SOURCES.privacy).toContain('AES-256-GCM')
    expect(SOURCES.privacy).toContain('opt-in')
  })

  it('keeps the refund window evidenced and free of invented guarantees', () => {
    expect(SOURCES.refund).toContain('14 days')
    expect(SOURCES.refund).toContain('Paystack processing fee')
    expect(SOURCES.refund).toContain('perpetual')
    expect(SOURCES.refund).not.toMatch(/within 5 business days|within 24 hours/i)
    expect(SOURCES.refund).not.toMatch(/custom licences/i)
    // Binding public model: no public trial CTA / trial-first framing.
    expect(SOURCES.refund).not.toMatch(/trial/i)
  })

  it('never claims counsel approval, certification, or a regulatory guarantee', () => {
    for (const [, source] of LEGAL_PAGES) {
      expect(source).not.toMatch(/reviewed by (a )?lawyer|counsel[- ]approved|legally binding advice/i)
      expect(source).not.toMatch(/certified|guarantee[ds]? compliance|fully compliant/i)
    }
  })
})

describe('Task 16 docs-visibility classifier', () => {
  it('flags TODO scaffolds and clears written docs', () => {
    expect(isDocPlaceholder({ body: `intro\n\n${DOC_PLACEHOLDER_MARKER}` })).toBe(true)
    expect(isDocPlaceholder({ body: 'A fully written guide.' })).toBe(false)
    expect(isPublishedDoc({ body: 'A fully written guide.' })).toBe(true)

    const banking = docBySlug('banking')
    const gettingStarted = docBySlug('getting-started')
    expect(banking).not.toBeNull()
    expect(gettingStarted).not.toBeNull()
    expect(isDocPlaceholder(banking!)).toBe(true)
    expect(isPublishedDoc(gettingStarted!)).toBe(true)

    // At least one of each exists so the index and noindex paths are both exercised.
    expect(DOCS_SEED.some(isPublishedDoc)).toBe(true)
    expect(DOCS_SEED.some(isDocPlaceholder)).toBe(true)
  })
})

describe('Task 16 LegalLayout — accessible, numbered-ornament-free', () => {
  const sections = [
    { id: 'first', heading: 'First section', body: <p>Body one.</p> },
    { id: 'second', heading: 'Second section', body: <p>Body two.</p> },
  ]

  it('renders a masthead, contents rail, sections, and a demo CTA without decorative numbering', () => {
    const { container } = render(
      <LegalLayout
        kicker="Agreement"
        title="Terms of service"
        description="Plain terms."
        lastUpdated="2026-07-01"
        locale="ke"
        supportEmail="support@omnix.co.ke"
        sections={sections}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Terms of service')
    expect(screen.getByRole('heading', { name: 'First section' })).toBeTruthy()
    // Contents rail links to each section anchor.
    const toc = screen.getByRole('navigation', { name: 'On this page' })
    expect(toc.querySelector('a[href="#first"]')).toBeTruthy()
    expect(toc.querySelector('a[href="#second"]')).toBeTruthy()
    // Demo CTA is locale-aware.
    expect(screen.getByRole('link', { name: 'Book a demo' }).getAttribute('href')).toBe(
      '/ke/contact?type=demo',
    )
    // No "01." / "02." decorative numbering anywhere.
    expect(container.textContent).not.toMatch(/\b0\d\./)
    // Machine-readable last-updated.
    expect(container.querySelector('time[datetime="2026-07-01"]')).toBeTruthy()
  })
})

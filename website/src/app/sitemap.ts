import type { MetadataRoute } from 'next'
import { BRAND_DOMAIN } from '@/lib/brand'
import { publishedPosts } from '@/lib/blog-seed'
import { DOCS_SEED } from '@/lib/docs-seed'
import { isPublishedDoc } from '@/lib/docs-visibility'
import { publishedGuides } from '@/config/guides'
import { publishedLocations } from '@/config/locations'
import { buildAlternatesLanguages, buildKenyaOnlyAlternatesLanguages } from '@/lib/hreflang'
import { COUNTRY_LOCALES } from '@/i18n/routing'

/**
 * Per-locale sitemap.
 *
 * Only canonical, indexable, non-redirecting public routes are emitted, once
 * per country locale (/ke, /us, /gb, /ng, /gh, /za, /in, /rw, /tz, /ug, /eg,
 * /ae) so Google indexes each market variant separately.
 *
 * Deliberately EXCLUDED:
 *   - legacy redirects: /ai, /dawa, /pro, /payroll-pack, /modules/[slug]
 *   - private/app families: /admin, /dashboard, /(auth), /(checkout)=/buy,
 *     /onboarding, /api, /region-unavailable
 *   - unpublished docs (TODO scaffolds), unpublished guides, ungated locations
 *   - query-string and protected-download URLs
 *
 * `alternates.languages` declares every locale's counterpart with valid BCP-47
 * hreflang codes (en-KE, en-US, …, x-default) via buildAlternatesLanguages so
 * Google treats the market variants as equivalents.
 *
 * EXCEPTION — Kenya-only content: national buyer guides (/guides) and local
 * city hubs (/locations) describe the Kenyan market only. They are emitted
 * ONCE under /ke with Kenya-only hreflang (en-KE + x-default → /ke) via
 * buildKenyaOnlyAlternatesLanguages, never per-market, so they can't become
 * duplicate / scaled local SEO (a doorway pattern).
 *
 * lastModified is truthful and stable: authored source dates for blog posts,
 * guides and location hubs; a fixed content-revision date for evergreen
 * pages. We never stamp build-time `now()` on every URL, which would tell
 * crawlers the whole site changed on each deploy.
 */

/** Fixed content-revision date for evergreen marketing/legal pages. Bump when
 *  the underlying copy is materially revised — never auto-set to build time. */
const SITE_LAST_MODIFIED = '2026-07-21'

type Freq = MetadataRoute.Sitemap[number]['changeFrequency']

interface StaticEntry {
  path: string
  changeFrequency: Freq
  /** Base priority for the home market (/ke); other markets are scaled down. */
  priority: number
}

/** Canonical, indexable public routes (locale-free paths). */
const STATIC_ENTRIES: StaticEntry[] = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  // Five public products.
  { path: '/pharmacy', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/retail', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/hospitality', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/hardware', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/salon', changeFrequency: 'weekly', priority: 0.8 },
  // Catalogue + buying.
  { path: '/modules', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/downloads', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/migration', changeFrequency: 'monthly', priority: 0.6 },
  // Compliance / integration topics.
  { path: '/etims', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/mpesa', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/sha', changeFrequency: 'monthly', priority: 0.6 },
  // NOTE: /guides is deliberately NOT here. Buyer guides are Kenya-only
  // content and are emitted once under /ke below — never per-market.
  // Company / trust.
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/partners', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/team', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/security', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/developers', changeFrequency: 'monthly', priority: 0.4 },
  // Content hubs.
  { path: '/blog', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/docs', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/roadmap', changeFrequency: 'monthly', priority: 0.4 },
  // Legal.
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund-policy', changeFrequency: 'yearly', priority: 0.3 },
]

/** Home market keeps full weight; other markets are uniformly de-emphasised
 *  until they start ranking. This is a market-priority hint, not keyword
 *  gaming — the relative ordering within a locale is unchanged. */
function scaledPriority(cc: string, base: number): number {
  const p = cc === 'ke' ? base : base - 0.15
  return Math.min(1, Math.max(0.1, Math.round(p * 100) / 100))
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${BRAND_DOMAIN}`
  const out: MetadataRoute.Sitemap = []

  const publishedDocs = DOCS_SEED.filter(isPublishedDoc)
  const blogPosts = publishedPosts()
  const guides = publishedGuides()
  const locations = publishedLocations()

  for (const cc of COUNTRY_LOCALES) {
    // Evergreen static + product routes.
    for (const entry of STATIC_ENTRIES) {
      out.push({
        url: `${base}/${cc}${entry.path}`,
        lastModified: SITE_LAST_MODIFIED,
        changeFrequency: entry.changeFrequency,
        priority: scaledPriority(cc, entry.priority),
        alternates: { languages: buildAlternatesLanguages(entry.path) },
      })
    }

    // Blog posts — authored publish date.
    for (const p of blogPosts) {
      const path = `/blog/${p.slug}`
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: p.publishedAt,
        changeFrequency: 'monthly',
        priority: scaledPriority(cc, 0.5),
        alternates: { languages: buildAlternatesLanguages(path) },
      })
    }

    // Docs — only published (TODO scaffolds and missing docs are excluded so
    // placeholder content is never advertised for indexing).
    for (const d of publishedDocs) {
      const path = `/docs/${d.slug}`
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: SITE_LAST_MODIFIED,
        changeFrequency: 'monthly',
        priority: scaledPriority(cc, 0.5),
        alternates: { languages: buildAlternatesLanguages(path) },
      })
    }
  }

  // ── Kenya-only content ────────────────────────────────────────────────
  // National buyer guides and local city hubs describe the Kenyan market only.
  // They are emitted ONCE under /ke — never duplicated across the 12 market
  // locales — with Kenya-only hreflang (en-KE + x-default → /ke). Emitting them
  // per-market would be duplicate / scaled local SEO (a doorway pattern).

  // National buyer guides — only guides that pass the publication gate.
  out.push({
    url: `${base}/ke/guides`,
    lastModified: SITE_LAST_MODIFIED,
    changeFrequency: 'weekly',
    priority: 0.6,
    alternates: { languages: buildKenyaOnlyAlternatesLanguages('/guides') },
  })
  for (const g of guides) {
    const path = `/guides/${g.slug}`
    out.push({
      url: `${base}/ke${path}`,
      lastModified: g.updated,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: buildKenyaOnlyAlternatesLanguages(path) },
    })
  }

  // Local city buying guides — only gate-passing, approved entries. The
  // /locations index is emitted only once at least one city is published,
  // so an empty index is never advertised for indexing.
  if (locations.length > 0) {
    out.push({
      url: `${base}/ke/locations`,
      lastModified: SITE_LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: { languages: buildKenyaOnlyAlternatesLanguages('/locations') },
    })
    for (const loc of locations) {
      const path = `/locations/${loc.slug}`
      out.push({
        url: `${base}/ke${path}`,
        lastModified: loc.updated,
        changeFrequency: 'monthly',
        priority: 0.55,
        alternates: { languages: buildKenyaOnlyAlternatesLanguages(path) },
      })
    }
  }

  return out
}

import type { MetadataRoute } from 'next'
import { BRAND_DOMAIN } from '@/lib/brand'
import { POSTS_SEED } from '@/lib/blog-seed'
import { DOCS_SEED } from '@/lib/docs-seed'
import { MODULES_SEED } from '@/lib/modules-seed'
import { COUNTRY_LOCALES } from '@/i18n/routing'

/**
 * Per-locale sitemap.
 *
 * Every public route is emitted once per country locale (/ke, /us, /gb,
 * /ng, /gh, /za, /in, /tz, /ug, /eg, /ae) so Google indexes each market
 * variant separately. Priority is weighted toward /ke (the home market)
 * for the foreseeable future; once /us etc. start ranking we can flatten
 * the priority distribution.
 *
 * `alternates.languages` declares every locale's counterpart so Google
 * knows the pages are equivalents (no duplicate-content risk).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${BRAND_DOMAIN}`
  const now = new Date().toISOString()

  const PUBLIC_PATHS = [
    '',
    '/pricing',
    '/ai',
    '/modules',
    '/pro',
    '/dawa',
    '/retail',
    '/hospitality',
    '/hardware',
    '/etims',
    '/mpesa',
    '/sha',
    '/downloads',
    '/changelog',
    '/about',
    '/contact',
    '/support',
    '/blog',
    '/docs',
    '/privacy',
    '/terms',
    '/refund-policy',
  ]

  const out: MetadataRoute.Sitemap = []

  function alternatesFor(path: string): Record<string, string> {
    return Object.fromEntries(
      COUNTRY_LOCALES.map((cc) => [cc, `${base}/${cc}${path}`]),
    )
  }

  // Static + product paths × every locale.
  for (const cc of COUNTRY_LOCALES) {
    for (const path of PUBLIC_PATHS) {
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
        priority: cc === 'ke' ? (path === '' ? 1.0 : 0.7) : (path === '' ? 0.85 : 0.6),
        alternates: { languages: alternatesFor(path) },
      })
    }

    // Modules detail pages.
    for (const m of MODULES_SEED) {
      const path = `/modules/${m.slug}`
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: cc === 'ke' ? 0.6 : 0.5,
        alternates: { languages: alternatesFor(path) },
      })
    }

    // Blog posts.
    for (const p of POSTS_SEED) {
      const path = `/blog/${p.slug}`
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: p.publishedAt,
        changeFrequency: 'monthly' as const,
        priority: cc === 'ke' ? 0.5 : 0.4,
        alternates: { languages: alternatesFor(path) },
      })
    }

    // Doc pages.
    for (const d of DOCS_SEED) {
      const path = `/docs/${d.slug}`
      out.push({
        url: `${base}/${cc}${path}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: cc === 'ke' ? 0.5 : 0.4,
        alternates: { languages: alternatesFor(path) },
      })
    }
  }

  return out
}

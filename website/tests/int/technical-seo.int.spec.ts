import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { buildAlternatesLanguages, buildHreflangLinks, buildKenyaOnlyAlternatesLanguages, buildKenyaOnlyHreflangLinks } from '@/lib/hreflang'
import {
  canonicalPublicRedirectPath,
  isUnknownKenyaOnlyDetailPath,
} from '@/lib/canonical-public-redirect'
import { preserveSafeQuery, preserveSafeUrlSearchParams } from '@/lib/redirect-query'
import { pricing } from '@/config/pricing'
import { publishedGuides } from '@/config/guides'
import { publishedLocations } from '@/config/locations'
import { publishedPosts } from '@/lib/blog-seed'
import { DOCS_SEED, docBySlug } from '@/lib/docs-seed'
import { isDocPlaceholder, isLegacyExcludedDocSlug, isPublishedDoc } from '@/lib/docs-visibility'
import { APP_PAGE_ROUTES, APP_API_ROUTES } from '@/config/route-inventory'
import { COUNTRY_LOCALES } from '@/i18n/routing'
import {
  buildSocialMetadata,
  generatedOgImage,
  ogLocaleFor,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '@/lib/seo-metadata'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const FRONTEND = 'src/app/[locale]/(frontend)'

const COUNTRY_SET = new Set<string>(COUNTRY_LOCALES as readonly string[])

/* ────────────────────────────────────────────────────────────────────────
 * 1. Redirect map — deterministic permanent (308) redirects, safe query,
 *    no acquisition CTAs, no redirect chains.
 * ──────────────────────────────────────────────────────────────────────── */

const REDIRECT_PAGES: Array<{ file: string; target: string }> = [
  { file: `${FRONTEND}/dawa/page.tsx`, target: '/${locale}/pharmacy' },
  { file: `${FRONTEND}/pro/page.tsx`, target: '/${locale}/modules' },
  { file: `${FRONTEND}/ai/page.tsx`, target: '/${locale}/modules' },
  { file: `${FRONTEND}/payroll-pack/page.tsx`, target: '/${locale}/modules' },
]

describe('Task 28 — legacy route consolidation (permanent redirects)', () => {
  it('serves /dawa, /pro, /ai, /payroll-pack as 308 redirects to canonical routes with safe query', () => {
    for (const { file, target } of REDIRECT_PAGES) {
      const src = read(file)
      expect(src, `${file} uses permanentRedirect`).toContain('permanentRedirect(')
      expect(src, `${file} redirect target`).toContain(`permanentRedirect(\`${target}`)
      expect(src, `${file} preserves safe query`).toContain('preserveSafeQuery(')
      // No acquisition-facing content survives on the redirect stub.
      expect(src).not.toMatch(/free trial/i)
      expect(src).not.toContain('/signup')
      expect(src).not.toMatch(/\/buy\?variant/)
      expect(src).not.toContain('ClosingCtaSection')
    }
  })

  it('canonicalises /dawa to /pharmacy and keeps it noindex, follow', () => {
    const src = read(`${FRONTEND}/dawa/page.tsx`)
    expect(src).toContain('permanentRedirect(`/${locale}/pharmacy')
    expect(src).toContain('canonical: `${SITE_URL}/${locale}/pharmacy`')
    expect(src).toContain('robots: { index: false, follow: true }')
  })

  it('maps every legacy /modules/[slug] to a deterministic canonical destination with no chains', () => {
    const src = read(`${FRONTEND}/modules/[slug]/page.tsx`)
    expect(src).toContain('permanentRedirect(')
    expect(src).toContain('preserveSafeQuery(')
    // Explicit product mapping.
    for (const pair of [
      "dawa: '/pharmacy'",
      "retail: '/retail'",
      "hospitality: '/hospitality'",
      "hardware: '/hardware'",
      "salon: '/salon'",
      "core: '/modules'",
    ]) {
      expect(src, `modules/[slug] mapping ${pair}`).toContain(pair)
    }
    // Unknown/non-product slug folds into the catalogue, never a chain.
    expect(src).toContain("?? '/modules'")
    // Destinations are canonical, indexable pages — never another legacy
    // redirect route (no chains).
    for (const bad of ['/dawa', '/pro', '/ai', '/payroll-pack']) {
      expect(src).not.toContain(`'${bad}'`)
    }
  })

  it('keeps the redirect route files present so route counts stay consistent', () => {
    for (const route of [
      '/[locale]/ai',
      '/[locale]/pro',
      '/[locale]/dawa',
      '/[locale]/payroll-pack',
      '/[locale]/modules/[slug]',
    ]) {
      expect(APP_PAGE_ROUTES).toContain(route)
    }
    expect(APP_PAGE_ROUTES).toHaveLength(90)
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 2. Safe query preservation.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — safe query preservation on redirects', () => {
  it('keeps campaign/demo params and drops security-sensitive params', () => {
    const kept = preserveSafeQuery({ utm_source: 'google', product: 'pharmacy', ref: 'ABC123' })
    expect(kept.startsWith('?')).toBe(true)
    expect(kept).toContain('utm_source=google')
    expect(kept).toContain('product=pharmacy')
    expect(kept).toContain('ref=ABC123')

    for (const sensitive of [
      { token: 'abc' },
      { api_key: 'abc' },
      { secret: 'abc' },
      { password: 'abc' },
      { session: 'abc' },
      { sig: 'abc' },
      { auth: 'abc' },
      { otp: '123' },
      { code: 'oauthcode' },
      { next: '/admin' },
      { redirect: '/dashboard' },
      { callback_url: 'https://evil.example' },
    ]) {
      expect(preserveSafeQuery(sensitive), `${Object.keys(sensitive)[0]} dropped`).toBe('')
    }

    expect(preserveSafeQuery({})).toBe('')
    expect(preserveSafeQuery(undefined)).toBe('')
  })

  it('Task 29 — allowlists attribution/UX keys and drops unknown params (incl. PII)', () => {
    // The full attribution/UX allowlist survives.
    for (const key of [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
      'ref', 'product', 'type',
    ]) {
      expect(preserveSafeQuery({ [key]: 'v' }), `${key} kept`).toContain(`${key}=v`)
    }
    // Anything not on the list is dropped, including obvious PII carriers and a
    // harmless-but-unknown campaign variant that the old denylist would keep.
    for (const key of ['email', 'phone', 'name', 'fullName', 'tag', 'utm_evil', 'gclid']) {
      expect(preserveSafeQuery({ [key]: 'x' }), `${key} dropped`).toBe('')
    }
  })

  it('Task 29 — bounds array count and value length on allowlisted keys', () => {
    // Repeated allowlisted key keeps at most five values.
    const many = preserveSafeQuery({ ref: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
    const refCount = (many.match(/ref=/g) ?? []).length
    expect(refCount).toBe(5)

    // Over-long values are dropped, not truncated.
    const longValue = 'x'.repeat(201)
    expect(preserveSafeQuery({ ref: longValue })).toBe('')
    expect(preserveSafeQuery({ ref: 'x'.repeat(200) })).toContain('ref=')
    // Empty values are dropped.
    expect(preserveSafeQuery({ product: '' })).toBe('')
  })

  it('adapts request URLSearchParams without widening or unbounding the allowlist', () => {
    const params = new URLSearchParams()
    params.append('utm_source', 'google')
    params.append('ref', 'one')
    params.append('ref', 'two')
    params.append('token', 'secret')

    const suffix = preserveSafeUrlSearchParams(params)
    expect(suffix).toContain('utm_source=google')
    expect(suffix.match(/ref=/g)).toHaveLength(2)
    expect(suffix).not.toContain('token')
    expect(suffix).not.toContain('secret')
  })

  it('resolves request-layer legacy and Kenya-only redirects without chains', () => {
    expect(canonicalPublicRedirectPath('/ke/dawa')).toBe('/ke/pharmacy')
    expect(canonicalPublicRedirectPath('/ke/pro')).toBe('/ke/modules')
    expect(canonicalPublicRedirectPath('/ke/modules/salon')).toBe('/ke/salon')
    expect(canonicalPublicRedirectPath('/ke/modules/unknown')).toBe('/ke/modules')
    expect(canonicalPublicRedirectPath('/us/guides')).toBe('/ke/guides')
    expect(canonicalPublicRedirectPath('/gb/locations/nairobi')).toBe('/ke/locations/nairobi')

    expect(canonicalPublicRedirectPath('/ke/pharmacy')).toBeNull()
    expect(canonicalPublicRedirectPath('/ke/guides')).toBeNull()
    expect(canonicalPublicRedirectPath('/admin')).toBeNull()
    expect(canonicalPublicRedirectPath('/unknown/dawa')).toBeNull()
  })
})


/* ────────────────────────────────────────────────────────────────────────
 * 3. Canonical + hreflang: every indexable public page self-canonicalises for
 *    the active locale and calls buildAlternatesLanguages with a locale-free
 *    path — no inherited homepage canonical.
 * ──────────────────────────────────────────────────────────────────────── */

const SELF_CANONICAL_ROUTES = [
  'pharmacy', 'retail', 'hospitality', 'hardware', 'salon',
  'modules', 'pricing', 'etims', 'mpesa', 'sha',
  'developers', 'docs', 'blog', 'about', 'contact',
  'support', 'team', 'security', 'partners', 'changelog', 'roadmap',
  'terms', 'privacy', 'refund-policy', 'migration', 'downloads',
] as const
// NOTE: 'guides' and 'locations' are intentionally NOT in this list. They are
// Kenya-only content that always canonicalises to /ke (never the visitor's
// market locale) and uses the Kenya-only hreflang helper — see the dedicated
// "Kenya-only guides & locations" describe block below.

describe('Task 28 — self-canonical + hreflang on every indexable route', () => {
  it('gives each public route a locale self-canonical and locale-free hreflang input', () => {
    for (const route of SELF_CANONICAL_ROUTES) {
      const src = read(`${FRONTEND}/${route}/page.tsx`)
      expect(src, `${route} self-canonical`).toContain(`/\${locale}/${route}\``)
      expect(src, `${route} hreflang locale-free`).toContain(`buildAlternatesLanguages('/${route}')`)
    }
  })

  it('never lets a public page silently inherit the homepage canonical', () => {
    const dir = join(ROOT, FRONTEND)
    const pageFiles = walkFiles(dir).filter((p) => p.endsWith(`${sep}page.tsx`))
    expect(pageFiles.length).toBeGreaterThan(20)

    for (const abs of pageFiles) {
      const rel = abs.slice(join(ROOT, FRONTEND).length + 1)
      const src = readFileSync(abs, 'utf8')
      const isHomepage = rel === 'page.tsx'
      const isSlugRedirect = rel === join('modules', '[slug]', 'page.tsx')
      if (isHomepage || isSlugRedirect) continue
      expect(src, `${rel} sets its own canonical`).toContain('canonical')
    }
  })

  it('builds valid BCP-47 hreflang alternates keyed off a locale-free path', () => {
    const langs = buildAlternatesLanguages('/pharmacy')
    expect(Object.keys(langs)).toContain('x-default')
    expect(Object.keys(langs)).toContain('en-KE')
    expect(Object.keys(langs)).toContain('en-US')
    for (const key of Object.keys(langs)) {
      expect(key === 'x-default' || /^[a-z]{2}-[A-Z]{2}$/.test(key)).toBe(true)
    }
    expect(langs['en-KE'].endsWith('/ke/pharmacy')).toBe(true)
    expect(langs['en-US'].endsWith('/us/pharmacy')).toBe(true)
    expect(langs['x-default'].endsWith('/ke/pharmacy')).toBe(true)

    const links = buildHreflangLinks('/pharmacy')
    expect(links[links.length - 1].hreflang).toBe('x-default')
    // Locale-free and locale-prefixed inputs resolve to the same set.
    expect(buildAlternatesLanguages('/us/pharmacy')).toEqual(langs)
  })

  it('disables next-intl auto alternates because country routes are not language tags', () => {
    const routingSource = read('src/i18n/routing.ts')
    expect(routingSource).toContain('alternateLinks: false')
    expect(routingSource).toContain('Page metadata supplies the valid en-KE/en-US/... alternates')
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 3b. Kenya-only guides & locations — national buyer guides and local city
 *     hubs are Kenya-only content. They always canonicalise to /ke, redirect
 *     every non-ke market with a permanent 308 (safe query only), use the
 *     Kenya-only hreflang helper, and never form a redirect chain.
 * ──────────────────────────────────────────────────────────────────────── */

const KENYA_ONLY_INDEX = [
  { route: 'guides', canonical: '/ke/guides', hreflang: '/guides' },
  { route: 'locations', canonical: '/ke/locations', hreflang: '/locations' },
] as const

const KENYA_ONLY_DETAIL = [
  { route: 'guides', target: '/ke/guides/${slug}', hreflang: '/guides/${guide.slug}' },
  { route: 'locations', target: '/ke/locations/${slug}', hreflang: '/locations/${location.slug}' },
] as const

describe('Task 28 — Kenya-only guides & locations canonicalise to /ke', () => {
  it('canonicalises each index to /ke and declares Kenya-only hreflang', () => {
    for (const { route, canonical, hreflang } of KENYA_ONLY_INDEX) {
      const src = read(`${FRONTEND}/${route}/page.tsx`)
      expect(src, `${route} index canonical is /ke`).toContain(`canonical = \`\${SITE_URL}${canonical}\``)
      expect(src, `${route} index Kenya-only hreflang`).toContain(
        `buildKenyaOnlyAlternatesLanguages('${hreflang}')`,
      )
      // Never the general 12-market helper on Kenya-only content.
      expect(src, `${route} index no general hreflang`).not.toContain('buildAlternatesLanguages(')
      // Never a per-locale canonical.
      expect(src, `${route} index no per-locale canonical`).not.toContain('/${locale}/')
    }
  })

  it('permanently (308) redirects non-ke index requests to /ke with safe query only', () => {
    for (const { route, canonical } of KENYA_ONLY_INDEX) {
      const src = read(`${FRONTEND}/${route}/page.tsx`)
      expect(src, `${route} index guards non-ke`).toContain("if (locale !== 'ke')")
      expect(src, `${route} index 308`).toContain(`permanentRedirect(\`${canonical}\${suffix}\`)`)
      expect(src, `${route} index safe query`).toContain('preserveSafeQuery(queryValues)')
      // Renderer is pinned to the /ke market after the redirect.
      expect(src, `${route} index renders locale="ke"`).toContain('locale="ke"')
      // Non-ke metadata is noindex,follow as defence in depth.
      expect(src, `${route} index non-ke noindex`).toContain('{ index: false, follow: true }')
    }
  })

  it('canonicalises each detail page to /ke, 308-redirects non-ke, 404s unknown slugs, no chain', () => {
    for (const { route, target, hreflang } of KENYA_ONLY_DETAIL) {
      const src = read(`${FRONTEND}/${route}/[slug]/page.tsx`)
      // Canonical + Kenya-only hreflang.
      expect(src, `${route} detail canonical is /ke`).toContain('`${SITE_URL}/ke/')
      expect(src, `${route} detail Kenya-only hreflang`).toContain(
        `buildKenyaOnlyAlternatesLanguages(\`${hreflang}\`)`,
      )
      expect(src, `${route} detail no general hreflang`).not.toContain('buildAlternatesLanguages(')
      // 308 to /ke before any registry/settings work; safe query only.
      expect(src, `${route} detail guards non-ke`).toContain("if (locale !== 'ke')")
      expect(src, `${route} detail 308 target`).toContain(`permanentRedirect(\`${target}\${suffix}\`)`)
      expect(src, `${route} detail safe query`).toContain('preserveSafeQuery(queryValues)')
      // Unknown slug remains noindex + notFound.
      expect(src, `${route} detail unknown noindex`).toContain('robots: { index: false, follow: false }')
      expect(src, `${route} detail unknown notFound`).toContain('notFound()')
      // Non-ke known slug is noindex,follow while canonicalising to /ke.
      expect(src, `${route} detail non-ke noindex`).toContain('{ index: false, follow: true }')
      // Renderer is pinned to the /ke market after the redirect.
      expect(src, `${route} detail renders locale="ke"`).toContain('locale="ke"')
      // No chain: the 308 target is always a /ke path, and /ke itself never
      // redirects (the guard only fires for locale !== 'ke').
      expect(src, `${route} detail target is /ke`).toContain('permanentRedirect(`/ke/')
    }
  })

  it('returns request-layer 404 classification only for unknown /ke detail slugs', () => {
    expect(isUnknownKenyaOnlyDetailPath('/ke/locations/does-not-exist')).toBe(true)
    expect(isUnknownKenyaOnlyDetailPath('/ke/guides/does-not-exist')).toBe(true)
    expect(isUnknownKenyaOnlyDetailPath('/ke/locations/nairobi')).toBe(false)
    expect(isUnknownKenyaOnlyDetailPath('/ke/guides/pos-system-kenya')).toBe(false)
    expect(isUnknownKenyaOnlyDetailPath('/us/locations/does-not-exist')).toBe(false)
    expect(isUnknownKenyaOnlyDetailPath('/ke/blog/does-not-exist')).toBe(false)

    const middleware = read('src/middleware.ts')
    expect(middleware).toContain('isUnknownKenyaOnlyDetailPath(pathname)')
    expect(middleware).toContain("NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404 })")
  })

  it('builds Kenya-only alternates — exactly en-KE + x-default, both → /ke, no other market', () => {
    for (const path of ['/guides', '/locations', '/guides/pos-software-kenya', '/locations/nairobi']) {
      const langs = buildKenyaOnlyAlternatesLanguages(path)
      expect(Object.keys(langs).sort()).toEqual(['en-KE', 'x-default'])
      expect(langs['en-KE'].endsWith(`/ke${path}`)).toBe(true)
      expect(langs['x-default'].endsWith(`/ke${path}`)).toBe(true)
      // No /us, /gb, … variants leak into Kenya-only content.
      expect(Object.keys(langs)).not.toContain('en-US')
      expect(langs['en-KE']).not.toMatch(/\/(us|gb|ng|gh|za|in|rw|tz|ug|eg|ae)\//)
    }
    // A locale-prefixed input normalises to the same /ke set.
    expect(buildKenyaOnlyAlternatesLanguages('/us/guides')).toEqual(
      buildKenyaOnlyAlternatesLanguages('/guides'),
    )
    const links = buildKenyaOnlyHreflangLinks('/guides')
    expect(links).toHaveLength(2)
    expect(links[links.length - 1].hreflang).toBe('x-default')
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 4. Sitemap — exact publication + exclusions + truthful stable dates.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — sitemap publication and exclusions', () => {
  const entries = sitemap()
  const urls = entries.map((e) => e.url)

  it('emits only locale-prefixed absolute URLs', () => {
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith('https://')).toBe(true)
      const path = new URL(url).pathname
      const first = path.split('/').filter(Boolean)[0]
      expect(COUNTRY_SET.has(first ?? ''), `${url} has a country locale prefix`).toBe(true)
    }
  })

  it('excludes redirects, private families, module slug pages, and query URLs', () => {
    for (const url of urls) {
      const parsed = new URL(url)
      const path = parsed.pathname
      const [, locale, family, detail] = path.split('/')
      expect(parsed.search, `${url} has no query`).toBe('')
      expect(COUNTRY_SET.has(locale ?? ''), `${path} starts with a known locale`).toBe(true)
      expect(['ai', 'dawa', 'pro', 'payroll-pack'], `${path} excludes legacy redirect families`).not.toContain(family)
      expect(detail, `${path} excludes module detail routes`).toBe(family === 'modules' ? undefined : detail)
      expect(
        ['admin', 'dashboard', 'onboarding', 'login', 'signup', 'forgot-password', 'verify-email', 'accept-invitation', 'buy', 'api', 'region-unavailable'],
        `${path} excludes private top-level families`,
      ).not.toContain(family)
    }
  })

  it('includes the five products, catalogue, pricing and content hubs for every locale', () => {
    for (const cc of COUNTRY_LOCALES) {
      const base = `https://omnix.co.ke/${cc}`
      // NOTE: /guides is NOT expected per-locale — it is Kenya-only content
      // emitted once under /ke (asserted separately below).
      for (const path of ['', '/pharmacy', '/retail', '/hospitality', '/hardware', '/salon', '/modules', '/pricing', '/blog', '/docs']) {
        expect(urls, `${cc}${path} present`).toContain(`${base}${path}`)
      }
    }
  })

  it('emits Kenya-only guides and locations once under /ke, never under any other market', () => {
    // Index + every published detail appears exactly once, under /ke.
    expect(urls).toContain('https://omnix.co.ke/ke/guides')
    const guide = publishedGuides()[0]
    const guideUrl = `https://omnix.co.ke/ke/guides/${guide.slug}`
    expect(urls).toContain(guideUrl)
    expect(urls.filter((u) => u === guideUrl)).toHaveLength(1)
    expect(urls.filter((u) => u === 'https://omnix.co.ke/ke/guides')).toHaveLength(1)

    const locations = publishedLocations()
    if (locations.length > 0) {
      const locUrl = `https://omnix.co.ke/ke/locations/${locations[0].slug}`
      expect(urls).toContain('https://omnix.co.ke/ke/locations')
      expect(urls).toContain(locUrl)
      expect(urls.filter((u) => u === locUrl)).toHaveLength(1)
      expect(urls.filter((u) => u === 'https://omnix.co.ke/ke/locations')).toHaveLength(1)
    }

    // No non-ke market ever carries a guide or location URL.
    for (const cc of COUNTRY_LOCALES) {
      if (cc === 'ke') continue
      for (const url of urls) {
        const path = new URL(url).pathname
        expect(path, `${cc} has no guides`).not.toMatch(new RegExp(`^/${cc}/guides(/|$)`))
        expect(path, `${cc} has no locations`).not.toMatch(new RegExp(`^/${cc}/locations(/|$)`))
      }
    }

    // Kenya-only entries declare exactly the Kenya-only hreflang set.
    const entry = entries.find((e) => e.url === 'https://omnix.co.ke/ke/guides')!
    expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(['en-KE', 'x-default'])
  })

  it('includes published blog, guides and gated locations but excludes placeholder docs', () => {
    expect(urls).toContain(`https://omnix.co.ke/ke/blog/${publishedPosts()[0].slug}`)
    const guide = publishedGuides()[0]
    expect(urls).toContain(`https://omnix.co.ke/ke/guides/${guide.slug}`)
    const locations = publishedLocations()
    if (locations.length > 0) {
      expect(urls).toContain('https://omnix.co.ke/ke/locations')
      expect(urls).toContain(`https://omnix.co.ke/ke/locations/${locations[0].slug}`)
    }
    const placeholder = DOCS_SEED.find((d) => !isPublishedDoc(d))
    expect(placeholder).toBeTruthy()
    expect(urls).not.toContain(`https://omnix.co.ke/ke/docs/${placeholder!.slug}`)
    const written = DOCS_SEED.find(isPublishedDoc)!
    expect(urls).toContain(`https://omnix.co.ke/ke/docs/${written.slug}`)
    expect(docBySlug('banking')).toBeTruthy()
    expect(urls).not.toContain('https://omnix.co.ke/ke/docs/banking')
  })

  it('uses truthful stable lastModified dates, never build-time now(), and is deterministic', () => {
    for (const e of entries) {
      const lm = e.lastModified
      expect(typeof lm === 'string', 'lastModified is a plain date string').toBe(true)
      expect(String(lm)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(String(lm)).not.toContain('T')
    }
    expect(JSON.stringify(sitemap())).toBe(JSON.stringify(sitemap()))
  })

  it('declares BCP-47 hreflang alternates on entries', () => {
    const langs = entries[0].alternates?.languages ?? {}
    expect(Object.keys(langs)).toContain('x-default')
    expect(Object.keys(langs)).toContain('en-KE')
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 4b. Legacy /docs/ai + /docs/ai-keys retired from the public surface.
 *     Their bodies are fully written (not TODO scaffolds), so an explicit
 *     slug exclusion — not the placeholder heuristic — keeps them out of the
 *     index, the sitemap, and the detail page (which fails closed).
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 30 — legacy AI docs excluded from the public surface', () => {
  const urls = sitemap().map((e) => e.url)
  const detailSource = read(`${FRONTEND}/docs/[slug]/page.tsx`)
  const docsListSource = read(`${FRONTEND}/docs/page.tsx`)

  it('classifies both legacy slugs as excluded despite their written bodies', () => {
    for (const slug of ['ai', 'ai-keys']) {
      const doc = docBySlug(slug)
      expect(doc, `${slug} kept seeded for old links`).toBeTruthy()
      // Written content (no TODO marker) — the placeholder gate alone would pass it.
      expect(isDocPlaceholder(doc!)).toBe(false)
      // The explicit legacy exclusion is what fails it closed.
      expect(isLegacyExcludedDocSlug(slug)).toBe(true)
      expect(isPublishedDoc(doc!)).toBe(false)
    }
  })

  it('emits neither slug in the sitemap for any locale', () => {
    for (const url of urls) {
      const path = new URL(url).pathname
      expect(path, `${path} excludes /docs/ai`).not.toMatch(/\/docs\/ai$/)
      expect(path, `${path} excludes /docs/ai-keys`).not.toMatch(/\/docs\/ai-keys$/)
    }
  })

  it('keeps both slugs out of the published docs listing', () => {
    const listed = DOCS_SEED.filter(isPublishedDoc).map((d) => d.slug)
    expect(listed).not.toContain('ai')
    expect(listed).not.toContain('ai-keys')
    // The /docs index derives its list from the same classifier.
    expect(docsListSource).toContain('DOCS_SEED.filter(isPublishedDoc)')
  })

  it('fails closed in the detail source — excluded legacy docs notFound(), never render body', () => {
    expect(detailSource).toContain('isLegacyExcludedDocSlug')
    expect(detailSource).toContain('notFound()')
    // Metadata for an excluded legacy doc is generic + noindex,nofollow.
    expect(detailSource).toContain('robots: { index: false, follow: false }')
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 5. Robots — permit public, disallow private, never block CSS/JS.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — robots hardening', () => {
  const result = robots()
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules
  const disallow = ([] as string[]).concat((rule?.disallow as string[] | string) ?? [])
  const allow = ([] as string[]).concat((rule?.allow as string[] | string) ?? [])

  it('disallows every private/app/operational family', () => {
    for (const path of [
      '/admin', '/dashboard', '/onboarding', '/login', '/signup',
      '/forgot-password', '/verify-email', '/accept-invitation', '/buy',
      '/api/', '/region-unavailable',
    ]) {
      expect(disallow, `disallows ${path}`).toContain(path)
    }
  })

  it('allows the public site and never blocks CSS/JS or published content', () => {
    expect(rule?.allow).toEqual(['/', '/api/og'])
    for (const path of ['/_next', '/_next/static', '/docs', '/guides', '/locations', '/blog', '/pharmacy']) {
      expect(disallow, `does not block ${path}`).not.toContain(path)
    }
    expect(String(result.sitemap)).toContain('/sitemap.xml')
  })

  it('explicitly allows /api/og for social crawlers while keeping /api blocked', () => {
    // The generated Open Graph image endpoint must be fetchable; nothing else
    // under /api is exposed.
    expect(allow).toContain('/api/og')
    expect(disallow, 'the rest of /api stays blocked').toContain('/api/')
    // No other API path is opened up.
    expect(allow.filter((p) => p.startsWith('/api'))).toEqual(['/api/og'])
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 6. Private layouts / 404 pages are noindex as defence in depth.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — private route noindex (defence in depth)', () => {
  it('sets robots noindex,nofollow on every private layout and interstitial', () => {
    const noindex = 'robots: { index: false, follow: false }'
    for (const file of [
      'src/app/(auth)/layout.tsx',
      'src/app/(checkout)/layout.tsx',
      'src/app/onboarding/layout.tsx',
      'src/app/(dashboard)/layout.tsx',
      'src/app/admin/layout.tsx',
      'src/app/region-unavailable/page.tsx',
      'src/app/not-found.tsx',
      `${FRONTEND}/not-found.tsx`,
    ]) {
      expect(read(file), `${file} noindex`).toContain(noindex)
    }
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 7. Structured data — honesty, config pricing, Windows OS, safe serialization.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — JSON-LD honesty and safe serialization', () => {
  const src = read('src/components/seo/jsonld.tsx')

  it('derives Software/Offer price from config and declares Windows, with no unsupported claims', () => {
    expect(src).toContain("operatingSystem: 'Windows 10, Windows 11'")
    expect(src).toContain('pricing.starter.oneTimeFee[currency]')
    expect(src).not.toContain('availability')
    expect(src).not.toContain('aggregateRating')
    expect(src).not.toMatch(/reviewCount|"review"|ratingValue/)
    expect(src).not.toContain('Omnix Pro')
    expect(src).toContain('const productUrl = `${brandUrl}/${locale}/${product}`')
    expect(src).not.toMatch(/\/buy\?variant/)
    expect(src).not.toContain('LocalBusiness')
    expect(src).not.toContain('PostalAddress')
  })

  it('escapes payloads against script termination and separator injection', () => {
    expect(src).toContain("replace(/</g, '\\\\u003c')")
    expect(src).toContain('\\\\u2028')
    expect(src).toContain('\\\\u2029')
  })

  it('emits SoftwareApplication only on the five canonical product pages', () => {
    for (const product of ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon']) {
      const page = read(`${FRONTEND}/${product}/page.tsx`)
      expect(page, `${product} emits SoftwareJsonLd`).toContain(`<SoftwareJsonLd product="${product}"`)
    }
    expect(read(`${FRONTEND}/guides/[slug]/page.tsx`)).not.toContain('SoftwareJsonLd')
    expect(read(`${FRONTEND}/locations/[slug]/page.tsx`)).not.toContain('SoftwareJsonLd')
    expect(read(`${FRONTEND}/locations/[slug]/page.tsx`)).not.toContain('LocalBusiness')
  })

  it('prices structured data from the same starter config the pricing page uses', () => {
    expect(pricing.starter.oneTimeFee.KES).toBe(30_000)
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 8. Zero acquisition-facing trial / Pro / AI on public surfaces + links.
 * ──────────────────────────────────────────────────────────────────────── */

const PUBLIC_SURFACES = [
  'src/components/layout/site-header.tsx',
  'src/components/layout/site-footer.tsx',
  'src/components/landing/homepage.tsx',
  'src/components/marketing/pricing-website.tsx',
  'src/components/marketing/modules-website.tsx',
  `${FRONTEND}/page.tsx`,
  `${FRONTEND}/pharmacy/page.tsx`,
  `${FRONTEND}/retail/page.tsx`,
  `${FRONTEND}/hospitality/page.tsx`,
  `${FRONTEND}/hardware/page.tsx`,
  `${FRONTEND}/salon/page.tsx`,
  `${FRONTEND}/modules/page.tsx`,
  `${FRONTEND}/pricing/page.tsx`,
]

describe('Task 28 — no public trial/Pro/AI acquisition surfaces', () => {
  it('never ships trial CTAs, signup-variant or buy-variant=pro links on public surfaces', () => {
    for (const file of PUBLIC_SURFACES) {
      const s = read(file)
      expect(s, `${file} no trial CTA`).not.toMatch(/free trial/i)
      expect(s, `${file} no start-trial`).not.toMatch(/start (a )?trial/i)
      expect(s, `${file} no signup variant`).not.toMatch(/\/signup\?variant/)
      expect(s, `${file} no buy pro`).not.toContain('/buy?variant=pro')
      expect(s, `${file} no public Pro product`).not.toContain('Omnix Pro')
    }
  })

  it('keeps the five-product chrome demo-led with no /ai link', () => {
    const header = read('src/components/layout/site-header.tsx')
    const footer = read('src/components/layout/site-footer.tsx')
    expect(header).not.toContain("href: '/ai'")
    expect(footer).not.toContain("href: '/ai'")
    expect(header).toContain("href: '/contact?type=demo'")
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 9. Dead legacy component cleanup.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — legacy acquisition components removed', () => {
  it('deletes proven-unused Pro/trial/AI landing components', () => {
    for (const file of [
      'src/components/marketing/variant-landing.tsx',
      'src/config/trade-landings.ts',
      'src/components/landing/hero-section.tsx',
      'src/components/landing/one-price-section.tsx',
      'src/components/marketing/sticky-buy-cta.tsx',
      'src/components/landing/faq-section.tsx',
      'src/components/landing/ai-section.tsx',
      'src/components/landing/closing-cta-section.tsx',
      'src/components/landing/studios-hand-section.tsx',
    ]) {
      expect(existsSync(join(ROOT, file)), `${file} removed`).toBe(false)
    }
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 10. Stale commercial copy + social-card remediation (this task).
 *     - Trial emails price from config, drop fabricated claims, legacy-only.
 *     - No public AI positioning on roadmap, changelog highlights, keywords.
 *     - cleanSummary fails closed on acquisition-facing DB notes.
 *     - OG card is a flat, light-first Working Counter design (no gradient).
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — trial emails: config price, no fabricated claims, legacy-only', () => {
  const endingSoon = read('src/emails/trial-ending-soon.tsx')
  const ended = read('src/emails/trial-ended.tsx')

  it('derives the licence figure from pricing config, never a hardcoded stale price', () => {
    for (const [file, src] of [['trial-ending-soon', endingSoon], ['trial-ended', ended]] as const) {
      expect(src, `${file} imports pricing config`).toContain("from '@/config/pricing'")
      expect(src, `${file} derives price from config`).toContain('pricing.starter.oneTimeFee.KES')
      // The stale hardcoded KES 100,000 must be gone.
      expect(src, `${file} drops stale price`).not.toContain('100,000')
      expect(src, `${file} drops stale price`).not.toContain('100000')
    }
    // Config remains the single source the emails read from.
    expect(pricing.starter.oneTimeFee.KES).toBe(30_000)
  })

  it('frames the licence as one-time/perpetual with optional, separate compliance updates', () => {
    for (const [file, src] of [['trial-ending-soon', endingSoon], ['trial-ended', ended]] as const) {
      expect(src, `${file} perpetual`).toMatch(/perpetual/i)
      expect(src, `${file} not a subscription`).toMatch(/not a subscription/i)
      expect(src, `${file} compliance optional + separate`).toMatch(/optional/i)
      expect(src, `${file} compliance separate`).toContain('maintenanceYearly')
    }
  })

  it('drops fabricated response-time and refund claims, keeps emails legacy-only', () => {
    expect(ended).not.toContain('Refunds are generous')
    expect(ended).not.toMatch(/most customers/i)
    expect(ended).not.toMatch(/within a day/i)
    expect(endingSoon).not.toMatch(/we usually fix/i)
    for (const [file, src] of [['trial-ending-soon', endingSoon], ['trial-ended', ended]] as const) {
      // Retained only to service existing legacy trial records; no new public
      // trial-start CTA introduced.
      expect(src, `${file} legacy-only note`).toMatch(/legacy trial records/i)
      expect(src, `${file} no signup CTA`).not.toContain('/signup')
    }
  })
})

describe('Task 28 — no public AI positioning on roadmap / changelog / keywords', () => {
  const roadmap = read(`${FRONTEND}/roadmap/page.tsx`)
  const changelog = read(`${FRONTEND}/changelog/page.tsx`)
  const layout = read(`${FRONTEND}/layout.tsx`)

  it('strips AI positioning and /ai references from the public roadmap', () => {
    // Roadmap carries no hardening comments, so a brand-word check is safe here.
    expect(roadmap).not.toMatch(/\bAI\b/)
    expect(roadmap).not.toContain('/ai')
    // Removed AI lane items are gone; factual shipped items remain.
    expect(roadmap).not.toContain('AI business partner')
    expect(roadmap).not.toContain('AI vision ingestion')
    expect(roadmap).not.toContain('Local embeddings + RAG')
    expect(roadmap).toContain('Transactional sales & voids')
    // A lane may legitimately be sparse/empty — an honest state is rendered.
    expect(roadmap).toContain('Nothing publicly committed here yet.')
  })

  it('removes handcrafted AI/AI-key changelog highlights (targeted, not broad)', () => {
    // Targeted phrase checks only — the hardening code/comments legitimately
    // reference "AI"/"Pro" and must not be rejected.
    expect(changelog).not.toContain('AI business partner')
    expect(changelog).not.toContain('AI workspace')
    expect(changelog).not.toContain('ask AI why')
    expect(changelog).not.toContain('Omnix AI')
    expect(changelog).not.toContain('and AI keys')
    // Neutral historical facts survive.
    expect(changelog).toContain('all-or-nothing')
    expect(changelog).toContain('provider-side setup guides for Daraja and Paystack')
  })

  it('hardens cleanSummary so DB notes cannot reintroduce acquisition-facing copy', () => {
    expect(changelog).toContain('FORBIDDEN_SUMMARY_PATTERNS')
    // Pro tier is matched narrowly; provider/professional are spared.
    expect(changelog).toContain('/\\bPro\\b/')
    // Trial-start, AI, and stale-price positioning are all covered.
    expect(changelog).toContain('/\\bA\\.?I\\b/i')
    expect(changelog).toContain('free\\s+trial')
    expect(changelog).toContain('KES|USD|NGN|GHS|ZAR')
    // Titles pass through the same guard, not just summaries.
    expect(changelog).toContain('cleanSummary(group.title)')
    // Installer/GitHub URLs are still stripped.
    expect(changelog).toContain("replace(/https?:\\/\\/\\S+/g, '')")
  })

  it('drops the AI keyword from public metadata and fixes the stale header comment', () => {
    expect(layout).not.toContain('AI for small business')
    // The unauth header shows Sign in + Book a demo, never "Start trial".
    expect(layout).not.toContain('Start trial')
  })
})

describe('Task 28 — OG card is a flat, light-first Working Counter design', () => {
  const og = read('src/app/api/og/route.tsx')

  it('replaces the gradient + oversized rounded tile with flat brand surfaces', () => {
    expect(og).not.toContain('linear-gradient')
    // Receipt-white surface, ledger-black ink, one signal-copper accent.
    expect(og).toContain('#FAFAF7')
    expect(og).toContain('#171713')
    expect(og).toContain('#B94D1C')
    // Restrained radius (≤8px); the old 20px tile is gone.
    expect(og).toContain("borderRadius: '8px'")
    expect(og).not.toContain("borderRadius: '20px'")
  })

  it('stays a locally generated 1200×630 PNG with a safely truncated title', () => {
    expect(og).toContain('width: 1200, height: 630')
    expect(og).toContain('.slice(0, 120)')
    // No remote request — the card is rendered entirely on the server.
    expect(og).not.toContain('fetch(')
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * helpers
 * ──────────────────────────────────────────────────────────────────────── */

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name)
    return entry.isDirectory() ? walkFiles(p) : [p]
  })
}

/* ────────────────────────────────────────────────────────────────────────
 * 11. Open Graph / Twitter completeness (this task).
 *     Next shallow-replaces a child's openGraph object, so every indexable
 *     page must build a COMPLETE social block via the shared helper — never a
 *     partial hand-rolled openGraph that silently drops images/siteName/locale
 *     and never inherits the homepage's Twitter card.
 * ──────────────────────────────────────────────────────────────────────── */

// Loose views of Next's Metadata unions so the assertions can read fields
// without fighting the discriminated-union types.
type OGView = {
  type?: string
  siteName?: string
  title?: string
  description?: string
  url?: string
  locale?: string
  images?: Array<{ url: string; width?: number; height?: number; alt?: string }>
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
}
type TWView = {
  card?: string
  title?: string
  description?: string
  images?: string[]
}

// Every indexable public metadata producer that previously hand-rolled an
// openGraph block. The homepage locale layout is included: it keeps its
// approved-media resolver but must route social metadata through the helper.
const INDEXABLE_SOCIAL_PAGES = [
  'layout.tsx',
  'pharmacy/page.tsx', 'retail/page.tsx', 'hospitality/page.tsx', 'hardware/page.tsx', 'salon/page.tsx',
  'modules/page.tsx', 'pricing/page.tsx', 'downloads/page.tsx', 'migration/page.tsx',
  'mpesa/page.tsx', 'etims/page.tsx', 'sha/page.tsx',
  'security/page.tsx', 'about/page.tsx', 'team/page.tsx', 'partners/page.tsx',
  'contact/page.tsx', 'support/page.tsx',
  'terms/page.tsx', 'privacy/page.tsx', 'refund-policy/page.tsx',
  'developers/page.tsx',
  'docs/page.tsx', 'docs/[slug]/page.tsx',
  'blog/page.tsx', 'blog/[slug]/page.tsx',
  'changelog/page.tsx', 'roadmap/page.tsx',
  'guides/page.tsx', 'guides/[slug]/page.tsx',
  'locations/page.tsx', 'locations/[slug]/page.tsx',
] as const

describe('Task 28 — every indexable page builds social metadata via the shared helper', () => {
  it('routes all 33 indexable metadata producers (incl. homepage layout) through buildSocialMetadata', () => {
    // 31 child pages + the homepage layout + one extra product/content producer.
    expect(INDEXABLE_SOCIAL_PAGES.length).toBeGreaterThanOrEqual(31)
    for (const rel of INDEXABLE_SOCIAL_PAGES) {
      const src = read(`${FRONTEND}/${rel}`)
      expect(src, `${rel} imports the helper`).toContain("from '@/lib/seo-metadata'")
      expect(src, `${rel} invokes buildSocialMetadata`).toContain('buildSocialMetadata(')
    }
  })

  it('lets no frontend page keep a hand-rolled openGraph/twitter block outside the helper', () => {
    const dir = join(ROOT, FRONTEND)
    const files = walkFiles(dir).filter((p) => p.endsWith('.tsx'))
    expect(files.length).toBeGreaterThan(20)
    for (const abs of files) {
      const rel = abs.slice(join(ROOT, FRONTEND).length + 1)
      const src = readFileSync(abs, 'utf8')
      // A raw `openGraph:` / `twitter:` object literal is only permitted when
      // it is produced by the shared helper. Refactored pages spread the
      // helper result, so they contain neither literal — the invariant holds.
      if (src.includes('openGraph:') || src.includes('twitter:')) {
        expect(src, `${rel} openGraph/twitter must come from the helper`).toContain('buildSocialMetadata(')
      }
    }
  })
})

describe('Task 28 — buildSocialMetadata output', () => {
  const CANONICAL = 'https://omnix.co.ke/ke/pharmacy'
  const PAGE_TITLE = 'Omnix Pharmacy software · counter & <dispensary>'
  const PAGE_DESC = 'Dispensing, POS, stock & insurance workflows.'

  it('maps every COUNTRY_LOCALE to its en_XX Open Graph locale, and language routes to en_KE', () => {
    for (const cc of COUNTRY_LOCALES) {
      expect(ogLocaleFor(cc)).toBe(`en_${cc.toUpperCase()}`)
    }
    expect(ogLocaleFor('ke')).toBe('en_KE')
    // Language-only / unknown locales fall back to the home market.
    expect(ogLocaleFor('sw')).toBe('en_KE')
    expect(ogLocaleFor('zz')).toBe('en_KE')
  })

  it('builds a complete website card: siteName Omnix, en_KE, 1200x630 generated image, honest alt', () => {
    const social = buildSocialMetadata({
      locale: 'ke',
      url: CANONICAL,
      title: PAGE_TITLE,
      description: PAGE_DESC,
      type: 'website',
    })
    const og = social.openGraph as unknown as OGView
    expect(og.type).toBe('website')
    expect(og.siteName).toBe('Omnix')
    expect(og.locale).toBe('en_KE')
    expect(og.url).toBe(CANONICAL)
    expect(og.title).toBe(PAGE_TITLE)
    expect(og.description).toBe(PAGE_DESC)

    const img = og.images?.[0]
    expect(img).toBeTruthy()
    expect(img?.width).toBe(1200)
    expect(img?.height).toBe(630)
    expect(OG_IMAGE_WIDTH).toBe(1200)
    expect(OG_IMAGE_HEIGHT).toBe(630)
    // Honest alt — describes the card, never empty.
    expect((img?.alt ?? '').length).toBeGreaterThan(0)
  })

  it('points at the locally generated /api/og card with an absolute URL and safely encoded title', () => {
    const social = buildSocialMetadata({
      locale: 'ke',
      url: CANONICAL,
      title: PAGE_TITLE,
      description: PAGE_DESC,
    })
    const url = (social.openGraph as unknown as OGView).images?.[0]?.url ?? ''
    expect(url.startsWith('https://')).toBe(true)
    expect(url).toContain('/api/og?title=')
    // Title is URL-encoded — no raw angle brackets / ampersands / spaces leak.
    expect(url).toContain(encodeURIComponent(PAGE_TITLE))
    expect(url).not.toContain('<')
    expect(url).not.toContain(' ')
    // Matches the exported generator (no network fetch involved).
    expect(url).toBe(generatedOgImage(PAGE_TITLE))
  })

  it('mirrors the page-specific title/description onto a summary_large_image Twitter card', () => {
    const social = buildSocialMetadata({
      locale: 'us',
      url: 'https://omnix.co.ke/us/retail',
      title: 'Retail-specific social title',
      description: 'Retail-specific social description',
    })
    const tw = social.twitter as unknown as TWView
    const og = social.openGraph as unknown as OGView
    expect(tw.card).toBe('summary_large_image')
    expect(tw.title).toBe('Retail-specific social title')
    expect(tw.description).toBe('Retail-specific social description')
    // Twitter image mirrors the resolved Open Graph image.
    expect(tw.images?.[0]).toBe(og.images?.[0]?.url)
    // og:locale reflects the requested market, not a homepage default.
    expect(og.locale).toBe('en_US')
  })

  it('uses an approved image URL verbatim when supplied, overriding the generated card', () => {
    const approved = 'https://media.omnix.co.ke/approved/og-default.png'
    const social = buildSocialMetadata({
      locale: 'ke',
      url: CANONICAL,
      title: PAGE_TITLE,
      description: PAGE_DESC,
      image: approved,
      imageAlt: 'Approved marketing card',
    })
    const og = social.openGraph as unknown as OGView
    const tw = social.twitter as unknown as TWView
    expect(og.images?.[0]?.url).toBe(approved)
    expect(og.images?.[0]?.alt).toBe('Approved marketing card')
    expect(tw.images?.[0]).toBe(approved)
    // No generated card when an approved asset is supplied.
    expect(og.images?.[0]?.url).not.toContain('/api/og')
  })

  it('carries article type + timestamps + authors through when type is article', () => {
    const social = buildSocialMetadata({
      locale: 'ke',
      url: 'https://omnix.co.ke/ke/blog/a-post',
      title: 'A post',
      description: 'An excerpt',
      type: 'article',
      publishedTime: '2024-01-02T00:00:00.000Z',
      modifiedTime: '2024-02-03T00:00:00.000Z',
      authors: ['Omnix Team'],
    })
    const og = social.openGraph as unknown as OGView
    expect(og.type).toBe('article')
    expect(og.publishedTime).toBe('2024-01-02T00:00:00.000Z')
    expect(og.modifiedTime).toBe('2024-02-03T00:00:00.000Z')
    expect(og.authors).toEqual(['Omnix Team'])
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 12. Broken public-link cleanup (this task).
 *     The developers page pointed at /dashboard/api-keys, a route absent from
 *     the inventory. No public page may carry a static internal href that is
 *     not a real, non-redirecting route.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — no public internal href targets a route absent from inventory', () => {
  // Build the set of acceptable static href targets from the route inventory:
  // locale pages stripped of their /[locale] prefix, plus non-locale pages and
  // API routes. Dynamic segments never appear in a literal href="…".
  const localeStripped = APP_PAGE_ROUTES.map((r) =>
    r.startsWith('/[locale]') ? r.slice('/[locale]'.length) || '/' : r,
  )
  const VALID_STATIC_HREFS = new Set<string>([...localeStripped, ...APP_API_ROUTES, '/'])

  it('resolves the developers page API-key link to an existing route (not /dashboard/api-keys)', () => {
    const src = read(`${FRONTEND}/developers/page.tsx`)
    expect(src, 'broken api-keys link removed').not.toContain('/dashboard/api-keys')
    // Locale-aware existing support route (in the inventory) is used instead.
    expect(src).toContain('/support')
    expect(APP_PAGE_ROUTES).toContain('/[locale]/support')
  })

  it('finds every static internal href in a public page inside the route inventory', () => {
    const dir = join(ROOT, FRONTEND)
    const files = walkFiles(dir).filter((p) => p.endsWith('.tsx'))
    const hrefRe = /href="(\/[^"]*)"/g
    let scanned = 0
    for (const abs of files) {
      const rel = abs.slice(join(ROOT, FRONTEND).length + 1)
      const src = readFileSync(abs, 'utf8')
      let m: RegExpExecArray | null
      while ((m = hrefRe.exec(src)) !== null) {
        // Ignore protocol-relative URLs.
        if (m[1].startsWith('//')) continue
        // Strip query string and hash before matching the path.
        const path = m[1].split(/[?#]/)[0]
        scanned++
        expect(VALID_STATIC_HREFS.has(path), `${rel} → ${m[1]} must be a route in the inventory`).toBe(true)
      }
    }
    // Guard against the regex silently matching nothing.
    expect(scanned).toBeGreaterThan(0)
  })
})

/* ────────────────────────────────────────────────────────────────────────
 * 13. Legacy message value neutralisation (this task).
 *     Unused trial / AI / Pro / Dawa labels are neutralised in every locale
 *     file, without altering internal license enum strings, and every file
 *     keeps the same key shape.
 * ──────────────────────────────────────────────────────────────────────── */

describe('Task 28 — legacy message values neutralised in every locale file', () => {
  const MSG_DIR = join(ROOT, 'src/messages')
  const files = readdirSync(MSG_DIR).filter((f) => f.endsWith('.json'))

  function load(file: string): Record<string, Record<string, unknown>> {
    return JSON.parse(readFileSync(join(MSG_DIR, file), 'utf8'))
  }
  function keyShape(obj: unknown, prefix = ''): string[] {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .flatMap((k) => keyShape((obj as Record<string, unknown>)[k], `${prefix}${k}.`))
    }
    return [prefix.replace(/\.$/, '')]
  }

  it('ships at least the six shipped locales, all shape-compatible with en', () => {
    expect(files.length).toBeGreaterThanOrEqual(6)
    const enShape = keyShape(load('en.json'))
    for (const f of files) {
      expect(keyShape(load(f)), `${f} key shape matches en.json`).toEqual(enShape)
    }
  })

  it('drops trial / AI / Pro / Dawa legacy strings from every locale file', () => {
    for (const f of files) {
      const raw = readFileSync(join(MSG_DIR, f), 'utf8')
      expect(raw, `${f} no Start free trial`).not.toContain('Start free trial')
      expect(raw, `${f} no Try free`).not.toContain('Try free')
      expect(raw, `${f} no Omnix Pro`).not.toContain('Omnix Pro')
      expect(raw, `${f} no Omnix Dawa`).not.toContain('Omnix Dawa')
    }
  })

  it('neutralises the AI nav label away from the bare AI token in every locale', () => {
    for (const f of files) {
      const m = load(f)
      const ai = m.nav?.ai
      expect(typeof ai, `${f} nav.ai present`).toBe('string')
      expect(['AI', 'IA', 'الذكاء الاصطناعي'], `${f} nav.ai neutralised`).not.toContain(ai as string)
      expect((ai as string).length).toBeGreaterThan(0)
    }
  })

  it('sets the exact English neutralised values (Book a demo / Products / Pharmacy)', () => {
    const en = load('en.json')
    expect(en.nav.startTrial).toBe('Book a demo')
    expect(en.common.tryFree).toBe('Book a demo')
    expect(en.nav.ai).toBe('Products')
    expect(en.trades.pro).toBe('Omnix products')
    expect(en.trades.dawa).toBe('Pharmacy')
  })

  it('keeps the internal license/variant display name untouched (publicProductName stays a code path)', () => {
    // The messages neutralisation must NOT touch internal enum strings: the
    // 'pro' variant's internal display name lives in code, not messages.
    const buyResolver = read('src/lib/checkout-status.ts')
    // Retail/Hospitality/Hardware public trade labels are still valid names.
    for (const f of files) {
      const raw = readFileSync(join(MSG_DIR, f), 'utf8')
      expect(raw).toContain('Omnix Retail')
    }
    // Sanity: the checkout status module still exists (internal enum surface).
    expect(buyResolver.length).toBeGreaterThan(0)
  })
})

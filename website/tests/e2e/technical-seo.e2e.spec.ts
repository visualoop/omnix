import { expect, test } from '@playwright/test'

/**
 * Task 28 — technical SEO hardening.
 *
 * Verifies live redirect behaviour (permanent 308 + safe query), self-canonical
 * and hreflang on a product page, robots.txt / sitemap.xml responses, and that
 * legacy Pro/AI/Dawa routes no longer render a landing page.
 */

const REDIRECTS: Array<[from: string, to: string]> = [
  ['/ke/dawa', '/ke/pharmacy'],
  ['/ke/pro', '/ke/modules'],
  ['/ke/ai', '/ke/modules'],
  ['/ke/payroll-pack', '/ke/modules'],
  ['/ke/modules/dawa', '/ke/pharmacy'],
  ['/ke/modules/retail', '/ke/retail'],
  ['/ke/modules/hospitality', '/ke/hospitality'],
  ['/ke/modules/hardware', '/ke/hardware'],
  ['/ke/modules/salon', '/ke/salon'],
  ['/ke/modules/core', '/ke/modules'],
]

test.describe('Task 28 — legacy route permanent redirects', () => {
  for (const [from, to] of REDIRECTS) {
    test(`${from} returns 308 → ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 })
      expect(res.status()).toBe(308)
      expect(res.headers()['location']).toContain(to)
    })

    test(`${from} lands on a real ${to} page (no chain)`, async ({ page }) => {
      await page.goto(from)
      expect(page.url()).toContain(to)
      // The destination renders 200 content, not another redirect stub.
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    })
  }

  test('preserves safe campaign query on redirect', async ({ request }) => {
    const res = await request.get('/ke/dawa?utm_source=google&product=pharmacy', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    const location = res.headers()['location']
    expect(location).toContain('/ke/pharmacy?')
    expect(location).toContain('utm_source=google')
    expect(location).toContain('product=pharmacy')
  })

  test('drops security-sensitive query on redirect', async ({ request }) => {
    const res = await request.get('/ke/dawa?token=secret-value&next=/admin', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    const location = res.headers()['location']
    expect(location).toContain('/ke/pharmacy')
    expect(location).not.toContain('token')
    expect(location).not.toContain('secret-value')
    expect(location).not.toContain('next=')
  })
})

test.describe('Task 28 — Kenya-only guides & locations canonicalise to /ke', () => {
  // National buyer guides and local city hubs are Kenya-only content: every
  // non-ke market permanently (308) redirects to the canonical /ke path.
  for (const path of ['/guides', '/locations']) {
    test(`/us${path} returns 308 → /ke${path} (no chain)`, async ({ request }) => {
      const res = await request.get(`/us${path}`, { maxRedirects: 0 })
      expect(res.status()).toBe(308)
      expect(res.headers()['location']).toContain(`/ke${path}`)
    })

    test(`/us${path} lands on the real /ke${path} hub (no chain)`, async ({ page }) => {
      await page.goto(`/us${path}`)
      expect(page.url()).toContain(`/ke${path}`)
      // The /ke destination renders 200 content, not another redirect.
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    })

    test(`/us${path} self-canonicalises to /ke with Kenya-only hreflang`, async ({ page }) => {
      await page.goto(`/us${path}`)
      const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href')
      expect(canonical).toContain(`/ke${path}`)

      const enKE = await page.locator('link[rel="alternate"][hreflang="en-KE"]').getAttribute('href')
      expect(enKE).toContain(`/ke${path}`)
      const xDefault = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute('href')
      expect(xDefault).toContain(`/ke${path}`)
      // Kenya-only: no other market hreflang is declared.
      await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveCount(0)
    })
  }

  test('preserves safe campaign query on the /ke redirect', async ({ request }) => {
    const res = await request.get('/us/guides?utm_source=google&product=pharmacy', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    const location = res.headers()['location']
    expect(location).toContain('/ke/guides?')
    expect(location).toContain('utm_source=google')
    expect(location).toContain('product=pharmacy')
  })

  test('drops security-sensitive query on the /ke redirect', async ({ request }) => {
    const res = await request.get('/gb/locations?token=secret-value&next=/admin', { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    const location = res.headers()['location']
    expect(location).toContain('/ke/locations')
    expect(location).not.toContain('token')
    expect(location).not.toContain('secret-value')
    expect(location).not.toContain('next=')
  })
})

test.describe('Task 28 — canonical + hreflang', () => {
  test('a product page self-canonicalises and declares hreflang alternates', async ({ page }) => {
    await page.goto('/ke/pharmacy')

    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href')
    expect(canonical).toContain('/ke/pharmacy')

    const enKE = await page.locator('link[rel="alternate"][hreflang="en-KE"]').getAttribute('href')
    expect(enKE).toContain('/ke/pharmacy')

    const enUS = await page.locator('link[rel="alternate"][hreflang="en-US"]').getAttribute('href')
    expect(enUS).toContain('/us/pharmacy')

    const xDefault = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute('href')
    expect(xDefault).toContain('/ke/pharmacy')
  })

  test('emits SoftwareApplication structured data priced from config', async ({ page }) => {
    await page.goto('/ke/pharmacy')
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const software = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'SoftwareApplication')
    expect(software).toBeTruthy()
    expect(software.operatingSystem).toContain('Windows')
    expect(software.offers.priceCurrency).toBe('KES')
    expect(software.offers.price).toBe('30000')
    expect(software.offers.url).toContain('/ke/pharmacy')
    expect(software.offers.availability).toBeUndefined()
    expect(software.aggregateRating).toBeUndefined()
  })
})

test.describe('Task 28 — robots.txt', () => {
  test('permits the public site and disallows private families without blocking assets', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.ok()).toBeTruthy()
    const body = await res.text()
    for (const path of ['/admin', '/dashboard', '/onboarding', '/login', '/signup', '/buy', '/api/', '/region-unavailable']) {
      expect(body).toContain(`Disallow: ${path}`)
    }
    expect(body).not.toContain('Disallow: /_next')
    // The generated Open Graph image endpoint is explicitly allowed for social
    // crawlers, even though the rest of /api is blocked.
    expect(body).toContain('Allow: /api/og')
    expect(body).toContain('Sitemap:')
    expect(body).toContain('sitemap.xml')
  })
})

test.describe('Task 28 — sitemap.xml', () => {
  test('lists canonical routes and excludes legacy redirects and private families', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.ok()).toBeTruthy()
    const xml = await res.text()

    for (const loc of ['/ke/pharmacy', '/ke/retail', '/ke/hospitality', '/ke/hardware', '/ke/salon', '/ke/modules', '/ke/pricing', '/ke/guides']) {
      expect(xml).toContain(`${loc}</loc>`)
    }
    // Legacy redirects and module slug pages never appear.
    for (const bad of ['/ke/ai</loc>', '/ke/dawa</loc>', '/ke/pro</loc>', '/ke/payroll-pack</loc>', '/ke/modules/dawa', '/ke/modules/retail']) {
      expect(xml).not.toContain(bad)
    }
    // Kenya-only content is emitted under /ke only — never under other markets.
    for (const cc of ['us', 'gb', 'ng', 'za', 'ae']) {
      expect(xml, `no /${cc}/guides`).not.toContain(`/${cc}/guides</loc>`)
      expect(xml, `no /${cc}/guides/ detail`).not.toContain(`/${cc}/guides/`)
      expect(xml, `no /${cc}/locations`).not.toContain(`/${cc}/locations`)
    }
    // Private top-level families never appear. Document slugs such as
    // /<locale>/docs/onboarding remain legitimate public content.
    const privateFamilies = ['admin', 'dashboard', 'buy', 'onboarding', 'login', 'signup']
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
    for (const location of locations) {
      const [, locale, family] = new URL(location).pathname.split('/')
      expect(locale, `${location} has a locale`).toBeTruthy()
      expect(privateFamilies, `${location} excludes private top-level families`).not.toContain(family)
    }
  })
})

test.describe('Task 28 — legacy landing pages are gone', () => {
  for (const [from, to] of [
    ['/ke/ai', '/ke/modules'],
    ['/ke/pro', '/ke/modules'],
    ['/ke/dawa', '/ke/pharmacy'],
    ['/ke/payroll-pack', '/ke/modules'],
  ] as const) {
    test(`${from} no longer renders its own landing (→ ${to})`, async ({ page }) => {
      await page.goto(from)
      expect(page.url()).toContain(to)
      // No stale acquisition CTA survives on the destination.
      await expect(page.getByRole('link', { name: /start.*free trial/i })).toHaveCount(0)
    })
  }
})

test.describe('Task 28 — Open Graph & Twitter completeness', () => {
  const ogContent = (page: import('@playwright/test').Page, property: string) =>
    page.locator(`meta[property="${property}"]`).first().getAttribute('content')
  const twContent = (page: import('@playwright/test').Page, name: string) =>
    page.locator(`meta[name="${name}"]`).first().getAttribute('content')

  test('a product page emits a complete, page-specific og:image / site_name / locale + Twitter card', async ({ page }) => {
    await page.goto('/ke/pharmacy')

    // Open Graph — the child page no longer drops the layout defaults.
    const image = await ogContent(page, 'og:image')
    expect(image, 'og:image present').toBeTruthy()
    expect(image).toMatch(/^https?:\/\//)
    // Either the approved asset or the first-party generated card.
    expect(image === null ? '' : image).toMatch(/\/api\/og|https?:\/\//)

    expect(await ogContent(page, 'og:site_name')).toBe('Omnix')
    expect(await ogContent(page, 'og:locale')).toBe('en_KE')

    // Twitter — page-specific, not the homepage card.
    expect(await twContent(page, 'twitter:card')).toBe('summary_large_image')
    const twTitle = await twContent(page, 'twitter:title')
    expect(twTitle, 'twitter:title present').toBeTruthy()
    expect(twTitle).toContain('Pharmacy')
    expect(await twContent(page, 'twitter:description'), 'twitter:description present').toBeTruthy()
    expect(await twContent(page, 'twitter:image'), 'twitter:image present').toBeTruthy()
  })

  test('a dynamic article route emits article og:type with a complete social block', async ({ page }) => {
    // Discover a real article slug from the blog index (no hard-coded slug).
    await page.goto('/ke/blog')
    const href = await page.locator('a[href*="/blog/"]').first().getAttribute('href')
    expect(href, 'a blog article link exists').toBeTruthy()

    await page.goto(href!)
    expect(await ogContent(page, 'og:type')).toBe('article')
    expect(await ogContent(page, 'og:site_name')).toBe('Omnix')
    expect(await ogContent(page, 'og:locale')).toBe('en_KE')
    expect(await ogContent(page, 'og:image'), 'article og:image present').toBeTruthy()

    expect(await twContent(page, 'twitter:card')).toBe('summary_large_image')
    expect(await twContent(page, 'twitter:title'), 'article twitter:title present').toBeTruthy()
    expect(await twContent(page, 'twitter:description'), 'article twitter:description present').toBeTruthy()
    expect(await twContent(page, 'twitter:image'), 'article twitter:image present').toBeTruthy()
  })
})

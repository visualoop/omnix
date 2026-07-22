import { expect, test, type Page } from '@playwright/test'

/**
 * Task 20 - local-SEO location hubs, all ten Kenyan city buying guides live.
 *
 * Task 18 built the strict registry gate; Task 19 published the first three
 * hubs (Nairobi, Mombasa, Nakuru); Task 20 published the remaining seven
 * (Kisumu, Eldoret, Thika, Machakos, Meru, Nyeri, Kisii). The index now lists
 * all ten (never a doorway template), each published hub renders its five
 * product links, a demo-led primary and the honest "no local office"
 * disclaimer, and only an unknown slug 404s. Layout must hold from 320 to 1440
 * on the light-first Working Counter tokens (dark is explicit opt-in). Route
 * counts are unchanged: still exactly /locations and /locations/[slug].
 *
 * To keep the browser suite honest without running a 50-cell grid, two
 * representative hubs (one Task 19, one Task 20) take the full 320-to-1440
 * matrix, and every other city is checked once at a representative viewport.
 */

const PUBLISHED_SLUGS = [
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

/** The seven hubs Task 20 added; each must render (no longer a 404 draft). */
const NEW_SLUGS = ['kisumu', 'eldoret', 'thika', 'machakos', 'meru', 'nyeri', 'kisii'] as const

/** Two representative hubs carry the full responsive matrix. */
const FULL_MATRIX_SLUGS = ['nairobi', 'kisumu'] as const
const FULL_MATRIX = new Set<string>(FULL_MATRIX_SLUGS)

/** Every other published hub is checked once, at one representative viewport. */
const SINGLE_VIEWPORT_SLUGS = PUBLISHED_SLUGS.filter((slug) => !FULL_MATRIX.has(slug))

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
  { width: 768, height: 1000 },
  { width: 1440, height: 1000 },
] as const

const ONE_VIEWPORT = { width: 1440, height: 1000 } as const

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function expectHubRenders(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Demo-led primary, locale-aware.
  await expect(page.getByRole('link', { name: /Book a demo/ }).first()).toHaveAttribute(
    'href',
    /\/ke\/contact\?type=demo/,
  )
  // Five product links, each pointing at a real product page.
  await expect(page.locator('[data-location-product]')).toHaveCount(5)
  await expect(page.locator('[data-location-product-link]').first()).toHaveAttribute(
    'href',
    /\/ke\/(pharmacy|retail|hospitality|hardware|salon)$/,
  )
  // Honest "this is a buying guide, not a local office" disclaimer.
  await expect(page.locator('[data-location-disclaimer]')).toContainText(
    /do not operate a local office/i,
  )
  await expectNoHorizontalOverflow(page)
}

test.describe('Task 20 locations index - lists all ten published cities, demo-led', () => {
  test('shows all ten city rows from 320 to 1440', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/ke/locations')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('link', { name: /Book a demo/ }).first()).toHaveAttribute(
        'href',
        /\/ke\/contact\?type=demo/,
      )
      // The empty state is gone now that ten cities are published.
      await expect(page.locator('[data-location-empty]')).toHaveCount(0)
      await expect(page.locator('[data-location-row]')).toHaveCount(PUBLISHED_SLUGS.length)
      for (const slug of PUBLISHED_SLUGS) {
        await expect(page.locator(`[data-location-row="${slug}"]`)).toHaveAttribute(
          'href',
          `/ke/locations/${slug}`,
        )
      }
      await expectNoHorizontalOverflow(page)
    }
  })
})

test.describe('Task 20 published hubs - representative full 320-to-1440 matrix', () => {
  for (const slug of FULL_MATRIX_SLUGS) {
    test(`/ke/locations/${slug} renders across every viewport`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        const response = await page.goto(`/ke/locations/${slug}`)
        expect(response?.status()).toBe(200)
        await expectHubRenders(page)
      }
    })
  }
})

test.describe('Task 20 published hubs - every remaining city renders at one viewport', () => {
  for (const slug of SINGLE_VIEWPORT_SLUGS) {
    test(`/ke/locations/${slug} renders its products and office disclaimer`, async ({ page }) => {
      await page.setViewportSize(ONE_VIEWPORT)
      const response = await page.goto(`/ke/locations/${slug}`)
      expect(response?.status()).toBe(200)
      await expectHubRenders(page)
    })
  }
})

test.describe('Task 20 location hubs - the seven new cities now render, unknown slugs 404', () => {
  test('each formerly-draft slug now returns 200 instead of 404', async ({ page }) => {
    for (const slug of NEW_SLUGS) {
      const response = await page.goto(`/ke/locations/${slug}`)
      expect(response?.status(), `${slug} is now published`).toBe(200)
    }
  })

  test('/ke/locations/does-not-exist returns 404', async ({ request }) => {
    const response = await request.get('/ke/locations/does-not-exist')
    expect(response.status()).toBe(404)
  })
})

test.describe('Task 20 locations - light-first tokens, dark opt-in', () => {
  test('renders the Working Counter dark tokens when dark is chosen', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })

    for (const path of ['/ke/locations', '/ke/locations/kisumu']) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveClass(/dark/)
      const colors = await page.evaluate(() => ({
        background: getComputedStyle(document.documentElement).backgroundColor,
        foreground: getComputedStyle(document.body).color,
      }))
      expect(colors.background).toBe('rgb(17, 17, 15)')
      expect(colors.foreground).toBe('rgb(247, 245, 238)')
    }
  })
})

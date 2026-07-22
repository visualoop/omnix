import { expect, test, type Page } from '@playwright/test'

/**
 * Task 16 — blog, docs, changelog, roadmap, and the legal route family.
 * Verifies the redesigned pages stay usable from 320 to 1440, keep a single
 * demo-led primary, honour the light-first / dark-opt-in tokens, and never
 * surface placeholder ("TODO") documentation to crawlers.
 */

const DEMO_ROUTES = [
  { path: '/ke/blog', heading: 'Notes from building Omnix.' },
  { path: '/ke/docs', heading: 'Everything you need to run Omnix.' },
  { path: '/ke/changelog', heading: 'Every release, in the open.' },
  { path: '/ke/roadmap', heading: 'Shipped, planned, and exploring.' },
  { path: '/ke/terms', heading: 'Terms of service' },
  { path: '/ke/privacy', heading: 'Privacy policy' },
  { path: '/ke/refund-policy', heading: 'Refund policy' },
] as const

const DETAIL_ROUTES = [
  { path: '/ke/blog/offline-first-architecture', heading: /offline-first means in Omnix/i },
  { path: '/ke/docs/getting-started', heading: /Getting started/ },
] as const

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 768, height: 900 },
  { width: 1440, height: 1000 },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

test.describe('Task 16 content & legal routes — responsive matrix', () => {
  for (const route of DEMO_ROUTES) {
    test(`${route.path} stays usable and demo-led from 320 to 1440`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(route.path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading)
        await expect(
          page.getByRole('link', { name: 'Book a demo' }).first(),
        ).toHaveAttribute('href', '/ke/contact?type=demo')
        await expectNoHorizontalOverflow(page)
      }
    })
  }

  for (const route of DETAIL_ROUTES) {
    test(`${route.path} long-form detail stays readable from 320 to 1440`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(route.path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading)
        await expectNoHorizontalOverflow(page)
      }
    })
  }
})

test.describe('Task 16 — light-first tokens, dark opt-in', () => {
  test('renders the Working Counter dark tokens when dark is chosen', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })

    for (const route of DEMO_ROUTES) {
      await page.goto(route.path)
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

test.describe('Task 16 docs — placeholder content is not indexed', () => {
  test('a scaffold doc is noindex and never shows the raw TODO marker', async ({ page }) => {
    await page.goto('/ke/docs/banking')
    // The route still resolves (slug preserved) rather than 404-ing.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // It is kept out of the index.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    // The unwritten scaffold body is never exposed.
    await expect(page.locator('body')).not.toContainText('TODO: document this.')
    await expect(page.locator('body')).toContainText('This guide is being written')
  })

  test('a published doc is indexable and links back within the locale', async ({ page }) => {
    await page.goto('/ke/docs/getting-started')
    // Inherits index,follow from the layout — the key point is it is NOT noindex.
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/)
    await expect(page.getByRole('link', { name: 'All docs' })).toHaveAttribute('href', '/ke/docs')
  })
})

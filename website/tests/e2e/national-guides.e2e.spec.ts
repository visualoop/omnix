import { expect, test, type Page } from '@playwright/test'

/**
 * Task 17 — national Kenyan buyer guides.
 * The index and every published guide must stay usable from 320 to 1440,
 * keep a demo-led primary, link to the matching product page, and honour the
 * light-first / dark-opt-in Working Counter tokens.
 */

const GUIDE_SLUGS = [
  'pos-system-kenya',
  'inventory-management-software-kenya',
  'pharmacy-software-kenya',
  'restaurant-pos-kenya',
  'hardware-shop-pos-kenya',
  'salon-appointment-software-kenya',
] as const

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
  { width: 768, height: 1000 },
  { width: 1440, height: 1000 },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

test.describe('Task 17 guides index — responsive matrix', () => {
  test('stays usable and demo-led from 320 to 1440', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/ke/guides')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('link', { name: /Book a demo/ }).first()).toHaveAttribute(
        'href',
        /\/ke\/contact\?type=demo/,
      )
      // Every published guide is reachable from the index.
      for (const slug of GUIDE_SLUGS) {
        await expect(page.locator(`[data-guide-row="${slug}"]`)).toHaveAttribute(
          'href',
          `/ke/guides/${slug}`,
        )
      }
      await expectNoHorizontalOverflow(page)
    }
  })
})

test.describe('Task 17 guide detail — responsive matrix', () => {
  for (const slug of GUIDE_SLUGS) {
    test(`/ke/guides/${slug} stays usable and links to its product from 320 to 1440`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/ke/guides/${slug}`)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(
          page.locator('[data-guide-actions]').getByRole('link', { name: /Book a demo/ }),
        ).toHaveAttribute(
          'href',
          /\/ke\/contact\?type=demo&product=(retail|pharmacy|hospitality|hardware|salon)/,
        )
        await expect(page.locator('[data-guide-product-link]').first()).toHaveAttribute(
          'href',
          /\/ke\/(retail|pharmacy|hospitality|hardware|salon)$/,
        )
        await expectNoHorizontalOverflow(page)
      }
    })
  }
})

test.describe('Task 17 guides — light-first tokens, dark opt-in', () => {
  test('renders the Working Counter dark tokens when dark is chosen', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })

    for (const path of ['/ke/guides', `/ke/guides/${GUIDE_SLUGS[0]}`]) {
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

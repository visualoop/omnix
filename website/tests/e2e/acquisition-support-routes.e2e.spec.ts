import { expect, test, type Page } from '@playwright/test'

const ROUTES = [
  { path: '/ke/pricing', heading: 'Own the software. Keep running it.' },
  { path: '/ke/modules', heading: 'Five products for five kinds of working day.' },
  { path: '/ke/downloads', heading: 'Install after purchase. From your own dashboard.' },
  { path: '/ke/migration', heading: 'Move the records you trust. Keep the source intact.' },
  { path: '/ke/security', heading: 'Know where the boundary is.' },
  { path: '/ke/contact', heading: 'Choose the shortest route.' },
] as const

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
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

test.describe('Task 14 acquisition support route browser matrix', () => {
  for (const route of ROUTES) {
    test(`${route.path} stays usable from 320 to 1440`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(route.path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading)
        await expect(page.getByRole('link', { name: /Book (a|a migration) demo/ }).first()).toHaveAttribute(
          'href',
          '/ke/contact?type=demo',
        )
        await expectNoHorizontalOverflow(page)
      }
    })
  }

  test('all six routes render with the Working Counter dark tokens', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })

    for (const route of ROUTES) {
      await page.goto(route.path)
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const colors = await page.evaluate(() => ({
        background: getComputedStyle(document.documentElement).backgroundColor,
        foreground: getComputedStyle(document.body).color,
      }))
      expect(colors.background).toBe('rgb(17, 17, 15)')
      expect(colors.foreground).toBe('rgb(247, 245, 238)')
    }
  })
})

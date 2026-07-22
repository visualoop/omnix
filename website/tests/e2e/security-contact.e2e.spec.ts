import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
  { width: 768, height: 900 },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

test.describe('Security and Contact acquisition routes', () => {
  test('renders the verified security boundary without narrow-width overflow', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/ke/security')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Know where the boundary is.')
      await expect(page.getByText('The database file is not encrypted by Omnix.', { exact: false })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Book a demo' }).first()).toHaveAttribute('href', '/ke/contact?type=demo')
      await expectNoHorizontalOverflow(page)
    }
  })

  test('routes ordinary contact procedurally and preserves the demo form', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 })
    await page.goto('/ke/contact')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose the shortest route.')
    await expect(page.getByRole('link', { name: 'Book a demo' }).first()).toHaveAttribute('href', '/ke/contact?type=demo')
    await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', /^mailto:support@omnix\.co\.ke/)
    await expect(page.locator('form')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await page.goto('/ke/contact?type=demo&product=retail')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A demo built around your counter.')
    await expect(page.locator('form')).toHaveCount(1)
    await expect(page.locator('input[name="product"][value="retail"]')).toBeChecked()
  })
})

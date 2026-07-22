import { expect, test, type Page } from '@playwright/test'

const ROUTES = [
  { path: '/ke/about', heading: 'Business software your shop actually owns.' },
  { path: '/ke/team', heading: 'The people behind Omnix.' },
  { path: '/ke/partners', heading: 'Carry Omnix to your market.' },
  { path: '/ke/support', heading: 'Real routes to a human.' },
  { path: '/ke/mpesa', heading: 'M-Pesa at the counter, recorded either way.' },
  { path: '/ke/etims', heading: 'Tax invoices built locally, signed with KRA.' },
  { path: '/ke/sha', heading: 'Insurance kept on the record, claimed through SHA.' },
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

test.describe('Task 15 trust route browser matrix', () => {
  test.describe.configure({ timeout: 90_000 })
  for (const route of ROUTES) {
    test(`${route.path} stays usable from 320 to 1440`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[0])
      await page.goto(route.path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading)
      await expect(
        page.getByRole('link', { name: 'Book a demo' }).first(),
      ).toHaveAttribute('href', '/ke/contact?type=demo')

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await expectNoHorizontalOverflow(page)
      }
    })
  }

  test('all seven trust routes render with the Working Counter dark tokens', async ({ page }) => {
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

  test('boundary routes explain the local vs connected split in the responsibility ledger', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })

    await page.goto('/ke/mpesa')
    await expect(page.getByText('The sale is recorded locally.').first()).toBeVisible()
    await expect(page.getByText(/Safaricom Daraja/).first()).toBeVisible()

    await page.goto('/ke/etims')
    await expect(page.getByText('Invoices are created and stored locally.').first()).toBeVisible()
    await expect(page.getByText(/valid KRA PIN/).first()).toBeVisible()

    await page.goto('/ke/sha')
    await expect(page.getByText(/accredited provider account/).first()).toBeVisible()
    await expect(page.getByText(/determined by SHA under its rules/).first()).toBeVisible()
  })
})

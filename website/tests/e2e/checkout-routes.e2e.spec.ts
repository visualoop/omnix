import { expect, test, type Page } from '@playwright/test'

/**
 * Checkout route browser matrix (Task 22).
 *
 * Signed out, the purchase resolver, order review and confirmation all
 * bounce to /login — so the only checkout surface an anonymous browser
 * actually reaches is /buy/cancelled. Crucially, a spoofed
 * ?success=true / ?ref= query must never render a confirmed-payment
 * screen.
 */

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

const CONFIRMED_TEXT = [/Payment confirmed/i, /Payment received/i, /licence is active/i]

test.describe('Task 22 checkout access gates', () => {
  test('/buy sends a signed-out visitor to sign-in, not into a purchase', async ({ page }) => {
    await page.goto('/buy?variant=dawa')
    await page.waitForURL(/\/login\?next=/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  })

  test('/buy/[licenseId] order review requires a session', async ({ page }) => {
    await page.goto('/buy/nonexistent-licence')
    await page.waitForURL(/\/login\?next=/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  })

  test('/buy/success requires a session and never confirms from the query alone', async ({ page }) => {
    await page.goto('/buy/success?success=true&ref=OMX-SPOOFED-REF')
    await page.waitForURL(/\/login\?next=/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    const body = (await page.textContent('body')) ?? ''
    for (const pattern of CONFIRMED_TEXT) {
      expect(body).not.toMatch(pattern)
    }
  })
})

test.describe('Task 22 reachable checkout states', () => {
  test('/buy/cancelled renders the cancelled state and the secure-checkout chrome', async ({ page }) => {
    await page.goto('/buy/cancelled')
    await expect(page.getByRole('heading', { level: 1, name: /Payment didn.t go through/i })).toBeVisible()
    await expect(page.getByText(/Secure checkout/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to licences/i })).toBeVisible()
    // A cancelled screen must never claim a completed payment.
    const body = (await page.textContent('body')) ?? ''
    for (const pattern of CONFIRMED_TEXT) {
      expect(body).not.toMatch(pattern)
    }
  })

  test('/buy/cancelled stays usable from 320 to 1440', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/buy/cancelled')
      await expect(page.getByRole('heading', { level: 1, name: /Payment didn.t go through/i })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  })

  test('/buy/cancelled renders the Working Counter dark tokens on opt-in', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/buy/cancelled')
    await expect(page.locator('html')).toHaveClass(/dark/)
    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.documentElement).backgroundColor,
      foreground: getComputedStyle(document.body).color,
    }))
    expect(colors.background).toBe('rgb(17, 17, 15)')
    expect(colors.foreground).toBe('rgb(247, 245, 238)')
  })

  test('/buy/cancelled keeps the light-first tokens by default', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/buy/cancelled')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const background = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    expect(background).toBe('rgb(250, 250, 247)')
  })
})

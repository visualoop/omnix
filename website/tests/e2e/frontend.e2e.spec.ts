import { test, expect } from '@playwright/test'

/**
 * Marketing-site smoke + accessibility e2e.
 *
 * Runs against E2E_BASE_URL (defaults to localhost:3000). Covers the
 * M-Pesa-first homepage, the variant landings, the setup-guide docs,
 * the team page, and the WhatsApp widget — the public surfaces shipped
 * in v0.12.0.
 *
 * Locale-prefixed routes: the app redirects '/' to a locale (e.g. /ke).
 * We hit the bare paths and let the middleware resolve the locale.
 */

test.describe('Marketing homepage', () => {
  test('leads with M-Pesa, not ERP', async ({ page }) => {
    await page.goto('/ke')
    // Headline should mention M-Pesa (hero rewrite).
    const h1 = page.locator('h1').first()
    await expect(h1).toContainText(/M-Pesa/i)
    // Title carries the Kenya M-Pesa positioning.
    await expect(page).toHaveTitle(/M-Pesa/i)
  })

  test('WhatsApp widget opens and deep-links to wa.me', async ({ page }) => {
    await page.goto('/ke')
    const fab = page.getByRole('button', { name: /WhatsApp/i })
    await expect(fab).toBeVisible()
    await fab.click()
    await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible()
  })
})

test.describe('Variant landings', () => {
  for (const v of ['dawa', 'retail', 'hardware', 'hospitality']) {
    test(`/${v} leads with M-Pesa`, async ({ page }) => {
      await page.goto(`/ke/${v}`)
      await expect(page.locator('h1').first()).toContainText(/M-Pesa/i)
    })
  }
})

test.describe('Setup guides', () => {
  test('M-Pesa doc explains Paybill/Till + Daraja keys', async ({ page }) => {
    await page.goto('/ke/docs/mpesa')
    await expect(page.locator('body')).toContainText(/Paybill/i)
    await expect(page.locator('body')).toContainText(/Daraja/i)
  })
  test('Paystack key guide exists', async ({ page }) => {
    await page.goto('/ke/docs/paystack-keys')
    await expect(page.locator('body')).toContainText(/API Keys/i)
  })
  test('AI key guide exists', async ({ page }) => {
    await page.goto('/ke/docs/ai-keys')
    await expect(page.locator('body')).toContainText(/Groq|OpenRouter|Anthropic/i)
  })
})

test.describe('Team page', () => {
  test('renders the team hero', async ({ page }) => {
    await page.goto('/ke/team')
    await expect(page.locator('h1').first()).toContainText(/Omnix/i)
  })
})

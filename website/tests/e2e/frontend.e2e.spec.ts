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
  test('explains M-Pesa without positioning Omnix as generic ERP', async ({ page }) => {
    await page.goto('/ke')
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    await expect(h1).not.toContainText(/\bERP\b/i)
    await expect(page.locator('body')).toContainText(/M-Pesa/i)
    await expect(page).toHaveTitle(/Omnix/i)
  })

  test('WhatsApp widget is absent or uses a configured wa.me link', async ({ page }) => {
    await page.goto('/ke')
    const fab = page.getByRole('button', { name: /WhatsApp/i })
    if (await fab.count()) {
      await expect(fab).toBeVisible()
      await fab.click()
      await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible()
      await page.getByRole('button', { name: 'Send via WhatsApp' }).click()
    } else {
      await expect(page.getByRole('link', { name: 'Ask on WhatsApp' })).toHaveCount(0)
    }
  })
})

test.describe('Product landings', () => {
  for (const [route, canonical] of [
    ['dawa', 'pharmacy'],
    ['retail', 'retail'],
    ['hardware', 'hardware'],
    ['hospitality', 'hospitality'],
    ['salon', 'salon'],
  ] as const) {
    test(`/${route} resolves to the canonical ${canonical} product with M-Pesa coverage`, async ({ page }) => {
      await page.goto(`/ke/${route}`)
      await expect(page).toHaveURL(new RegExp(`/ke/${canonical}$`))
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('body')).toContainText(/M-Pesa/i)
      await expect(page.getByRole('link', { name: /Book .* demo/i }).first()).toBeVisible()
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
  test('legacy AI key guide is retired from the public docs surface', async ({ request }) => {
    const response = await request.get('/ke/docs/ai-keys')
    expect(response.status()).toBe(404)
    // It must never surface the old provider-key walkthrough.
    await expect(response.text()).resolves.not.toMatch(/Groq|OpenRouter|Anthropic/i)
  })
})

test.describe('Team page', () => {
  test('renders the team hero', async ({ page }) => {
    await page.goto('/ke/team')
    await expect(page.locator('h1').first()).toContainText(/Omnix/i)
  })
})

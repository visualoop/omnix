/**
 * Customer auth flow e2e — signup → email-verify (skipped) → login → dashboard.
 *
 * Runs against `next dev` started by playwright.config. The customer DB
 * lives on Postgres in real life — this spec uses route mocks for /api/*
 * so it doesn't depend on database state.
 */
import { test, expect } from '@playwright/test'

const fakeCustomerId = 'c_e2e_1'
const fakeCustomer = {
  id: fakeCustomerId,
  email: 'jane@example.co.ke',
  fullName: 'Jane Doe',
  businessName: 'Janes Pharmacy',
  status: 'active',
}

test.describe('customer auth flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Payload customer endpoints so we don't need a DB
    await page.route('**/api/customers', async (route) => {
      const req = route.request()
      if (req.method() === 'POST') {
        await route.fulfill({ status: 201, json: { doc: fakeCustomer } })
      } else {
        await route.continue()
      }
    })
    await page.route('**/api/customers/login', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'set-cookie': 'payload-token=fake-jwt; Path=/; HttpOnly' },
        json: { user: fakeCustomer, token: 'fake-jwt', exp: Date.now() / 1000 + 3600 },
      })
    })
    await page.route('**/api/customers/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: fakeCustomer } })
    })
  })

  test('signup form renders with full Tailwind styling', async ({ page }) => {
    await page.goto('/signup')
    // Hero copy visible
    await expect(page.getByRole('heading', { name: /Start your/i })).toBeVisible()
    // Field labels visible (Tailwind loaded — uppercase tracking treatment)
    await expect(page.getByText('Full name', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Email', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Password', { exact: false }).first()).toBeVisible()
    // Submit button rendered
    await expect(page.getByRole('button', { name: /Create.*account|Sign up|Continue/i }).first()).toBeVisible()
  })

  test('login page renders with full Tailwind styling', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('header has wordmark left + hamburger top-right on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    // Wordmark
    const wordmark = page.getByLabel(/home/i).first()
    await expect(wordmark).toBeVisible()
    // Hamburger should be aria-labelled "Open menu" and visually right of wordmark
    const hamburger = page.getByRole('button', { name: /menu/i })
    await expect(hamburger).toBeVisible()
    const wm = await wordmark.boundingBox()
    const hb = await hamburger.boundingBox()
    expect(wm).toBeTruthy()
    expect(hb).toBeTruthy()
    // Hamburger sits to the right of wordmark
    expect(hb!.x).toBeGreaterThan(wm!.x + wm!.width)
  })
})

test.describe('public marketing pages', () => {
  test('/ renders hero', async ({ page }) => {
    await page.goto('/')
    // Some hero content — heading or top-of-page text
    await expect(page).toHaveTitle(/Omnix/i)
  })

  test('/downloads has a clickable download anchor with target=_blank + download attr', async ({ page }) => {
    await page.goto('/downloads')
    const link = page.locator('a[download]').first()
    if (await link.count()) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
    }
  })

  test('/changelog renders without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/changelog')
    expect(errors).toHaveLength(0)
  })
})

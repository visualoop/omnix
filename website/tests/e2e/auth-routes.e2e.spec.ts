import { expect, test, type Page } from '@playwright/test'

/**
 * Reachable-while-signed-out account routes. Authenticated-only routes
 * (/onboarding, /dashboard, /accept-invitation/[id]) redirect to /login,
 * so the sign-in surface is what an unauthenticated browser actually sees.
 */
const ROUTES = [
  { path: '/login', heading: 'Sign in' },
  { path: '/forgot-password', heading: 'Recover access' },
  { path: '/verify-email/expired-sample-token', heading: 'Verification is automatic' },
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

test.describe('Task 21 account-entry route browser matrix', () => {
  for (const route of ROUTES) {
    test(`${route.path} stays usable from 320 to 1440`, async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(route.path)
        await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()
        await expectNoHorizontalOverflow(page)
      }
    })
  }

  test('sign-in exposes Google and magic-link, never a password field', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: /Email me a sign-in link/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('/signup redirects to sign-in and never shows a public registration form', async ({ page }) => {
    await page.goto('/signup?variant=dawa')
    await page.waitForURL(/\/login\?next=/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('login renders the Working Counter dark tokens on opt-in', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/login')
    await expect(page.locator('html')).toHaveClass(/dark/)
    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.documentElement).backgroundColor,
      foreground: getComputedStyle(document.body).color,
    }))
    expect(colors.background).toBe('rgb(17, 17, 15)')
    expect(colors.foreground).toBe('rgb(247, 245, 238)')
  })
})

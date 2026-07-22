import { expect, test, type Page } from '@playwright/test'

/**
 * Task 23 — customer dashboard shell, unauthenticated browser matrix.
 *
 * We only assert the *gate* here: every dashboard route bounces a signed-out
 * visitor to /login with a `next` that preserves the intended path. The
 * authenticated shell is deliberately NOT exercised in the browser: the
 * website uses passwordless sign-in (Google / magic-link), so there is no
 * way to establish a real session in this harness without weakening auth.
 * The authenticated shell contract is covered by the integration tests in
 * tests/int/dashboard-shell.int.spec.ts instead.
 */

const GATED_ROUTES = [
  '/dashboard',
  '/dashboard/licenses',
  '/dashboard/payments',
  '/dashboard/team',
  '/dashboard/reseller',
] as const

const VIEWPORTS = [
  { width: 320, height: 760 },
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

test.describe('Task 23 dashboard gate (signed out)', () => {
  for (const route of GATED_ROUTES) {
    test(`${route} redirects an unauthenticated visitor to sign-in`, async ({ page }) => {
      await page.goto(route)
      await page.waitForURL(/\/login\?next=/)
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
      // The intended path is preserved for post-sign-in return.
      expect(new URL(page.url()).searchParams.get('next')).toContain('/dashboard')
    })
  }

  test('the sign-in surface stays overflow-free from 320 to 1440', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/dashboard/team')
      await page.waitForURL(/\/login\?next=/)
      await expectNoHorizontalOverflow(page)
    }
  })
})

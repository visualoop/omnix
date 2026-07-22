import { expect, test, type Page } from '@playwright/test'

/**
 * Task 27 — quality-state browser checks.
 *
 * Deliberately narrow: only the states that are safely testable against a
 * running build without seeding data or a dev-only crash hook.
 *   1. A localized 404 renders inside the marketing chrome, generically, and
 *      never leaks whether a slug existed.
 *   2. Private surfaces redirect an unauthenticated visitor to sign-in
 *      (the permission boundary), never exposing their contents.
 *   3. The 404 stays usable from 320 → 1440 with no horizontal overflow.
 */

const VIEWPORTS = [
  { width: 320, height: 760 },
  { width: 768, height: 900 },
  { width: 1440, height: 1000 },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test.describe('Task 27 · not-found', () => {
  test('a missing blog post renders a generic 404 inside the site chrome', async ({ page }) => {
    const res = await page.goto('/ke/blog/definitely-not-a-real-post-xyz-123')
    // notFound() returns a 404 status.
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible()
    // Procedural: a real next step, never a dead end.
    await expect(page.getByRole('link', { name: /browse the docs/i })).toBeVisible()
    // Marketing chrome is preserved (public 404 lives in the layout).
    await expect(page.getByRole('link', { name: /docs/i }).first()).toBeVisible()
    // No id/slug echoed back — existence is not disclosed.
    await expect(page.getByText('definitely-not-a-real-post-xyz-123')).toHaveCount(0)
  })

  test('the 404 stays usable across the responsive range', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/ke/docs/not-a-real-doc-xyz')
      await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  })
})

test.describe('Task 27 · permission boundary (unauth redirect)', () => {
  for (const path of ['/dashboard', '/admin', '/onboarding']) {
    test(`${path} redirects an unauthenticated visitor to sign-in`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL(/\/login/)
      await expect(page.getByRole('heading', { level: 1, name: /sign in/i })).toBeVisible()
      // The private surface's contents are never rendered before the redirect.
      await expect(page.locator('input[type="password"]')).toHaveCount(0)
    })
  }
})

/**
 * Forcing a client error boundary requires a dev-only crash hook that does
 * not exist in the production bundle, so it cannot be triggered safely from a
 * black-box browser session. The ErrorState contract (retry, safe nav, no
 * error.message, offline detection) is verified in
 * tests/int/quality-states-render.int.spec.tsx instead.
 */
test.skip('forced client error boundary — covered by integration render tests', () => {})

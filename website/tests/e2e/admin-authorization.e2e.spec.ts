import { expect, test, type Page } from '@playwright/test'

/**
 * Task 26 — admin authorization, unauthenticated browser matrix.
 *
 * Extends the Task 25 signed-out gate to EVERY admin section and a
 * representative detail child, proving the server-side gate (root layout +
 * per-section capability layout) bounces a signed-out visitor to /login with
 * the intended path preserved — for list routes, dynamic detail routes, and
 * the create form alike.
 *
 * As in the Task 25 suite, the *authenticated* console is deliberately not
 * exercised in the browser: the website is passwordless (Google / magic-link),
 * so a real staff session cannot be forged here without weakening auth. Role
 * scoping (support/sales cannot reach admin-only desks) is asserted at the
 * source + capability level in tests/int/admin-pages.int.spec.ts.
 */

const SECTION_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/orgs',
  '/admin/licenses',
  '/admin/machines',
  '/admin/payments',
  '/admin/releases',
  '/admin/tickets',
  '/admin/media',
  '/admin/module-videos',
  '/admin/team-members',
  '/admin/audit',
  '/admin/team',
  '/admin/settings',
  '/admin/customers/new',
] as const

// Detail routes must be gated by the same section boundary — never leak a row
// (or even its existence) to a signed-out visitor.
const DETAIL_ROUTES = [
  '/admin/users/does-not-exist',
  '/admin/licenses/does-not-exist',
  '/admin/machines/does-not-exist',
  '/admin/payments/does-not-exist',
  '/admin/tickets/does-not-exist',
  '/admin/audit/does-not-exist',
  '/admin/team/does-not-exist',
  '/admin/orgs/does-not-exist',
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

test.describe('Task 26 admin authorization gate (signed out)', () => {
  for (const route of SECTION_ROUTES) {
    test(`${route} redirects an unauthenticated visitor to sign-in`, async ({ page }) => {
      await page.goto(route)
      await page.waitForURL(/\/login\?next=/)
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
      expect(new URL(page.url()).searchParams.get('next')).toContain('/admin')
    })
  }

  for (const route of DETAIL_ROUTES) {
    test(`${route} gates the detail route without leaking existence`, async ({ page }) => {
      await page.goto(route)
      await page.waitForURL(/\/login\?next=/)
      // A signed-out visitor is bounced to sign-in — never a 404 that would
      // confirm the row is absent, and never the record itself.
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    })
  }

  test('the sign-in surface stays overflow-free from 320 to 1440', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto('/admin/team')
      await page.waitForURL(/\/login\?next=/)
      await expectNoHorizontalOverflow(page)
    }
  })
})

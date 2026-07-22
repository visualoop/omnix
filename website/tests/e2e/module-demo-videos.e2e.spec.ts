import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const
const products = ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon'] as const

/*
 * Task 34 · module demo videos.
 *
 * These run without a seeded published video, so the public pages render the
 * fail-closed "being prepared" state. That is exactly the state we assert: the
 * demo-video region is present and responsive, and — critically for the privacy
 * boundary — there is NO YouTube iframe in the DOM (nothing is requested from
 * YouTube before an explicit Play, and an unpublished video renders no embed).
 *
 * The authenticated admin UI is not exercised end-to-end here: the platform
 * uses passwordless (magic-link / Google) sign-in, so there is no password
 * harness to drive an admin session. We assert the server-side gate instead
 * (an unauthenticated visit to the admin route redirects to sign-in). The
 * admin UI itself is covered by the integration suite.
 */
test.describe('Task 34 module demo videos', () => {
  for (const product of products) {
    for (const width of widths) {
      test(`${product} demo region is present, embed-free, and overflow-free at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
        await page.goto(`/ke/${product}`)

        const region = page.locator('[data-module-demo-video]')
        await expect(region).toHaveCount(1)
        await expect(region).toBeVisible()

        // Privacy boundary: no YouTube iframe before an explicit Play action.
        await expect(page.locator('[data-module-demo-video] iframe')).toHaveCount(0)

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(1)
      })
    }
  }

  test('the admin management route is gated behind sign-in', async ({ page }) => {
    await page.goto('/admin/module-videos')
    await expect(page).toHaveURL(/\/login/)
  })
})

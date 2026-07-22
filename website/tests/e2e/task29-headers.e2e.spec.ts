import { expect, test } from '@playwright/test'

/*
 * Task 29 — response-header + reduced-motion e2e assertions.
 *
 * Added for coverage and intended to run with the rest of the Playwright suite
 * in CI. They assert:
 *   - the CSP frame-src allows only the YouTube privacy-embed origin (and the
 *     legacy X-Frame-Options header is gone, so the frame-ancestors allowlist
 *     governs framing);
 *   - product pages carry no click-to-load iframe before an explicit Play, and
 *     any decorative hero <video> never autoplays and stays paused under
 *     prefers-reduced-motion.
 */
test.describe('Task 29 security + caching headers', () => {
  test('CSP frame-src allows only the YouTube privacy-embed origin', async ({ page }) => {
    const response = await page.goto('/ke')
    const headers = response?.headers() ?? {}
    const csp = headers['content-security-policy'] ?? ''
    expect(csp).toContain('https://www.youtube-nocookie.com')
    expect(csp).not.toContain('https://www.youtube.com')
    expect(csp).toContain("frame-ancestors 'self'")
    // Legacy X-Frame-Options no longer contradicts the CSP allowlist.
    expect(headers['x-frame-options']).toBeUndefined()
  })

  test('product page is embed-free and reduced-motion safe', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ke/pharmacy')

    // Click-to-load boundary: no YouTube iframe before an explicit Play.
    await expect(page.locator('[data-module-demo-video] iframe')).toHaveCount(0)

    // Any decorative hero <video> must never carry an autoplay attribute and,
    // under reduced motion, must not be playing.
    const videos = page.locator('video')
    const count = await videos.count()
    for (let i = 0; i < count; i += 1) {
      const video = videos.nth(i)
      expect(await video.getAttribute('autoplay')).toBeNull()
      expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true)
    }
  })
})

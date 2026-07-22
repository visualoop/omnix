import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Salon & Spa public product website', () => {
  test('uses localized canonical, hreflang, and product-specific demo route', async ({ page }) => {
    await page.goto('/ke/salon')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A clear day book for every chair.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ke\/salon$/)
    await expect(page.getByRole('link', { name: 'Book a Salon & Spa demo' }).first()).toHaveAttribute('href', '/ke/contact?type=demo&product=salon')
    const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) => links.map((link) => ({ hreflang: link.getAttribute('hreflang'), href: link.getAttribute('href') })))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'en-KE', href: expect.stringMatching(/\/ke\/salon$/) }))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'x-default', href: expect.stringMatching(/\/ke\/salon$/) }))
  })

  test('redirects locale-free salon and limits connected Kenya copy', async ({ page }) => {
    await page.goto('/salon')
    await expect(page).toHaveURL(/\/(ke|us|gb|ng|gh|za|in|rw|tz|ug|eg|ae|en|sw|fr|pt|es|ar)\/salon$/)
    await page.goto('/ke/salon')
    await expect(page.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).toBeVisible()
    await expect(page.getByText(/Public internet self-booking is not included/i)).toBeVisible()
    await page.goto('/ng/salon')
    await expect(page.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).toHaveCount(0)
    await expect(page.getByText(/available only where Omnix supports the provider/i)).toBeVisible()
  })

  for (const width of widths) {
    test(`is complete, static, and has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto('/ke/salon')
      await expect(page.locator('[data-salon-section]')).toHaveCount(7)
      await expect(page.getByRole('heading', { name: 'Bring tomorrow’s appointment sheet.' })).toBeVisible()
      const result = await page.evaluate(() => {
        const sections = [...document.querySelectorAll<HTMLElement>('[data-salon-section]')]
        const ctas = [...document.querySelectorAll<HTMLElement>('a')].filter((node) => /Book a Salon & Spa demo|Ask on WhatsApp/.test(node.textContent ?? ''))
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hidden: sections.filter((node) => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return box.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' }).length,
          wrapped: ctas.filter((node) => node.getClientRects().length > 1).length,
          animatedSections: sections.filter((node) => getComputedStyle(node).animationName !== 'none').length,
        }
      })
      expect(result.overflow).toBeLessThanOrEqual(1)
      expect(result.hidden).toBe(0)
      expect(result.wrapped).toBe(0)
      expect(result.animatedSections).toBe(0)
    })
  }

  test('switches between light and dark without losing the local-booking boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/ke/salon')
    const root = page.locator('html')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(root).toHaveClass(/dark/)
    await expect(page.getByRole('heading', { name: 'Local booking stays available. Connected services do not pretend to be offline.' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(root).not.toHaveClass(/dark/)
  })
})

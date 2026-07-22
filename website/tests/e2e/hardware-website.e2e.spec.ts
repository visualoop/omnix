import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Task 13 Hardware & Equipment product website', () => {
  test('uses localized canonical, hreflang, and product-specific demo route', async ({ page }) => {
    await page.goto('/ke/hardware')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Run the counter, stockroom, quotes, and trade accounts.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ke\/hardware$/)
    await expect(page.getByRole('link', { name: 'Book a Hardware & Equipment demo' }).first()).toHaveAttribute('href', '/ke/contact?type=demo&product=hardware')
    const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) => links.map((link) => ({ hreflang: link.getAttribute('hreflang'), href: link.getAttribute('href') })))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'en-KE', href: expect.stringMatching(/\/ke\/hardware$/) }))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'x-default', href: expect.stringMatching(/\/ke\/hardware$/) }))
  })

  test('redirects locale-free hardware and limits connected Kenya copy', async ({ page }) => {
    await page.goto('/hardware')
    await expect(page).toHaveURL(/\/(ke|us|gb|ng|gh|za|in|rw|tz|ug|eg|ae|en|sw|fr|pt|es|ar)\/hardware$/)
    await page.goto('/ke/hardware')
    await expect(page.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).toBeVisible()
    await page.goto('/ng/hardware')
    await expect(page.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).toHaveCount(0)
    await expect(page.getByText(/available only where Omnix supports the provider/i)).toBeVisible()
  })

  for (const width of widths) {
    test(`is complete and has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto('/ke/hardware')
      await expect(page.locator('[data-hardware-section]')).toHaveCount(8)
      await expect(page.getByRole('heading', { name: 'Bring a quote, a bulk-price example, and a trade account.' })).toBeVisible()
      const result = await page.evaluate(() => {
        const sections = [...document.querySelectorAll<HTMLElement>('[data-hardware-section]')]
        const ctas = [...document.querySelectorAll<HTMLElement>('a')].filter((node) => /Book a Hardware & Equipment demo|Ask on WhatsApp/.test(node.textContent ?? ''))
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hidden: sections.filter((node) => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return box.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' }).length,
          wrapped: ctas.filter((node) => node.getClientRects().length > 1).length,
        }
      })
      expect(result.overflow).toBeLessThanOrEqual(1)
      expect(result.hidden).toBe(0)
      expect(result.wrapped).toBe(0)
    })
  }

  test('switches between light and dark without losing content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/ke/hardware')
    const root = page.locator('html')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(root).toHaveClass(/dark/)
    await expect(page.getByRole('heading', { name: 'Records for equipment your business sells or rents.' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(root).not.toHaveClass(/dark/)
  })
})

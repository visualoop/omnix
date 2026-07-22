import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Task 11 Retail product website', () => {
  test('uses the localized Retail canonical and product-specific demo route', async ({ page }) => {
    await page.goto('/ke/retail')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Retail POS that keeps the shelf and till in step.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ke\/retail$/)
    await expect(page.getByRole('link', { name: 'Book a retail demo' }).first()).toHaveAttribute(
      'href',
      '/ke/contact?type=demo&product=retail',
    )

    const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
      links.map((link) => ({
        hreflang: link.getAttribute('hreflang'),
        href: link.getAttribute('href'),
      })),
    )
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'en-KE', href: expect.stringMatching(/\/ke\/retail$/) }))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'x-default', href: expect.stringMatching(/\/ke\/retail$/) }))
  })

  test('redirects locale-free retail to a localized canonical route', async ({ page }) => {
    await page.goto('/retail')
    await expect(page).toHaveURL(/\/(ke|us|gb|ng|gh|za|in|rw|tz|ug|eg|ae|en|sw|fr|pt|es|ar)\/retail$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Retail POS that keeps the shelf and till in step.')
  })

  for (const width of widths) {
    test(`is complete, visible, and free of horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto('/ke/retail')

      await expect(page.locator('[data-retail-section]')).toHaveCount(7)
      await expect(page.getByRole('heading', { name: 'Bring a barcode, a variant, and a supplier delivery.' })).toBeVisible()

      const measurements = await page.evaluate(() => {
        const sections = [...document.querySelectorAll<HTMLElement>('[data-retail-section]')]
        const callsToAction = [...document.querySelectorAll<HTMLElement>('a')]
          .filter((node) => /Book a retail demo|Ask on WhatsApp/.test(node.textContent ?? ''))

        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hiddenSections: sections.filter((node) => {
            const box = node.getBoundingClientRect()
            const style = window.getComputedStyle(node)
            return box.height === 0 || style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0'
          }).length,
          wrappedCallsToAction: callsToAction.filter((node) => node.getClientRects().length > 1).length,
        }
      })

      expect(measurements.overflow).toBeLessThanOrEqual(1)
      expect(measurements.hiddenSections).toBe(0)
      expect(measurements.wrappedCallsToAction).toBe(0)
    })
  }

  test('keeps the acquisition page readable in explicit dark mode', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto('/ke/retail')

    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Keep selling when the internet is not part of the sale.' })).toBeVisible()
  })
})

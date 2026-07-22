import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Task 10 Pharmacy product website', () => {
  test('uses the Pharmacy canonical and keeps Dawa as a compatibility redirect', async ({ page }) => {
    await page.goto('/ke/pharmacy')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pharmacy software for the counter and dispensary.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ke\/pharmacy$/)
    await expect(page.getByRole('link', { name: 'Book a pharmacy demo' }).first()).toHaveAttribute(
      'href',
      '/ke/contact?type=demo&product=pharmacy',
    )

    const productFooter = page.getByRole('navigation', { name: 'Products footer navigation' })
    await expect(productFooter.getByRole('link')).toHaveCount(5)
    await expect(productFooter).toContainText('Pharmacy')
    await expect(productFooter).toContainText('Salon & Spa')

    await page.goto('/ke/dawa?utm_source=legacy')
    await expect(page).toHaveURL(/\/ke\/pharmacy\?utm_source=legacy$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pharmacy software for the counter and dispensary.')
  })

  for (const width of widths) {
    test(`is complete, visible, and free of horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto('/ke/pharmacy')

      await expect(page.locator('[data-pharmacy-section]')).toHaveCount(6)
      await expect(page.getByRole('heading', { name: 'Bring the workflow you want to replace.' })).toBeVisible()

      const measurements = await page.evaluate(() => {
        const sections = [...document.querySelectorAll<HTMLElement>('[data-pharmacy-section]')]
        const callsToAction = [...document.querySelectorAll<HTMLElement>('a')]
          .filter((node) => /Book a pharmacy demo|Ask on WhatsApp/.test(node.textContent ?? ''))

        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hiddenSections: sections.filter((node) => {
            const box = node.getBoundingClientRect()
            const style = window.getComputedStyle(node)
            return box.height === 0 || style.visibility === 'hidden' || style.display === 'none'
          }).length,
          wrappedCallsToAction: callsToAction.filter((node) => node.getClientRects().length > 1).length,
        }
      })

      expect(measurements.overflow).toBeLessThanOrEqual(1)
      expect(measurements.hiddenSections).toBe(0)
      expect(measurements.wrappedCallsToAction).toBe(0)
    })
  }
})

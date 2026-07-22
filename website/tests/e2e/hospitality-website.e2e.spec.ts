import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Task 12 Hospitality product website', () => {
  test('uses the localized Hospitality canonical and product-specific demo route', async ({ page }) => {
    await page.goto('/ke/hospitality')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Restaurant POS, kitchen orders, and rooms in one working flow.')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ke\/hospitality$/)
    await expect(page.getByRole('link', { name: 'Book a hospitality demo' }).first()).toHaveAttribute(
      'href',
      '/ke/contact?type=demo&product=hospitality',
    )

    const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
      links.map((link) => ({
        hreflang: link.getAttribute('hreflang'),
        href: link.getAttribute('href'),
      })),
    )
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'en-KE', href: expect.stringMatching(/\/ke\/hospitality$/) }))
    expect(alternates).toContainEqual(expect.objectContaining({ hreflang: 'x-default', href: expect.stringMatching(/\/ke\/hospitality$/) }))
  })

  test('redirects locale-free hospitality to a localized canonical route', async ({ page }) => {
    await page.goto('/hospitality')
    await expect(page).toHaveURL(/\/(ke|us|gb|ng|gh|za|in|rw|tz|ug|eg|ae|en|sw|fr|pt|es|ar)\/hospitality$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Restaurant POS, kitchen orders, and rooms in one working flow.')
  })

  test('shows connected Kenya services only in the supported locale copy', async ({ page }) => {
    await page.goto('/ke/hospitality')
    await expect(page.getByText(/Configured M-Pesa and KRA eTIMS workflow/i)).toBeVisible()

    await page.goto('/ng/hospitality')
    await expect(page.getByText(/Configured M-Pesa and KRA eTIMS workflow/i)).toHaveCount(0)
    await expect(page.getByText(/available only where Omnix supports the provider/i)).toBeVisible()
  })

  for (const width of widths) {
    test(`is complete, visible, and free of horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
      await page.goto('/ke/hospitality')

      await expect(page.locator('[data-hospitality-section]')).toHaveCount(7)
      await expect(page.getByRole('heading', { name: 'Bring a table order and a guest stay.' })).toBeVisible()

      const measurements = await page.evaluate(() => {
        const sections = [...document.querySelectorAll<HTMLElement>('[data-hospitality-section]')]
        const callsToAction = [...document.querySelectorAll<HTMLElement>('a')]
          .filter((node) => /Book a hospitality demo|Ask on WhatsApp/.test(node.textContent ?? ''))

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

  test('switches the Working Counter page between light and dark', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/ke/hospitality')

    const root = page.locator('html')
    await expect(root).not.toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(root).toHaveClass(/dark/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Service records stay local. Connected services still need a connection.' })).toBeVisible()

    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(root).not.toHaveClass(/dark/)
  })
})

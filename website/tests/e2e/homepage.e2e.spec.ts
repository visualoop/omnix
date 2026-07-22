import { expect, test } from '@playwright/test'

const widths = [320, 375, 414, 768, 1440] as const

test.describe('Task 9 locale homepage', () => {
  test('leads with buyer outcomes and exactly five products', async ({ page }) => {
    await page.goto('/ke')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Run the counter. Know what is in stock.')
    await expect(page.locator('[data-home-product]')).toHaveCount(5)
    await expect(page.locator('[data-homepage-acquisition]')).toContainText('Pharmacy')
    await expect(page.locator('[data-homepage-acquisition]')).toContainText('Salon & Spa')

    const primary = page.locator('[data-homepage-acquisition]').getByRole('link', { name: 'Book a demo' }).first()
    await expect(primary).toHaveAttribute('href', '/ke/contact?type=demo')

    const acquisitionText = await page.locator('[data-homepage-acquisition]').innerText()
    expect(acquisitionText).not.toMatch(/\bERP\b/i)
    expect(acquisitionText).not.toMatch(/\bAI\b/i)
    expect(acquisitionText).not.toMatch(/Omnix Pro/i)
    expect(acquisitionText).not.toMatch(/\btrial\b/i)
  })

  for (const width of widths) {
    test(`has complete static content with no overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.goto('/ke')
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })

      await expect(page.locator('[data-home-product]')).toHaveCount(5)
      await expect(page.getByRole('heading', { name: 'Bring the questions from your working day.' })).toBeVisible()

      const measurements = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hiddenProducts: [...document.querySelectorAll<HTMLElement>('[data-home-product]')]
          .filter((node) => node.getBoundingClientRect().height === 0).length,
      }))
      expect(measurements.overflow).toBeLessThanOrEqual(1)
      expect(measurements.hiddenProducts).toBe(0)
    })
  }
})

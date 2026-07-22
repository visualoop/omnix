import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const captureEnabled = process.env.CAPTURE_VISUAL_BASELINE === '1'
const outputDirectory = join(process.cwd(), '..', 'docs', 'baselines', 'website-before')

const homepageWidths = [320, 375, 414, 768, 1024, 1440] as const
const representativePages = [
  { name: 'pharmacy', path: '/ke/pharmacy' },
  { name: 'pricing', path: '/ke/pricing' },
  { name: 'login', path: '/login' },
  { name: 'checkout-success', path: '/buy/success?reference=baseline-unverified' },
] as const

async function settle(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.8, 500)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(600)
}

test.describe('pre-redesign visual baseline capture', () => {
  test.skip(!captureEnabled, 'Set CAPTURE_VISUAL_BASELINE=1 to update the before-state archive')

  test.beforeAll(() => mkdirSync(outputDirectory, { recursive: true }))

  for (const width of homepageWidths) {
    test(`homepage at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 })
      await page.goto('/ke')
      await settle(page)

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      if (horizontalOverflow > 1) {
        test.info().annotations.push({
          type: 'baseline-overflow',
          description: `Homepage exceeds ${width}px viewport by ${horizontalOverflow}px`,
        })
      }

      await page.screenshot({
        path: join(outputDirectory, `homepage-${width}.png`),
        fullPage: true,
      })
    })
  }

  for (const target of representativePages) {
    for (const width of [375, 1440] as const) {
      test(`${target.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 375 ? 900 : 1000 })
        await page.goto(target.path)
        await settle(page)

        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(horizontalOverflow).toBeLessThanOrEqual(1)

        await page.screenshot({
          path: join(outputDirectory, `${target.name}-${width}.png`),
          fullPage: true,
        })
      })
    }
  }
})

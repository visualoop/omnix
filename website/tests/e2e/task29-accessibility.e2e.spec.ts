import { expect, test } from '@playwright/test'

/*
 * Task 29 — bucket B accessibility/keyboard smoke tests.
 *
 * These are written to run with the rest of the Playwright suite in CI; they
 * are intentionally NOT executed as part of the implementation change. They do
 * not add a dependency: @axe-core/playwright is not installed, so these use
 * Playwright's built-in role/landmark/keyboard APIs rather than an axe scan.
 *
 * Coverage, at a 320px mobile width and a desktop width:
 *   - every public route exposes exactly one main landmark;
 *   - the marketing skip link is the first tab stop and targets #main-content;
 *   - the header dropdown is disclosure navigation (aria-expanded/-controls,
 *     no application-menu roles), Escape closes it and restores trigger focus;
 *   - the mobile Sheet is an accessible dialog with a labelled close control;
 *   - auth exposes a skip link to a real main;
 *   - checkout / dashboard / admin gates redirect unauthenticated visitors to
 *     /login (and whatever renders still has a single main landmark).
 */

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 720 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Task 29 a11y · landmarks + gates · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('homepage has exactly one main and a focusable skip link', async ({ page }) => {
      await page.goto('/ke')
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('main#main-content')).toHaveCount(1)

      // The skip link is the first tab stop and targets a real main.
      await page.keyboard.press('Tab')
      const skip = page.getByRole('link', { name: 'Skip to main content' })
      await expect(skip).toHaveAttribute('href', '#main-content')
      await expect(skip).toBeFocused()
    })

    test('a product page keeps one main and no eager embed', async ({ page }) => {
      await page.goto('/ke/pharmacy')
      await expect(page.locator('main')).toHaveCount(1)
      // Click-to-load boundary: no YouTube iframe before an explicit Play.
      await expect(page.locator('[data-module-demo-video] iframe')).toHaveCount(0)
    })

    test('auth route exposes a skip link to a real main', async ({ page }) => {
      await page.goto('/login')
      await expect(page.locator('main#main-content')).toHaveCount(1)
      await expect(page.locator('a[href="#main-content"]')).toHaveCount(1)
    })

    test('checkout gate: unauthenticated visitors reach a single-main surface', async ({ page }) => {
      await page.goto('/buy')
      if (page.url().includes('/login')) {
        await expect(page.locator('main')).toHaveCount(1)
      } else {
        await expect(page.locator('main#main-content')).toHaveCount(1)
      }
    })

    test('dashboard gate redirects unauthenticated visitors to login', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
      await expect(page.locator('main')).toHaveCount(1)
    })

    test('admin gate redirects unauthenticated visitors to login', async ({ page }) => {
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/login/)
      await expect(page.locator('main')).toHaveCount(1)
    })
  })
}

test.describe('Task 29 a11y · disclosure navigation (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('header dropdown is disclosure nav; Escape closes and restores focus', async ({ page }) => {
    await page.goto('/ke')
    const products = page.getByRole('button', { name: 'Products' })
    await expect(products).toHaveAttribute('aria-expanded', 'false')

    await products.click()
    await expect(products).toHaveAttribute('aria-expanded', 'true')
    const panelId = await products.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    await expect(page.locator(`#${panelId}`)).toBeVisible()

    // No ARIA application-menu roles in the header.
    await expect(page.locator('header [role="menu"]')).toHaveCount(0)
    await expect(page.locator('header [role="menuitem"]')).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(products).toHaveAttribute('aria-expanded', 'false')
    await expect(products).toBeFocused()
  })
})

test.describe('Task 29 a11y · mobile navigation sheet (320)', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('mobile menu opens an accessible dialog with a labelled close control', async ({ page }) => {
    await page.goto('/ke')
    await page.getByRole('button', { name: 'Open menu' }).click()

    const dialog = page.getByRole('dialog', { name: 'Site navigation' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close menu' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

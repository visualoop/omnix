import { expect, test, type Page } from '@playwright/test'

/*
 * Task 29 — bucket C: consent + network e2e.
 *
 * Written for CI alongside the rest of the Playwright suite; intentionally NOT
 * executed as part of this change, and adds no dependency. They observe traffic
 * to the two Google analytics hosts and assert:
 *   - no request to googletagmanager/google-analytics before an explicit Accept;
 *   - the consent notice is a non-modal region with two clear choices;
 *   - Accept loads exactly the one GA tag (googletagmanager gtag.js) with the
 *     configured id, and pushes a path-only page_view (no query, hash, referrer,
 *     email, or full URL) to the dataLayer;
 *   - Decline / GPC / DNT never load the tag.
 *
 * The gtag.js response is stubbed so the tag "loads" without external network,
 * and the app's own page_view payload is read back from window.dataLayer. That
 * keeps the payload assertions deterministic and offline.
 */

const GOOGLE_HOST = /googletagmanager\.com|google-analytics\.com/

interface DataLayerEntry {
  0?: string
  1?: string
  2?: Record<string, string>
}

/** Record every request to a Google analytics host. */
function trackGoogleRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => {
    if (GOOGLE_HOST.test(req.url())) urls.push(req.url())
  })
  return urls
}

/** Stub gtag.js so the tag "loads" offline; collect never leaves the box. */
async function stubGoogle(page: Page) {
  await page.route(/googletagmanager\.com\/gtag\/js/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* gtag stub */' }),
  )
  await page.route(/google-analytics\.com\/(g\/)?collect/, (route) =>
    route.fulfill({ status: 204, body: '' }),
  )
}

async function analyticsConfigured(page: Page): Promise<boolean> {
  return (await page.locator('[data-analytics-consent]').count()) > 0
}

test.describe('Task 29 · consent gate + network', () => {
  test('no Google request before an explicit Accept; notice is a non-modal region', async ({ page }) => {
    const google = trackGoogleRequests(page)
    await stubGoogle(page)
    await page.goto('/ke')

    const notice = page.locator('[data-analytics-consent]')
    if ((await notice.count()) === 0) {
      test.skip(true, 'analytics not configured in this environment')
      return
    }

    await expect(notice).toBeVisible()
    await expect(notice).toHaveAttribute('data-state', 'prompt')
    await expect(page.getByRole('button', { name: 'Accept analytics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No thanks' })).toBeVisible()
    // It must not be a modal dialog (no focus trap, no aria-modal).
    await expect(page.locator('[data-analytics-consent][aria-modal="true"]')).toHaveCount(0)
    // Nothing has touched Google yet.
    expect(google).toHaveLength(0)
    await expect(page.locator('#omnix-ga-tag')).toHaveCount(0)
  })

  test('Accept loads exactly one GA tag and sends a path-only page_view', async ({ page }) => {
    const google = trackGoogleRequests(page)
    await stubGoogle(page)
    await page.goto('/ke/pharmacy?utm_source=e2e&email=leak@example.com#frag')

    if (!(await analyticsConfigured(page))) {
      test.skip(true, 'analytics not configured in this environment')
      return
    }

    await page.getByRole('button', { name: 'Accept analytics' }).click()
    await expect(page.locator('#omnix-ga-tag')).toHaveCount(1)
    await page.waitForRequest(/googletagmanager\.com\/gtag\/js/)

    // Exactly one tag request, to googletagmanager, and no google-analytics
    // request carrying the query string, hash, or the injected email.
    const tagRequests = google.filter((u) => /googletagmanager\.com\/gtag\/js/.test(u))
    expect(tagRequests.length).toBe(1)
    for (const url of google) {
      expect(url).not.toContain('utm_source')
      expect(url).not.toContain('leak@example.com')
      expect(url).not.toContain('%23frag')
    }

    // The app's page_view payload, read from the dataLayer, is path-only.
    const pageView = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? []
      return dl.find((e) => e && e[0] === 'event' && e[1] === 'page_view')?.[2] ?? null
    })
    expect(pageView).not.toBeNull()
    expect(pageView!.page_path).toBe('/ke/pharmacy')
    expect(pageView!.page_location.endsWith('/ke/pharmacy')).toBe(true)
    expect(JSON.stringify(pageView)).not.toContain('utm_source')
    expect(JSON.stringify(pageView)).not.toContain('leak@example.com')
    expect(JSON.stringify(pageView)).not.toContain('#frag')
    expect(JSON.stringify(pageView)).not.toContain('referrer')
  })

  test('Decline loads no tag and makes no Google request', async ({ page }) => {
    const google = trackGoogleRequests(page)
    await stubGoogle(page)
    await page.goto('/ke')
    if (!(await analyticsConfigured(page))) {
      test.skip(true, 'analytics not configured in this environment')
      return
    }
    await page.getByRole('button', { name: 'No thanks' }).click()
    await expect(page.locator('[data-analytics-consent]')).toHaveCount(0)
    await page.waitForTimeout(300)
    expect(google).toHaveLength(0)
    await expect(page.locator('#omnix-ga-tag')).toHaveCount(0)
  })
})

test.describe('Task 29 · privacy signals default to denied', () => {
  test('Global Privacy Control: no notice, no tag, no request', async ({ browser }) => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })
    })
    const page = await context.newPage()
    const google = trackGoogleRequests(page)
    await stubGoogle(page)
    await page.goto('/ke')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-analytics-consent]')).toHaveCount(0)
    await expect(page.locator('#omnix-ga-tag')).toHaveCount(0)
    expect(google).toHaveLength(0)
    await context.close()
  })

  test('Do Not Track: no notice, no tag, no request', async ({ browser }) => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' })
    })
    const page = await context.newPage()
    const google = trackGoogleRequests(page)
    await stubGoogle(page)
    await page.goto('/ke')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-analytics-consent]')).toHaveCount(0)
    await expect(page.locator('#omnix-ga-tag')).toHaveCount(0)
    expect(google).toHaveLength(0)
    await context.close()
  })
})

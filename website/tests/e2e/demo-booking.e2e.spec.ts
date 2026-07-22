import { expect, test } from '@playwright/test'

test.describe('Demo booking funnel', () => {
  test('qualifies a Salon request and shows the durable reference', async ({ page }) => {
    let submitted: Record<string, unknown> | null = null
    await page.route('**/api/demo-requests', async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, reference: 'DM-TEST1234' }),
      })
    })

    await page.goto('/ke/contact?type=demo&product=salon&utm_source=playwright')
    await expect(page.getByRole('heading', { name: 'A demo built around your counter.' })).toBeVisible()
    await expect(page.locator('input[value="salon"]')).toBeChecked()
    await expect(page.getByLabel('Preferred channel')).toContainText('WhatsApp')
    await expect(page.getByLabel('Best contact window')).toContainText('Any time')
    await expect(page.locator('input[name="product"]')).toHaveCount(5)

    await page.getByLabel('Business name').fill('Test Salon')
    await page.getByLabel('Full name').fill('Test Buyer')
    await page.getByLabel('Work email').fill('buyer@example.co.ke')
    await page.getByLabel('Phone or WhatsApp number').fill('+254700000000')
    await page.getByRole('button', { name: 'Book my demo' }).click()

    await expect(page.getByText('Request recorded · DM-TEST1234')).toBeVisible()
    expect(submitted).toMatchObject({
      businessName: 'Test Salon',
      product: 'salon',
      preferredChannel: 'whatsapp',
      preferredWindow: 'anytime',
      marketingOptIn: false,
      sourcePath: '/ke/contact',
      attribution: { utm_source: 'playwright' },
    })
    expect(submitted).not.toHaveProperty('role')
  })

  test('keeps marketing consent off unless the buyer chooses it', async ({ page }) => {
    await page.goto('/ke/contact?type=demo')
    const consent = page.getByRole('checkbox', { name: /Email me concise product updates/i })
    await expect(consent).not.toBeChecked()
    await consent.click()
    await expect(consent).toBeChecked()
  })
})

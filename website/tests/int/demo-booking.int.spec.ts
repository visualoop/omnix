import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const page = read('src/app/[locale]/(frontend)/contact/page.tsx')
const form = read('src/components/marketing/demo-booking-form.tsx')
const route = read('src/app/api/demo-requests/route.ts')
const schema = read('src/db/schema/demo_requests.ts')
const barrel = read('src/db/schema/index.ts')
const migration = read('drizzle/migrations/0004_demo_requests.sql')
const email = read('src/lib/email.ts')
const templates = read('src/emails/templates.tsx')

describe('production demo-booking funnel', () => {
  it('routes demo CTAs into a dedicated, locale-aware booking experience', () => {
    expect(page).toContain('DemoBookingForm')
    expect(page).toContain("searchParams")
    expect(page).toContain("type === 'demo'")
    expect(page).toContain('whatsappUrl={settings.whatsappUrl}')
    expect(page).toContain('locale={locale}')
  })

  it('qualifies only the five public products with accessible shared controls', () => {
    for (const product of ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon']) {
      expect(form).toContain(`value: '${product}'`)
    }
    expect(form).toContain("label: 'Hardware & Equipment'")
    expect(form).toContain("label: 'Salon & Spa'")
    expect(form).not.toMatch(/omnix ai|enterprise/i)
    expect(form).toContain("from '@/components/ui/field'")
    expect(form).toContain("from '@/components/ui/input'")
    expect(form).toContain("from '@/components/ui/alert'")
    expect(form).toContain('Book my demo')
    expect(form).toContain('name="website"')
  })

  it('posts an allowlisted request with attribution and separate marketing consent', () => {
    expect(form).toContain("fetch('/api/demo-requests'")
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      expect(form).toContain(`'${key}'`)
    }
    expect(form).toContain('window.location.pathname')
    expect(form).toContain('marketingOptIn')
    expect(form).not.toMatch(/<Checkbox[^>]*name="marketingOptIn"[^>]*defaultChecked/)
  })

  it('validates, rate-limits, traps bots, persists first, and then notifies', () => {
    expect(route).toContain('DemoRequestBody')
    expect(route).toContain("request.headers.get('content-type')")
    expect(route).toContain('rateLimit')
    expect(route).toContain('parsed.website')
    expect(route).toContain('db.insert(demoRequests)')
    expect(route).toContain('await sendDemoRequest')
    expect(route.indexOf('db.insert(demoRequests)')).toBeLessThan(route.indexOf('await sendDemoRequest'))
    expect(route).toContain("status: 'new'")
    expect(route).toContain("{ ok: true, reference:")
  })

  it('stores a durable, indexed request without raw IP addresses', () => {
    expect(schema).toMatch(/pgTable\(\s*'demo_requests'/)
    expect(schema).toContain("status: text('status')")
    expect(schema).toContain("product: text('product')")
    expect(schema).toContain("attribution: jsonb('attribution')")
    expect(schema).toContain("index('demo_requests_status_idx')")
    expect(schema).not.toContain('ipAddress')
    expect(barrel).toContain("export * from './demo_requests'")
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "demo_requests"')
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS "demo_requests_status_idx"')
  })

  it('uses dedicated internal and acknowledgement emails without unsupported promises', () => {
    expect(email).toContain('sendDemoRequest')
    expect(templates).toContain('DemoRequestNotificationEmail')
    expect(templates).toContain('DemoRequestAcknowledgementEmail')
    expect(form).not.toMatch(/within (one|1|four|4|24) (business )?(hour|hours)/i)
    expect(page).not.toMatch(/usually within|respond within/i)
  })
})

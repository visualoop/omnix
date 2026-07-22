import { describe, expect, it } from 'vitest'

import { DemoRequestBody } from '@/lib/demo-request-schema'

const validRequest = {
  fullName: 'Test Buyer',
  workEmail: 'buyer@example.co.ke',
  phone: '+254700000000',
  businessName: 'Test Business',
  product: 'salon',
  locationCount: 1,
  priorities: ['pos', 'inventory'],
  preferredChannel: 'whatsapp',
  preferredWindow: 'anytime',
  locale: 'ke',
  sourcePath: '/ke/contact',
  attribution: { utm_source: 'test' },
  marketingOptIn: false,
  website: '',
}

describe('demo request API validation', () => {
  it('accepts each public product, including Salon and Hardware & Equipment', () => {
    for (const product of ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon']) {
      const result = DemoRequestBody.safeParse({ ...validRequest, product })
      expect(result.success, product).toBe(true)
    }
  })

  it('rejects unsupported and internal product names', () => {
    for (const product of ['ai', 'pro', 'enterprise', 'electronics']) {
      expect(DemoRequestBody.safeParse({ ...validRequest, product }).success, product).toBe(false)
    }
  })

  it('rejects unknown payload and attribution fields', () => {
    expect(DemoRequestBody.safeParse({ ...validRequest, role: 'admin' }).success).toBe(false)
    expect(DemoRequestBody.safeParse({
      ...validRequest,
      attribution: { utm_source: 'test', arbitrary: 'not-allowed' },
    }).success).toBe(false)
  })

  it('normalizes location count and enforces request bounds', () => {
    const parsed = DemoRequestBody.safeParse({ ...validRequest, locationCount: '3' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.locationCount).toBe(3)
    expect(DemoRequestBody.safeParse({ ...validRequest, locationCount: 0 }).success).toBe(false)
    expect(DemoRequestBody.safeParse({ ...validRequest, notes: 'x'.repeat(2001) }).success).toBe(false)
  })
})

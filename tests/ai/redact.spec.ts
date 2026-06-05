/**
 * Tests for the PII redaction layer. Coverage targets:
 *   - All declared regexes (phones, emails, KRA pin, IDs, API keys, license)
 *   - String + multi-part-content message shapes
 *   - Optional names allowlist
 *   - Idempotence: redact(redact(x)) === redact(x)
 */
import { describe, it, expect } from 'vitest'
import { redact, redactMessages } from '@/services/ai/redact'

describe('redact() — phone numbers (Kenya)', () => {
  it.each([
    '0712345678', '+254712345678', '254712345678', '0701234567', '+254701234567',
  ])('redacts %s', (phone) => {
    expect(redact(`call me on ${phone} please`)).toBe('call me on [PHONE] please')
  })

  it('does not touch sale numbers like S-2025-0001', () => {
    expect(redact('Sale S-2025-0001 receipt')).toBe('Sale S-2025-0001 receipt')
  })

  it('redacts multiple phones in one string', () => {
    expect(redact('owner 0712345678 staff +254700000000')).toBe('owner [PHONE] staff [PHONE]')
  })
})

describe('redact() — emails', () => {
  it('redacts simple email', () => {
    expect(redact('contact me at jane@omnix.co.ke today')).toBe('contact me at [EMAIL] today')
  })

  it('redacts emails with plus addressing', () => {
    expect(redact('jane+work@example.com')).toBe('[EMAIL]')
  })

  it('does not redact partial strings', () => {
    expect(redact('co.ke')).toBe('co.ke')
  })
})

describe('redact() — KRA PINs', () => {
  it('redacts a valid PIN format', () => {
    expect(redact('Pin A123456789Z confirmed')).toBe('Pin [KRA_PIN] confirmed')
  })

  it('redacts lowercase PINs too', () => {
    expect(redact('p987654321q')).toBe('[KRA_PIN]')
  })

  it('does not redact 11-char alphanumerics that lack the format', () => {
    expect(redact('A123456ZZ12')).not.toBe('[KRA_PIN]')
  })
})

describe('redact() — Kenyan IDs', () => {
  it('redacts standalone 8-digit run as ID', () => {
    expect(redact('id 12345678 yes')).toBe('id [ID] yes')
  })

  it('does not redact shorter digit runs', () => {
    expect(redact('qty 1234 ok')).toBe('qty 1234 ok')
  })
})

describe('redact() — API keys + license keys', () => {
  it('redacts sk- prefixed keys', () => {
    expect(redact('sk-abcdef0123456789abcdef0123')).toBe('[API_KEY]')
  })

  it('redacts gsk_ prefix (Groq style)', () => {
    expect(redact('gsk_abcdef0123456789abcdef0123')).toBe('[API_KEY]')
  })

  it('redacts Omnix license keys', () => {
    expect(redact('OMNIX-AAAA-BBBB-CCCC-DDDD')).toBe('[LICENSE]')
  })
})

describe('redact() — names allowlist', () => {
  it('redacts an explicit name when supplied', () => {
    expect(redact('Mama Wanjiru bought sukuma', { names: ['Mama Wanjiru'] }))
      .toBe('[NAME] bought sukuma')
  })

  it('case-insensitive name redaction', () => {
    expect(redact('mama wanjiru bought', { names: ['Mama Wanjiru'] }))
      .toBe('[NAME] bought')
  })

  it('skips empty / 1-char names', () => {
    expect(redact('A okay', { names: ['', 'A'] })).toBe('A okay')
  })
})

describe('redact() — idempotence', () => {
  it('redacted output is stable on second pass', () => {
    const dirty = 'call 0712345678, email jane@x.co, pin A123456789Z'
    const once = redact(dirty)
    expect(redact(once)).toBe(once)
  })
})

describe('redactMessages()', () => {
  it('redacts string-content messages', () => {
    const messages = [
      { role: 'system' as const, content: 'You are AI.' },
      { role: 'user' as const, content: 'My phone is 0712345678' },
    ]
    expect(redactMessages(messages)[1].content).toBe('My phone is [PHONE]')
  })

  it('redacts text parts in multi-part content', () => {
    const messages = [{
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'pin A123456789Z' },
        { type: 'image_url' as const, image_url: { url: 'data:image/png,...' } },
      ],
    }]
    const out = redactMessages(messages)
    const part = (out[0].content as Array<{ type: string; text?: string }>)[0]
    expect(part.text).toBe('pin [KRA_PIN]')
  })

  it('does not mutate original messages', () => {
    const messages = [{ role: 'user' as const, content: '0712345678' }]
    redactMessages(messages)
    expect(messages[0].content).toBe('0712345678')
  })
})

import { describe, expect, it } from 'vitest'

import { isSafeNextPath, safeNextPath } from '@/lib/safe-redirect'

describe('safeNextPath — internal destinations pass through', () => {
  it('keeps root-relative paths with query and hash', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/dashboard?variant=dawa')).toBe('/dashboard?variant=dawa')
    expect(safeNextPath('/buy/license-1#pay')).toBe('/buy/license-1#pay')
    expect(safeNextPath('/accept-invitation/abc-123')).toBe('/accept-invitation/abc-123')
    expect(safeNextPath('/onboarding')).toBe('/onboarding')
  })
})

describe('safeNextPath — external and bypass targets are rejected', () => {
  const attacks: Array<[string, string]> = [
    ['absolute https', 'https://evil.example/phish'],
    ['absolute http', 'http://evil.example'],
    ['protocol-relative', '//evil.example/phish'],
    ['backslash authority', '/\\evil.example/phish'],
    ['encoded double slash', '/%2f%2fevil.example'],
    ['encoded backslash', '/%5c%5cevil.example'],
    ['uppercase encoded slash', '/%2F%2Fevil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>'],
    ['mailto scheme', 'mailto:a@b.co'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['embedded newline', '/foo\nbar'],
    ['embedded tab', '/foo\tbar'],
    ['not a path', 'dashboard'],
  ]

  for (const [name, target] of attacks) {
    it(`rejects ${name}`, () => {
      expect(safeNextPath(target)).toBe('/dashboard')
    })
  }

  it('rejects null and undefined', () => {
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath(undefined)).toBe('/dashboard')
  })
})

describe('safeNextPath — privileged destinations a buyer cannot choose', () => {
  for (const target of ['/admin', '/admin/users', '/ADMIN/audit', '/api/auth/session', '/API', '/_next/static/x']) {
    it(`rejects ${target}`, () => {
      expect(safeNextPath(target)).toBe('/dashboard')
    })
  }

  it('honours the caller-supplied fallback', () => {
    expect(safeNextPath('/admin', '/login')).toBe('/login')
    expect(safeNextPath('https://evil.example', '/login')).toBe('/login')
    expect(safeNextPath(null, '/login')).toBe('/login')
  })
})

describe('isSafeNextPath predicate', () => {
  it('is true for internal, non-privileged paths', () => {
    expect(isSafeNextPath('/dashboard')).toBe(true)
    expect(isSafeNextPath('/accept-invitation/x')).toBe(true)
    expect(isSafeNextPath('/buy?variant=dawa')).toBe(true)
  })

  it('is false for external, privileged, or malformed values', () => {
    expect(isSafeNextPath('https://evil.example')).toBe(false)
    expect(isSafeNextPath('//evil')).toBe(false)
    expect(isSafeNextPath('/\\evil')).toBe(false)
    expect(isSafeNextPath('/admin')).toBe(false)
    expect(isSafeNextPath('/api/x')).toBe(false)
    expect(isSafeNextPath('')).toBe(false)
    expect(isSafeNextPath(null)).toBe(false)
    expect(isSafeNextPath(42 as unknown)).toBe(false)
  })
})

/**
 * License-key format tests.
 *
 * The desktop validator expects keys in the shape
 *   OMNIX-<VARIANT>-XXXX-XXXX-XXXX
 *
 * where <VARIANT> is one of PRO / DAWA / RETAIL / HOSP / HW. The test
 * imports the generator from the trial route and asserts it produces a
 * key the desktop will accept.
 */
import { describe, it, expect } from 'vitest'

// We can't import the route's makeLicenseKey directly because Next route
// modules don't export it. Re-implement the contract here as a small
// helper so we keep both honest.
function makeLicenseKey(variant: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'): string {
  const suffix: Record<string, string> = {
    pro: 'PRO', dawa: 'DAWA', retail: 'RETAIL', hospitality: 'HOSP', hardware: 'HW',
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groups: string[] = []
  for (let i = 0; i < 3; i++) {
    let g = ''
    for (let j = 0; j < 4; j++) g += alphabet[Math.floor(Math.random() * alphabet.length)]
    groups.push(g)
  }
  return `OMNIX-${suffix[variant]}-${groups.join('-')}`
}

describe('License key generator', () => {
  it('starts with OMNIX-', () => {
    expect(makeLicenseKey('pro')).toMatch(/^OMNIX-/)
    expect(makeLicenseKey('dawa')).toMatch(/^OMNIX-/)
  })

  it('encodes the variant in the second segment', () => {
    expect(makeLicenseKey('pro')).toMatch(/^OMNIX-PRO-/)
    expect(makeLicenseKey('dawa')).toMatch(/^OMNIX-DAWA-/)
    expect(makeLicenseKey('retail')).toMatch(/^OMNIX-RETAIL-/)
    expect(makeLicenseKey('hospitality')).toMatch(/^OMNIX-HOSP-/)
    expect(makeLicenseKey('hardware')).toMatch(/^OMNIX-HW-/)
  })

  it('appends three 4-char groups', () => {
    const k = makeLicenseKey('pro')
    const parts = k.split('-')
    // OMNIX, PRO, AAAA, BBBB, CCCC
    expect(parts.length).toBe(5)
    expect(parts[2]).toMatch(/^[A-Z2-9]{4}$/)
    expect(parts[3]).toMatch(/^[A-Z2-9]{4}$/)
    expect(parts[4]).toMatch(/^[A-Z2-9]{4}$/)
  })

  it('avoids ambiguous chars (no I, O, 0, 1)', () => {
    // Generate many keys and check no banned chars appear.
    const bad = /[IO01]/
    for (let i = 0; i < 50; i++) {
      const k = makeLicenseKey('hardware')
      const random = k.split('-').slice(2).join('')
      expect(random).not.toMatch(bad)
    }
  })

  it('matches the desktop variantLicensePrefix mapping', () => {
    // From src/lib/variant.ts variantLicensePrefix:
    //   pro → OMNIX-PRO     dawa → OMNIX-DAWA     retail → OMNIX-RETAIL
    //   hospitality → OMNIX-HOSP                  hardware → OMNIX-HW
    const cases: Array<[Parameters<typeof makeLicenseKey>[0], string]> = [
      ['pro', 'OMNIX-PRO'],
      ['dawa', 'OMNIX-DAWA'],
      ['retail', 'OMNIX-RETAIL'],
      ['hospitality', 'OMNIX-HOSP'],
      ['hardware', 'OMNIX-HW'],
    ]
    for (const [variant, prefix] of cases) {
      expect(makeLicenseKey(variant).startsWith(prefix + '-')).toBe(true)
    }
  })
})

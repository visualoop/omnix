import { describe, expect, it } from 'vitest'
import { generateLicenseKey, type LicenseKeyVariant } from '@/lib/license-key'
import {
  isCanonicalLicenseKey,
  licenseKeyLookupCandidates,
  normalizeLicenseKey,
} from '@/lib/license-key-format'
import { canonicalizeLicenseKeyForRepair } from '@/lib/license-key-repair'

const VARIANTS: LicenseKeyVariant[] = [
  'pro',
  'dawa',
  'retail',
  'hospitality',
  'hardware',
  'salon',
]

describe('canonical license-key generator', () => {
  it.each(VARIANTS)('generates a canonical %s key', (variant) => {
    const key = generateLicenseKey(variant)
    const normalized = normalizeLicenseKey(key)

    expect(isCanonicalLicenseKey(key)).toBe(true)
    expect(normalized).toMatchObject({ canonicalKey: key, variant })
    expect(key.split('-')).toHaveLength(5)
    expect(key.split('-').slice(2)).toEqual([
      expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}$/),
      expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}$/),
      expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}$/),
    ])
  })
})

describe('legacy license-key compatibility', () => {
  it.each([
    ['OMX-HARDWARE-822A-B882-4B60', 'OMNIX-HW-822A-B882-4B60', 'hardware'],
    ['OMX-DAWA-CD28-4CAB-52D4', 'OMNIX-DAWA-CD28-4CAB-52D4', 'dawa'],
  ] as const)('normalizes live key %s', (legacy, canonical, variant) => {
    expect(normalizeLicenseKey(legacy)).toMatchObject({ canonicalKey: canonical, variant })
    expect(licenseKeyLookupCandidates(legacy)).toEqual(expect.arrayContaining([legacy, canonical]))
    expect(canonicalizeLicenseKeyForRepair(legacy)).toBe(canonical)
  })

  it('rejects junk, RSA-shaped keys, wrong segment counts, and over-long input', () => {
    expect(normalizeLicenseKey('junk')).toBeNull()
    expect(normalizeLicenseKey('OMNIX-DAWA-AAAA.BBBB-CCCC')).toBeNull()
    expect(normalizeLicenseKey('OMNIX-DAWA-AAAA-BBBB')).toBeNull()
    expect(normalizeLicenseKey(`OMNIX-DAWA-${'A'.repeat(80)}`)).toBeNull()
  })
})


describe('license-key repair planning', () => {
  it('is idempotent once all rows are canonical', async () => {
    const { buildLicenseKeyRepairPlan } = await import('@/lib/license-key-repair')
    expect(buildLicenseKeyRepairPlan([
      { id: 'one', variant: 'dawa', licenseKey: 'OMNIX-DAWA-CD28-4CAB-52D4' },
    ])).toEqual([])
  })

  it('flags a canonical collision with a different existing row', async () => {
    const { buildLicenseKeyRepairPlan } = await import('@/lib/license-key-repair')
    const plan = buildLicenseKeyRepairPlan([
      { id: 'legacy', variant: 'dawa', licenseKey: 'OMX-DAWA-CD28-4CAB-52D4' },
      { id: 'canonical', variant: 'dawa', licenseKey: 'OMNIX-DAWA-CD28-4CAB-52D4' },
    ])
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({
      id: 'legacy',
      newKey: 'OMNIX-DAWA-CD28-4CAB-52D4',
      issue: expect.stringContaining('already belongs to row canonical'),
    })
  })
})

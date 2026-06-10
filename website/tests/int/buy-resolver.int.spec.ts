/**
 * /buy entry resolver tests — pure decision logic.
 */
import { describe, it, expect } from 'vitest'
import {
  isValidMachineId,
  buildSignupNext,
  trialModulesFor,
  variantFor,
  decideBuyDestination,
} from '@/lib/buy-resolver'

describe('isValidMachineId', () => {
  it('accepts a normal fingerprint', () => {
    expect(isValidMachineId('ABCD1234EFGH5678')).toBe(true)
    expect(isValidMachineId('a1b2-c3d4-e5f6-0789')).toBe(true)
  })
  it('rejects empty / null / undefined', () => {
    expect(isValidMachineId(undefined)).toBe(false)
    expect(isValidMachineId(null)).toBe(false)
    expect(isValidMachineId('')).toBe(false)
  })
  it('rejects too-short values (< 8 chars)', () => {
    expect(isValidMachineId('ABC123')).toBe(false)
  })
  it('rejects characters outside [A-Z0-9-]', () => {
    expect(isValidMachineId('ABCD1234; DROP TABLE')).toBe(false)
    expect(isValidMachineId('machine/../../etc')).toBe(false)
    expect(isValidMachineId('héllo-machine-id')).toBe(false)
  })
  it('rejects absurdly long values (> 128)', () => {
    expect(isValidMachineId('A'.repeat(129))).toBe(false)
    expect(isValidMachineId('A'.repeat(128))).toBe(true)
  })
})

describe('buildSignupNext', () => {
  it('includes machine + module when present', () => {
    expect(buildSignupNext('MACH1234', 'dawa')).toBe('/buy?machine=MACH1234&module=dawa')
  })
  it('handles machine only', () => {
    expect(buildSignupNext('MACH1234', null)).toBe('/buy?machine=MACH1234')
  })
  it('handles module only', () => {
    expect(buildSignupNext(null, 'retail')).toBe('/buy?module=retail')
  })
  it('bare /buy when neither', () => {
    expect(buildSignupNext(null, null)).toBe('/buy')
  })
})

describe('trialModulesFor', () => {
  it('returns [core, <module>] for a valid module', () => {
    expect(trialModulesFor('dawa')).toEqual(['core', 'dawa'])
    expect(trialModulesFor('hospitality')).toEqual(['core', 'hospitality'])
  })
  it('returns the default bundle for unknown/empty module', () => {
    expect(trialModulesFor(undefined)).toEqual(['core', 'dawa', 'retail', 'hardware', 'hospitality'])
    expect(trialModulesFor('not-a-module')).toEqual(['core', 'dawa', 'retail', 'hardware', 'hospitality'])
  })
  it('never lets an injected module string through', () => {
    expect(trialModulesFor('admin')).toEqual(['core', 'dawa', 'retail', 'hardware', 'hospitality'])
  })
})

describe('decideBuyDestination', () => {
  it('anonymous → signup with next preserving machine + module', () => {
    const d = decideBuyDestination({ isCustomer: false, machine: 'MACH1234', module: 'dawa' })
    expect(d).toEqual({ kind: 'signup', next: '/buy?machine=MACH1234&module=dawa' })
  })

  it('customer with an existing licence → checkout', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: 'lic_42' })
    expect(d).toEqual({ kind: 'checkout', licenseId: 'lic_42' })
  })

  it('customer without a licence → create-then-checkout with module bundle + variant', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: null, module: 'hardware' })
    expect(d).toEqual({ kind: 'create-then-checkout', modules: ['core', 'hardware'], variant: 'hardware' })
  })

  it('customer without a licence + no module → default bundle, Pro variant', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: null })
    expect(d).toEqual({
      kind: 'create-then-checkout',
      modules: ['core', 'dawa', 'retail', 'hardware', 'hospitality'],
      variant: 'pro',
    })
  })

  it('explicit ?variant=dawa overrides module mapping', () => {
    const d = decideBuyDestination({
      isCustomer: true,
      existingLicenseId: null,
      module: 'retail',
      variant: 'dawa',
    })
    expect(d.kind).toBe('create-then-checkout')
    if (d.kind === 'create-then-checkout') expect(d.variant).toBe('dawa')
  })

  it('numeric license id (0) is treated as existing (not null)', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: 0 })
    expect(d).toEqual({ kind: 'checkout', licenseId: 0 })
  })
})

describe('variantFor', () => {
  it('returns the explicit variant when valid', () => {
    expect(variantFor('dawa')).toBe('dawa')
    expect(variantFor('retail')).toBe('retail')
    expect(variantFor('hospitality')).toBe('hospitality')
    expect(variantFor('hardware')).toBe('hardware')
    expect(variantFor('pro')).toBe('pro')
  })

  it('falls back to mapping module → trade variant', () => {
    expect(variantFor(null, 'dawa')).toBe('dawa')
    expect(variantFor(undefined, 'retail')).toBe('retail')
    expect(variantFor(undefined, 'hospitality')).toBe('hospitality')
    expect(variantFor(undefined, 'hardware')).toBe('hardware')
  })

  it('defaults to pro when nothing valid is supplied', () => {
    expect(variantFor()).toBe('pro')
    expect(variantFor(null, null)).toBe('pro')
    expect(variantFor('not-a-variant')).toBe('pro')
    expect(variantFor(undefined, 'core')).toBe('pro')
    expect(variantFor(undefined, 'admin')).toBe('pro')
  })
})

/**
 * /buy entry resolver tests — pure decision logic.
 */
import { describe, it, expect } from 'vitest'
import {
  isValidMachineId,
  buildSignupNext,
  trialModulesFor,
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
    expect(trialModulesFor(undefined)).toEqual(['core', 'dawa', 'retail'])
    expect(trialModulesFor('not-a-module')).toEqual(['core', 'dawa', 'retail'])
  })
  it('never lets an injected module string through', () => {
    expect(trialModulesFor('admin')).toEqual(['core', 'dawa', 'retail'])
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

  it('customer without a licence → create-then-checkout with module bundle', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: null, module: 'hardware' })
    expect(d).toEqual({ kind: 'create-then-checkout', modules: ['core', 'hardware'] })
  })

  it('customer without a licence + no module → default bundle', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: null })
    expect(d).toEqual({ kind: 'create-then-checkout', modules: ['core', 'dawa', 'retail'] })
  })

  it('numeric license id (0) is treated as existing (not null)', () => {
    const d = decideBuyDestination({ isCustomer: true, existingLicenseId: 0 })
    expect(d).toEqual({ kind: 'checkout', licenseId: 0 })
  })
})

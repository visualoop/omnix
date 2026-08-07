import { LICENSE_KEY_PREFIX } from './brand'

export const LICENSE_KEY_VARIANT_TOKEN = {
  pro: 'PRO',
  dawa: 'DAWA',
  retail: 'RETAIL',
  hospitality: 'HOSP',
  hardware: 'HW',
  salon: 'SALON',
} as const

export type LicenseKeyVariant = keyof typeof LICENSE_KEY_VARIANT_TOKEN

const LEGACY_PREFIX = 'OMX'
const MAX_RAW_KEY_LENGTH = 64
const MAX_COMPACT_KEY_LENGTH = 40
const KEY_GROUP_PATTERN = /^[A-Z0-9]{4}$/

const TOKEN_VARIANT: Readonly<Record<string, LicenseKeyVariant>> = {
  PRO: 'pro',
  DAWA: 'dawa',
  RETAIL: 'retail',
  HOSP: 'hospitality',
  HOSPITALITY: 'hospitality',
  HW: 'hardware',
  HARDWARE: 'hardware',
  SALON: 'salon',
}

const VARIANT_TOKENS: Readonly<Record<LicenseKeyVariant, readonly string[]>> = {
  pro: ['PRO'],
  dawa: ['DAWA'],
  retail: ['RETAIL'],
  hospitality: ['HOSP', 'HOSPITALITY'],
  hardware: ['HW', 'HARDWARE'],
  salon: ['SALON'],
}

export interface NormalizedLicenseKey {
  canonicalKey: string
  submittedKey: string
  variant: LicenseKeyVariant
}

/**
 * Strictly parse a website-issued compact key and canonicalise legacy aliases.
 * This only validates shape; the licensing server remains authoritative for
 * whether the key exists and is usable.
 */
export function normalizeLicenseKey(input: string): NormalizedLicenseKey | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_RAW_KEY_LENGTH) return null

  const submittedKey = input.replace(/\s+/g, '').toUpperCase()
  if (
    submittedKey.length === 0 ||
    submittedKey.length > MAX_COMPACT_KEY_LENGTH ||
    submittedKey.includes('.')
  ) {
    return null
  }

  const parts = submittedKey.split('-')
  if (parts.length !== 5) return null

  const [prefix, token, ...groups] = parts
  if (prefix !== LICENSE_KEY_PREFIX && prefix !== LEGACY_PREFIX) return null

  const variant = TOKEN_VARIANT[token]
  if (!variant || groups.length !== 3 || groups.some((group) => !KEY_GROUP_PATTERN.test(group))) {
    return null
  }

  return {
    canonicalKey: `${LICENSE_KEY_PREFIX}-${LICENSE_KEY_VARIANT_TOKEN[variant]}-${groups.join('-')}`,
    submittedKey,
    variant,
  }
}

export function canonicalizeLicenseKey(input: string): string | null {
  return normalizeLicenseKey(input)?.canonicalKey ?? null
}

export function isCanonicalLicenseKey(input: string): boolean {
  const normalized = normalizeLicenseKey(input)
  return normalized !== null && input === normalized.canonicalKey
}

/** All historical spellings that may identify the same persisted row. */
export function licenseKeyLookupCandidates(input: string): string[] {
  const normalized = normalizeLicenseKey(input)
  if (!normalized) return []

  const groups = normalized.canonicalKey.split('-').slice(2).join('-')
  const candidates = [normalized.submittedKey, normalized.canonicalKey]
  for (const prefix of [LICENSE_KEY_PREFIX, LEGACY_PREFIX]) {
    for (const token of VARIANT_TOKENS[normalized.variant]) {
      candidates.push(`${prefix}-${token}-${groups}`)
    }
  }
  return [...new Set(candidates)]
}

/** Prefer the exact submitted spelling, then the repaired canonical row. */
export function pickLicenseKeyMatch<T extends { licenseKey: string }>(
  rows: readonly T[],
  input: string,
): T | undefined {
  const normalized = normalizeLicenseKey(input)
  if (!normalized) return undefined
  return (
    rows.find((row) => row.licenseKey.toUpperCase() === normalized.submittedKey) ??
    rows.find((row) => row.licenseKey === normalized.canonicalKey) ??
    rows[0]
  )
}

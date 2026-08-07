import {
  canonicalizeLicenseKey,
  isCanonicalLicenseKey,
  normalizeLicenseKey,
} from './license-key-format'

export interface LicenseKeyRepairRow {
  id: string
  variant: string
  licenseKey: string
}

export interface LicenseKeyRepairChange {
  id: string
  variant: string
  oldKey: string
  newKey: string | null
  issue?: string
}

/** Pure key transform used by the production repair script. */
export function canonicalizeLicenseKeyForRepair(key: string): string | null {
  return canonicalizeLicenseKey(key)
}

export function buildLicenseKeyRepairPlan(rows: readonly LicenseKeyRepairRow[]): LicenseKeyRepairChange[] {
  const nonCanonical = rows.filter((row) => !isCanonicalLicenseKey(row.licenseKey))
  const keyOwners = new Map(rows.map((row) => [row.licenseKey, row.id]))
  const plannedOwners = new Map<string, string>()

  return nonCanonical.map((row) => {
    const canonicalKey = canonicalizeLicenseKeyForRepair(row.licenseKey)
    const normalized = normalizeLicenseKey(row.licenseKey)
    if (!normalized || !canonicalKey) {
      return { id: row.id, variant: row.variant, oldKey: row.licenseKey, newKey: null, issue: 'unrecognised format' }
    }
    if (normalized.variant !== row.variant) {
      return {
        id: row.id,
        variant: row.variant,
        oldKey: row.licenseKey,
        newKey: canonicalKey,
        issue: `key resolves to ${normalized.variant}, row says ${row.variant}`,
      }
    }

    const existingOwner = keyOwners.get(canonicalKey)
    if (existingOwner && existingOwner !== row.id) {
      return {
        id: row.id,
        variant: row.variant,
        oldKey: row.licenseKey,
        newKey: canonicalKey,
        issue: `canonical key already belongs to row ${existingOwner}`,
      }
    }

    const plannedOwner = plannedOwners.get(canonicalKey)
    if (plannedOwner && plannedOwner !== row.id) {
      return {
        id: row.id,
        variant: row.variant,
        oldKey: row.licenseKey,
        newKey: canonicalKey,
        issue: `canonical key also produced by row ${plannedOwner}`,
      }
    }
    plannedOwners.set(canonicalKey, row.id)

    return { id: row.id, variant: row.variant, oldKey: row.licenseKey, newKey: canonicalKey }
  })
}

import { randomBytes } from 'node:crypto'
import { LICENSE_KEY_PREFIX } from './brand'
import {
  LICENSE_KEY_VARIANT_TOKEN,
  type LicenseKeyVariant,
} from './license-key-format'

export type { LicenseKeyVariant } from './license-key-format'

const LICENSE_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LICENSE_KEY_GROUP_COUNT = 3
const LICENSE_KEY_GROUP_LENGTH = 4

/** Generate the one canonical website-issued shape: OMNIX-<SHORT>-XXXX-XXXX-XXXX. */
export function generateLicenseKey(variant: LicenseKeyVariant): string {
  const bytes = randomBytes(LICENSE_KEY_GROUP_COUNT * LICENSE_KEY_GROUP_LENGTH)
  const groups = Array.from({ length: LICENSE_KEY_GROUP_COUNT }, (_, groupIndex) => {
    const start = groupIndex * LICENSE_KEY_GROUP_LENGTH
    return Array.from(bytes.subarray(start, start + LICENSE_KEY_GROUP_LENGTH), (byte) =>
      LICENSE_KEY_ALPHABET[byte & 31],
    ).join('')
  })

  return `${LICENSE_KEY_PREFIX}-${LICENSE_KEY_VARIANT_TOKEN[variant]}-${groups.join('-')}`
}

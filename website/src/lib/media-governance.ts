export const MEDIA_RIGHTS_BASES = [
  'owned',
  'licensed',
  'customer-permission',
  'creative-commons',
  'public-domain',
] as const

export type MediaRightsBasis = (typeof MEDIA_RIGHTS_BASES)[number]
export type MediaApprovalState = 'pending' | 'approved' | 'rejected'

export const MEDIA_RIGHTS_LABELS: Record<MediaRightsBasis, string> = {
  owned: 'Owned by Omnix',
  licensed: 'Commercial licence',
  'customer-permission': 'Customer permission',
  'creative-commons': 'Creative Commons',
  'public-domain': 'Public domain',
}

export interface MediaProvenanceRecord {
  alt: string | null
  rightsBasis: string | null
  rightsHolder: string | null
  rightsSource: string | null
}

export interface MediaPublicationRecord extends MediaProvenanceRecord {
  approvalState: string | null
  approvedBy: string | null
  approvalAuditId: string | null
  approvedAt: Date | string | null
  objectState: string | null
  key: string | null
  url: string | null
  mimeType: string | null
}

export function isMediaRightsBasis(value: unknown): value is MediaRightsBasis {
  return typeof value === 'string' && MEDIA_RIGHTS_BASES.includes(value as MediaRightsBasis)
}

export function isValidApprovalTimestamp(value: Date | string | null | undefined): boolean {
  if (!value) return false
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(timestamp)
}

export function validateMediaProvenance(record: MediaProvenanceRecord): string | null {
  if (!record.alt?.trim()) return 'Alt text is required.'
  if (!isMediaRightsBasis(record.rightsBasis)) return 'Select a valid rights basis.'
  if (!record.rightsHolder?.trim()) return 'Rights holder is required.'
  if (!record.rightsSource?.trim()) return 'Licence, permission, or source reference is required.'
  return null
}

export function isPublishableMedia(record: MediaPublicationRecord): boolean {
  if (record.approvalState !== 'approved') return false
  if (!record.approvedBy?.trim() || !record.approvalAuditId?.trim()) return false
  if (!isValidApprovalTimestamp(record.approvedAt)) return false
  if (record.objectState !== 'published' || !record.key?.trim()) return false
  if (!record.mimeType?.trim()) return false
  try {
    if (new URL(record.url ?? '').protocol !== 'https:') return false
  } catch {
    return false
  }
  return validateMediaProvenance(record) === null
}

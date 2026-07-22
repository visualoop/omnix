import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { describe, expect, it } from 'vitest'
import { VerifiedCustomerProof } from '@/components/marketing/verified-customer-proof'
import {
  VERIFIED_CUSTOMER_PROOF_REGISTRY,
  customerProofPublicationSha256,
  validatePersistedProof,
} from '@/lib/verified-customer-proof'
import { getApprovedTeamMemberPhoto } from '@/lib/team-member-media'
import { isPublishableMedia, validateMediaProvenance, type MediaPublicationRecord } from '@/lib/media-governance'
import { PRODUCT_MEDIA_SLOTS, type SlotMedia } from '@/lib/media-slots'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const approvedMedia: MediaPublicationRecord = {
  alt: 'A point-of-sale screen showing inventory',
  rightsBasis: 'owned',
  rightsHolder: 'Omnix',
  rightsSource: 'asset-register/001',
  approvalState: 'approved',
  approvedBy: 'real-admin-id',
  approvalAuditId: 'real-audit-id',
  approvedAt: '2026-07-20T08:00:00.000Z',
  objectState: 'published',
  key: 'media/2026/07/screen.png',
  url: 'https://media.omnix.co.ke/media/2026/07/screen.png',
  mimeType: 'image/png',
}

describe('licensed media publication gate', () => {
  it('requires complete provenance plus valid audited publication metadata', () => {
    expect(validateMediaProvenance(approvedMedia)).toBeNull()
    expect(isPublishableMedia(approvedMedia)).toBe(true)
    expect(isPublishableMedia({ ...approvedMedia, approvalState: 'pending' })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, rightsBasis: 'unverified' })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, approvedBy: null })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, approvalAuditId: null })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, approvedAt: 'not-even-a-date' })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, objectState: 'quarantine' })).toBe(false)
    expect(isPublishableMedia({ ...approvedMedia, url: '' })).toBe(false)
  })

  it('defines governed image, video and poster slots for exactly five named products', () => {
    expect(PRODUCT_MEDIA_SLOTS).toHaveLength(5)
    expect(PRODUCT_MEDIA_SLOTS.map((item) => item.name)).toEqual([
      'Pharmacy',
      'Retail',
      'Hospitality',
      'Hardware & Equipment',
      'Salon & Spa',
    ])
    for (const product of PRODUCT_MEDIA_SLOTS) {
      expect(product.videoSlot).toMatch(/^module\..+\.video$/)
      expect(product.posterSlot).toMatch(/^module\..+\.video-poster$/)
    }
  })

  it('uploads to private quarantine and only creates a public URL during promotion', () => {
    const storage = read('src/lib/r2-media.ts')
    const api = read('src/app/api/admin/media/route.ts')
    expect(storage).toContain("getSetting('s3.media_quarantine_bucket')")
    expect(storage).toContain("CacheControl: 'private, no-store'")
    expect(storage).toContain('getSignedUrl(')
    expect(storage).toContain('promoteQuarantinedMedia')
    expect(api).toContain("key: ''")
    expect(api).toContain("url: ''")
    expect(api).toContain("objectState: 'quarantine'")
    expect(api).toContain("action: 'media.approve'")
    expect(api).toContain('db.batch([')
  })

  it('has no direct marketing-video settings bypass', () => {
    const settings = read('src/lib/platform-settings.ts')
    const homepage = read('src/app/[locale]/(frontend)/page.tsx')
    expect(settings).not.toContain('video_url')
    expect(settings).not.toContain('video_poster')
    expect(homepage).toContain("getSlotMedia('hero.video')")
    expect(homepage).toContain("getSlotImage('hero.video-poster')")
  })

  it('requires an affirmative rights selection in the admin UI', () => {
    const ui = read('src/components/admin/media-library.tsx')
    expect(ui).toContain("useState<MediaRightsBasis | ''>('')")
    expect(ui).toContain('placeholder="Select rights basis"')
    expect(ui).not.toContain("useState<MediaRightsBasis>('owned')")
    expect(ui).toContain("if (!uploadBasis)")
  })

  it('requires explicit reapproval for changes and does not swallow object-deletion failures', () => {
    const api = read('src/app/api/admin/media/route.ts')
    expect(api).toContain("currentApproval === 'approved' && metadataChanged && body.approvalState !== 'approved'")
    expect(api).toContain('Changes to approved media must be checked and submitted with Approve.')
    expect(api).toContain('await deletePublishedMedia(current.key)')
    expect(api).not.toContain('await deletePublishedMedia(current.key).catch')
    expect(api).not.toContain('await deletePublishedMedia(row.key).catch')
    // DELETE tombstone: neither the private review copy nor the public object
    // may be swallowed — the tombstone/audit only commits once both are gone.
    expect(api).toContain('await deleteQuarantinedMedia(row.quarantineKey)')
    expect(api).not.toContain('await deleteQuarantinedMedia(row.quarantineKey).catch')
    expect(api).toContain('await deletePublishedMedia(row.key)')
    // Approval rollback: a promoted-but-unrecorded public object is an
    // untracked leak and its cleanup failure must surface, not be swallowed.
    expect(api).toContain('await deletePublishedMedia(promoted.key)')
    expect(api).not.toContain('await deletePublishedMedia(promoted.key).catch')
  })

  it('keeps platform-admin authorization unchanged', () => {
    const api = read('src/app/api/admin/media/route.ts')
    const page = read('src/app/admin/media/page.tsx')
    expect(api).toContain("session.user.role !== 'platform_admin'")
    expect(page).toContain("session.user.role !== 'platform_admin'")
  })
})

describe('governed team photos', () => {
  it('renders only image media returned by the approved-media resolver', async () => {
    const governedPhoto: SlotMedia = {
      id: 'approved-photo',
      url: 'https://media.omnix.co.ke/media/2026/07/team.png',
      alt: 'Omnix team member at work',
      filename: 'team.png',
      mimeType: 'image/png',
      rightsBasis: 'owned',
      rightsHolder: 'Omnix',
      rightsSource: 'asset-register/team-001',
    }
    await expect(getApprovedTeamMemberPhoto('approved-photo', async () => governedPhoto)).resolves.toEqual(governedPhoto)
    await expect(getApprovedTeamMemberPhoto('pending-photo', async () => null)).resolves.toBeNull()
    await expect(getApprovedTeamMemberPhoto('rejected-photo', async () => null)).resolves.toBeNull()
    await expect(getApprovedTeamMemberPhoto('deleted-photo', async () => null)).resolves.toBeNull()
    await expect(getApprovedTeamMemberPhoto('https://untrusted.example/photo.jpg', async () => null)).resolves.toBeNull()
    await expect(getApprovedTeamMemberPhoto('approved-video', async () => ({ ...governedPhoto, mimeType: 'video/mp4' }))).resolves.toBeNull()
  })

  it('rejects raw URL input and resolves media IDs again on every public render', () => {
    const api = read('src/app/api/admin/team-members/route.ts')
    const publicPage = read('src/app/[locale]/(frontend)/team/page.tsx')
    const adminClient = read('src/app/admin/team-members/team-members-client.tsx')
    expect(api).toContain("hasOwnProperty.call(body, 'photoUrl')")
    expect(api).toContain('Raw photo URLs are not accepted; use mediaId')
    expect(api).toContain('getApprovedTeamMemberPhoto(value)')
    expect(api).toContain("session.user.role !== 'platform_admin'")
    expect(publicPage).toContain('getApprovedTeamMemberPhoto(member.mediaId)')
    expect(publicPage).not.toContain('teamMembers.photoUrl')
    expect(publicPage).not.toContain('src={member.photoUrl}')
    expect(adminClient).not.toContain("fetch('/api/admin/media'")
    expect(adminClient).toContain('Search approved photos')
  })
})

describe('verified customer proof', () => {
  it('has a typed shape registry but no embedded customer records', () => {
    expect(Object.keys(VERIFIED_CUSTOMER_PROOF_REGISTRY)).toEqual([
      'testimonial', 'customer-logo', 'outcome', 'case-study', 'rating',
    ])
    for (const entry of Object.values(VERIFIED_CUSTOMER_PROOF_REGISTRY)) {
      expect(Object.keys(entry).sort()).toEqual(['customerClaim', 'requiredFields'])
      expect(entry.customerClaim).toBe(true)
      expect(entry.requiredFields.length).toBeGreaterThan(0)
      expect(entry.requiredFields.every((field) => typeof field === 'string')).toBe(true)
    }
  })

  it('accepts only hash-bound, timestamped, kind-valid persisted claims', async () => {
    const content = {
      quote: 'An authorised quotation.',
      attributionName: 'Authorised Person',
      attributionRole: 'Owner',
    }
    const envelope = {
      kind: 'testimonial' as const,
      product: 'retail' as const,
      customerName: 'Permission-backed Customer',
      content,
      mediaId: null,
    }
    const candidate = {
      id: 'proof-1',
      ...envelope,
      publicationSha256: customerProofPublicationSha256(envelope),
      approvedAt: new Date('2026-07-20T08:00:00.000Z'),
    }

    await expect(validatePersistedProof(candidate)).resolves.toMatchObject({
      id: 'proof-1',
      kind: 'testimonial',
      quote: content.quote,
    })
    await expect(validatePersistedProof({ ...candidate, publicationSha256: 'tampered' })).resolves.toBeNull()
    await expect(validatePersistedProof({ ...candidate, approvedAt: new Date('invalid') })).resolves.toBeNull()

    const unsafeRatingContent = {
      ratingValue: 6,
      ratingScale: 5,
      reviewCount: 1,
      source: 'Unverified source',
      sourceUrl: 'http://example.com/reviews',
    }
    const unsafeRatingEnvelope = {
      kind: 'rating' as const,
      product: candidate.product,
      customerName: candidate.customerName,
      content: unsafeRatingContent,
      mediaId: candidate.mediaId,
    }
    await expect(validatePersistedProof({
      ...candidate,
      ...unsafeRatingEnvelope,
      publicationSha256: customerProofPublicationSha256(unsafeRatingEnvelope),
    })).resolves.toBeNull()
  })

  it('binds customer-logo authorization to the displayed media identity', async () => {
    const base = {
      kind: 'customer-logo' as const,
      product: 'hardware' as const,
      customerName: 'Authorised Customer',
      content: { logoAlt: 'Authorised Customer logo' },
    }
    const authorised = { ...base, mediaId: 'media-a' }
    const substituted = { ...base, mediaId: 'media-b' }
    const authorisedDigest = customerProofPublicationSha256(authorised)

    expect(authorisedDigest).not.toBe(customerProofPublicationSha256(substituted))
    await expect(validatePersistedProof({
      id: 'logo-proof',
      ...substituted,
      publicationSha256: authorisedDigest,
      approvedAt: new Date('2026-07-20T08:00:00.000Z'),
    })).resolves.toBeNull()
  })

  it('does not accept caller-supplied fabricated proof and renders nothing without persisted rows', async () => {
    const fabricated = {
      id: 'invented',
      customerName: 'Invented Customer',
      approvedAt: 'not-even-a-date',
      evidenceRef: 'made-up-evidence',
      publicPermissionRef: 'made-up-permission',
    }
    const result = await VerifiedCustomerProof({ proofs: [fabricated] } as unknown as { kinds?: readonly [] })
    expect(result).toBeNull()
    const component = read('src/components/marketing/verified-customer-proof.tsx')
    expect(component).not.toMatch(/proofs\??:/)
  })

  it('inner-joins real evidence, permission, admin, verifier and audit records', () => {
    const registry = read('src/lib/verified-customer-proof.ts')
    expect(registry).toContain('.innerJoin(customerProofEvidence')
    expect(registry).toContain('.innerJoin(customerProofPermissions')
    expect(registry).toContain('.innerJoin(approver')
    expect(registry).toContain('.innerJoin(evidenceVerifier')
    expect(registry).toContain('.innerJoin(approvalAudit')
    expect(registry).toContain("eq(approver.role, 'platform_admin')")
    expect(registry).toContain("eq(approvalAudit.action, 'customer_proof.approve')")
    expect(registry).toContain('assertedPublicationSha256')
    expect(registry).toContain('authorisedPublicationSha256')
    expect(registry).toContain('verifiedCustomerProofs.publicationSha256')
    expect(registry).toContain('isNull(customerProofPermissions.revokedAt)')
  })

  it('validates timestamps, rating bounds, URLs and approved logo media before rendering', () => {
    const registry = read('src/lib/verified-customer-proof.ts')
    expect(registry).toContain('Number.isFinite(candidate.approvedAt.getTime())')
    expect(registry).toContain('ratingValue <= ratingScale')
    expect(registry).toContain('ratingScale <= 10')
    expect(registry).toContain("new URL(href).protocol === 'https:'")
    expect(registry).toContain('getApprovedMediaById(candidate.mediaId)')
  })

  it('contains no former unverified customer or testimonial fixtures', () => {
    const combined = `${read('src/components/landing/recent-work-section.tsx')}\n${read('src/components/landing/three-quotes-section.tsx')}`
    for (const claim of ['Mama Brenda', 'Sokoni Stores', 'Eldoret Farmers Mart', 'Penda Cosmetics', 'Naliaka Wamalwa']) {
      expect(combined).not.toContain(claim)
    }
  })
})

describe('Task 8 migration', () => {
  it('is registered with Drizzle and discovered after 0004', () => {
    const migrations = readMigrationFiles({ migrationsFolder: join(ROOT, 'drizzle/migrations') })
    expect(migrations).toHaveLength(7)
    expect(migrations[5]?.sql.join('\n')).toContain('verified_customer_proofs')
    expect(migrations[5]?.sql.join('\n')).toContain('quarantine_key')
    expect(migrations[6]?.sql.join('\n')).toContain('publication_sha256')
    expect(migrations[6]?.sql.join('\n')).toContain('team_members_media_id_platform_media_id_fk')
  })

  it('keeps standalone and inline migrations repeat-safe and aligned', () => {
    const licensedMedia = read('drizzle/migrations/0005_licensed_media.sql')
    const hardening = read('drizzle/migrations/0006_trust_boundary_hardening.sql')
    const inline = read('src/db/migration-sql.ts')
    for (const source of [licensedMedia, inline]) {
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "rights_basis"')
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "quarantine_key"')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS "customer_proof_evidence"')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS "customer_proof_permissions"')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS "verified_customer_proofs"')
      expect(source).toContain('CREATE INDEX IF NOT EXISTS "verified_customer_proofs_publication_idx"')
    }
    for (const source of [hardening, inline]) {
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "media_id"')
      expect(source).toContain('UPDATE "team_members" SET "photo_url" = NULL')
      expect(source).toContain('team_members_media_id_platform_media_id_fk')
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "asserted_publication_sha256"')
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "authorised_publication_sha256"')
      expect(source).toContain('ADD COLUMN IF NOT EXISTS "publication_sha256"')
      expect(source).toContain('verified_customer_proofs_media_id_platform_media_id_fk')
    }
  })
})

/** Licensed marketing-media slots and their only public resolver. */
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { and, count, desc, eq, ilike, isNotNull, ne, or, sql } from 'drizzle-orm'
import { auditLog, db, platformMedia, user } from '@/db'
import { isPublishableMedia, type MediaRightsBasis } from '@/lib/media-governance'

/**
 * Documented upper bound (seconds) on how long a freshly approved/published —
 * or newly revoked — media slot can take to become visible/invisible on public
 * pages. Admin media mutations also fire revalidateTag('media-slots') for
 * near-immediate propagation; this window is the fail-safe ceiling (<= 300s).
 */
export const MEDIA_SLOT_REVALIDATE_SECONDS = 300

export type MediaSlotType = 'image' | 'video'

export interface SlotMedia {
  id: string
  url: string
  alt: string
  filename: string | null
  mimeType: string
  rightsBasis: MediaRightsBasis
  rightsHolder: string
  rightsSource: string
}

export type SlotImage = SlotMedia

export const PRODUCT_MEDIA_SLOTS = [
  { product: 'pharmacy', variant: 'dawa', name: 'Pharmacy', heroSlot: 'module.dawa.hero', rowSlot: 'module-row.dawa-pharmacy', videoSlot: 'module.dawa.video', posterSlot: 'module.dawa.video-poster', rowSlug: 'dawa-pharmacy', aspect: '16/9' },
  { product: 'retail', variant: 'retail', name: 'Retail', heroSlot: 'module.retail.hero', rowSlot: 'module-row.soko-retail', videoSlot: 'module.retail.video', posterSlot: 'module.retail.video-poster', rowSlug: 'soko-retail', aspect: '16/9' },
  { product: 'hospitality', variant: 'hospitality', name: 'Hospitality', heroSlot: 'module.hospitality.hero', rowSlot: 'module-row.hospitality', videoSlot: 'module.hospitality.video', posterSlot: 'module.hospitality.video-poster', rowSlug: 'hospitality', aspect: '16/9' },
  { product: 'hardware', variant: 'hardware', name: 'Hardware & Equipment', heroSlot: 'module.hardware.hero', rowSlot: 'module-row.hardware', videoSlot: 'module.hardware.video', posterSlot: 'module.hardware.video-poster', rowSlug: 'hardware', aspect: '16/9' },
  { product: 'salon', variant: 'salon', name: 'Salon & Spa', heroSlot: 'module.salon.hero', rowSlot: 'module-row.salon', videoSlot: 'module.salon.video', posterSlot: 'module.salon.video-poster', rowSlug: 'salon', aspect: '16/9' },
] as const

const SHARED_MEDIA_SLOTS = [
  { slot: 'hero.background', label: 'Homepage hero — background', section: 'Homepage', aspect: '16/9', mediaType: 'image' },
  { slot: 'hero.product_shot', label: 'Homepage hero — product screenshot', section: 'Homepage', aspect: '4/3', mediaType: 'image' },
  { slot: 'hero.video', label: 'Homepage hero — product video', section: 'Homepage', aspect: '16/9', mediaType: 'video' },
  { slot: 'hero.video-poster', label: 'Homepage hero — video poster', section: 'Homepage', aspect: '16/9', mediaType: 'image' },
  { slot: 'pricing.hero', label: 'Pricing page — hero', section: 'Pricing', aspect: '16/9', mediaType: 'image' },
  { slot: 'about.team_photo', label: 'About page — team photo', section: 'About', aspect: '3/2', mediaType: 'image' },
  { slot: 'og.default', label: 'Social card — default', section: 'SEO', aspect: '1200/630', mediaType: 'image' },
] as const

const PRODUCT_SLOTS = PRODUCT_MEDIA_SLOTS.flatMap((product) => [
  { slot: product.heroSlot, label: `${product.name} — product hero`, section: 'Product pages', aspect: product.aspect, mediaType: 'image' as const },
  { slot: product.rowSlot, label: `${product.name} — homepage row`, section: 'Homepage products', aspect: '16/10', mediaType: 'image' as const },
  { slot: product.videoSlot, label: `${product.name} — product video`, section: 'Product pages', aspect: '16/9', mediaType: 'video' as const },
  { slot: product.posterSlot, label: `${product.name} — video poster`, section: 'Product pages', aspect: '16/9', mediaType: 'image' as const },
])

export const MEDIA_SLOTS = [...SHARED_MEDIA_SLOTS, ...PRODUCT_SLOTS] as const
export type MediaSlotId = (typeof MEDIA_SLOTS)[number]['slot']

const MEDIA_SLOT_BY_ID = new Map<string, (typeof MEDIA_SLOTS)[number]>(MEDIA_SLOTS.map((item) => [item.slot, item]))

export function isMediaSlot(value: unknown): value is MediaSlotId {
  return typeof value === 'string' && MEDIA_SLOT_BY_ID.has(value)
}

export function mediaTypeForSlot(slot: string): MediaSlotType | null {
  return MEDIA_SLOT_BY_ID.get(slot)?.mediaType ?? null
}

/**
 * Raw, uncached slot resolver. Applies the full fail-closed publication gate in
 * SQL (approved + published + audited by a real platform_admin +
 * provenance-complete + https). Kept private so every public entry point flows
 * through the cache wrappers below and can never bypass this gate.
 */
async function fetchSlotMedia(slot: string): Promise<SlotMedia | null> {
  const expectedType = mediaTypeForSlot(slot)
  if (!expectedType) return null

  try {
    const rows = await db
      .select({
        id: platformMedia.id,
        key: platformMedia.key,
        url: platformMedia.url,
        alt: platformMedia.alt,
        filename: platformMedia.filename,
        mimeType: platformMedia.mimeType,
        rightsBasis: platformMedia.rightsBasis,
        rightsHolder: platformMedia.rightsHolder,
        rightsSource: platformMedia.rightsSource,
        approvalState: platformMedia.approvalState,
        approvedBy: platformMedia.approvedBy,
        approvalAuditId: platformMedia.approvalAuditId,
        approvedAt: platformMedia.approvedAt,
        objectState: platformMedia.objectState,
      })
      .from(platformMedia)
      .innerJoin(user, eq(platformMedia.approvedBy, user.id))
      .innerJoin(auditLog, eq(platformMedia.approvalAuditId, auditLog.id))
      .where(and(
        eq(platformMedia.slot, slot),
        eq(platformMedia.approvalState, 'approved'),
        eq(platformMedia.objectState, 'published'),
        isNotNull(platformMedia.approvedBy),
        isNotNull(platformMedia.approvalAuditId),
        isNotNull(platformMedia.approvedAt),
        eq(user.role, 'platform_admin'),
        eq(auditLog.actorId, platformMedia.approvedBy),
        eq(auditLog.action, 'media.approve'),
        eq(auditLog.resource, sql<string>`'platform_media:' || ${platformMedia.id}`),
        ne(platformMedia.alt, ''),
        ne(platformMedia.rightsBasis, 'unverified'),
        ne(platformMedia.rightsHolder, ''),
        ne(platformMedia.rightsSource, ''),
        ne(platformMedia.key, ''),
        ne(platformMedia.url, ''),
      ))
      .orderBy(desc(platformMedia.approvedAt), desc(platformMedia.createdAt))
      .limit(1)

    const row = rows[0]
    if (!row || !isPublishableMedia(row)) return null
    if (expectedType === 'image' && !row.mimeType.startsWith('image/')) return null
    if (expectedType === 'video' && !row.mimeType.startsWith('video/')) return null

    return {
      id: row.id,
      url: row.url,
      alt: row.alt,
      filename: row.filename,
      mimeType: row.mimeType,
      rightsBasis: row.rightsBasis as MediaRightsBasis,
      rightsHolder: row.rightsHolder,
      rightsSource: row.rightsSource,
    }
  } catch {
    return null
  }
}

/**
 * The only public slot resolver. Cross-request results are held in Next's data
 * cache for a bounded {@link MEDIA_SLOT_REVALIDATE_SECONDS} window and tagged so
 * admin mutations can invalidate them immediately (revalidateTag('media-slots')).
 * The cached value is already fully gated by {@link fetchSlotMedia}, so caching
 * never widens what is publishable. React cache() adds per-render dedup.
 */
export const getSlotMedia = cache((slot: string): Promise<SlotMedia | null> =>
  unstable_cache(
    () => fetchSlotMedia(slot),
    ['media-slot', slot],
    { revalidate: MEDIA_SLOT_REVALIDATE_SECONDS, tags: ['media-slots', `media-slot:${slot}`] },
  )(),
)

export async function getSlotImage(slot: string): Promise<SlotImage | null> {
  if (mediaTypeForSlot(slot) !== 'image') return null
  return getSlotMedia(slot)
}

/** Resolve a proof-linked logo by persisted media ID through the same gate. */
export async function getApprovedMediaById(id: string): Promise<SlotMedia | null> {
  if (!id.trim()) return null
  try {
    const rows = await db
      .select({
        id: platformMedia.id,
        key: platformMedia.key,
        url: platformMedia.url,
        alt: platformMedia.alt,
        filename: platformMedia.filename,
        mimeType: platformMedia.mimeType,
        rightsBasis: platformMedia.rightsBasis,
        rightsHolder: platformMedia.rightsHolder,
        rightsSource: platformMedia.rightsSource,
        approvalState: platformMedia.approvalState,
        approvedBy: platformMedia.approvedBy,
        approvalAuditId: platformMedia.approvalAuditId,
        approvedAt: platformMedia.approvedAt,
        objectState: platformMedia.objectState,
      })
      .from(platformMedia)
      .innerJoin(user, eq(platformMedia.approvedBy, user.id))
      .innerJoin(auditLog, eq(platformMedia.approvalAuditId, auditLog.id))
      .where(and(
        eq(platformMedia.id, id),
        eq(platformMedia.approvalState, 'approved'),
        eq(platformMedia.objectState, 'published'),
        isNotNull(platformMedia.approvedBy),
        isNotNull(platformMedia.approvalAuditId),
        isNotNull(platformMedia.approvedAt),
        eq(user.role, 'platform_admin'),
        eq(auditLog.actorId, platformMedia.approvedBy),
        eq(auditLog.action, 'media.approve'),
        eq(auditLog.resource, sql<string>`'platform_media:' || ${platformMedia.id}`),
      ))
      .limit(1)
    const row = rows[0]
    if (!row || !isPublishableMedia(row)) return null
    return {
      id: row.id,
      url: row.url,
      alt: row.alt,
      filename: row.filename,
      mimeType: row.mimeType,
      rightsBasis: row.rightsBasis as MediaRightsBasis,
      rightsHolder: row.rightsHolder,
      rightsSource: row.rightsSource,
    }
  } catch {
    return null
  }
}

/**
 * Shared publication-gate predicates: only media that is approved, published,
 * audited by a real platform admin, provenance-complete and https-served.
 * Mirrors {@link isPublishableMedia} in SQL so a bounded LIMIT/OFFSET page and
 * its COUNT stay consistent (no post-filter that would under-fill a page).
 */
const publishableGate = () =>
  and(
    eq(platformMedia.approvalState, 'approved'),
    eq(platformMedia.objectState, 'published'),
    isNotNull(platformMedia.approvedBy),
    isNotNull(platformMedia.approvalAuditId),
    isNotNull(platformMedia.approvedAt),
    eq(user.role, 'platform_admin'),
    eq(auditLog.actorId, platformMedia.approvedBy),
    eq(auditLog.action, 'media.approve'),
    eq(auditLog.resource, sql<string>`'platform_media:' || ${platformMedia.id}`),
    ne(platformMedia.alt, ''),
    ne(platformMedia.rightsBasis, 'unverified'),
    ne(platformMedia.rightsHolder, ''),
    ne(platformMedia.rightsSource, ''),
    ne(platformMedia.key, ''),
    ne(platformMedia.url, ''),
    ilike(platformMedia.url, 'https://%'),
  )

/**
 * Bounded, searchable page of approved **image** media eligible to bind to a
 * team-member photo. Same trust gate as {@link getApprovedMediaById}; never
 * loads the whole table just to filter in the browser.
 */
export async function listApprovedMediaPhotos({
  q = '',
  limit = 6,
  offset = 0,
}: {
  q?: string
  limit?: number
  offset?: number
}): Promise<{ rows: SlotMedia[]; total: number }> {
  const search = q.trim()
  const where = and(
    publishableGate(),
    ilike(platformMedia.mimeType, 'image/%'),
    search
      ? or(
          ilike(platformMedia.alt, `%${search}%`),
          ilike(platformMedia.filename, `%${search}%`),
          ilike(platformMedia.id, `%${search}%`),
          ilike(platformMedia.rightsHolder, `%${search}%`),
        )
      : undefined,
  )

  try {
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: platformMedia.id,
          url: platformMedia.url,
          alt: platformMedia.alt,
          filename: platformMedia.filename,
          mimeType: platformMedia.mimeType,
          rightsBasis: platformMedia.rightsBasis,
          rightsHolder: platformMedia.rightsHolder,
          rightsSource: platformMedia.rightsSource,
        })
        .from(platformMedia)
        .innerJoin(user, eq(platformMedia.approvedBy, user.id))
        .innerJoin(auditLog, eq(platformMedia.approvalAuditId, auditLog.id))
        .where(where)
        .orderBy(desc(platformMedia.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ n: count() })
        .from(platformMedia)
        .innerJoin(user, eq(platformMedia.approvedBy, user.id))
        .innerJoin(auditLog, eq(platformMedia.approvalAuditId, auditLog.id))
        .where(where),
    ])

    return {
      rows: rows.map((row) => ({
        id: row.id,
        url: row.url,
        alt: row.alt,
        filename: row.filename,
        mimeType: row.mimeType,
        rightsBasis: row.rightsBasis as MediaRightsBasis,
        rightsHolder: row.rightsHolder,
        rightsSource: row.rightsSource,
      })),
      total: totalRow[0]?.n ?? 0,
    }
  } catch {
    return { rows: [], total: 0 }
  }
}

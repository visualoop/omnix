/**
 * Slot-based image resolution.
 *
 * `getSlotImage('hero.background')` returns the most recent
 * platform_media row pinned to that slot, or null. Pages call this in
 * their server component to render the admin-uploaded image.
 *
 * Caching: every slot read is request-scoped (Next caches the DB query
 * for the duration of one render). For pages that need fresh images
 * after an upload, hit revalidatePath('/') from the upload route.
 */
import { desc, eq } from 'drizzle-orm'
import { db, platformMedia } from '@/db'

export interface SlotImage {
  url: string
  alt: string | null
  filename: string | null
  mimeType: string
  width?: number
  height?: number
}

export async function getSlotImage(slot: string): Promise<SlotImage | null> {
  const rows = await db
    .select()
    .from(platformMedia)
    .where(eq(platformMedia.slot, slot))
    .orderBy(desc(platformMedia.createdAt))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    url: row.url,
    alt: row.alt,
    filename: row.filename,
    mimeType: row.mimeType,
  }
}

/** Canonical slot identifiers. Adding a new slot? List it here so the
 * /admin/media page knows it exists + can render a labeled drop zone. */
export const MEDIA_SLOTS = [
  { slot: 'hero.background', label: 'Homepage hero — background', section: 'Homepage', aspect: '16/9', searchQuery: 'Kenyan small shop counter point of sale modern' },
  { slot: 'hero.product_shot', label: 'Homepage hero — product screenshot', section: 'Homepage', aspect: '4/3', searchQuery: 'POS software dashboard screen tablet' },
  { slot: 'module.dawa.hero', label: 'Dawa module — hero', section: 'Module pages', aspect: '16/9', searchQuery: 'pharmacy counter Kenya pharmacist dispensing' },
  { slot: 'module.retail.hero', label: 'Retail module — hero', section: 'Module pages', aspect: '16/9', searchQuery: 'retail shop minimart Kenya checkout counter' },
  { slot: 'module.hardware.hero', label: 'Hardware module — hero', section: 'Module pages', aspect: '16/9', searchQuery: 'hardware store building materials shop counter' },
  { slot: 'module.hospitality.hero', label: 'Hospitality module — hero', section: 'Module pages', aspect: '16/9', searchQuery: 'restaurant bar counter cashier Kenya' },
  { slot: 'pricing.hero', label: 'Pricing page — hero', section: 'Pricing', aspect: '16/9', searchQuery: 'small business owner Kenya shop using laptop' },
  { slot: 'about.team_photo', label: 'About page — team photo', section: 'About', aspect: '3/2', searchQuery: 'African software team office working' },
  { slot: 'og.default', label: 'Social card (Open Graph) — fallback', section: 'SEO', aspect: '1200/630', searchQuery: 'point of sale M-Pesa payment Kenya shop' },
] as const

export type SlotId = (typeof MEDIA_SLOTS)[number]['slot']

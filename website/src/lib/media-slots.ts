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

/**
 * Built-in default images, seeded to the omnix-media R2 bucket and
 * served via https://media.omnix.co.ke. These render out of the box so
 * the marketing site is never showing empty placeholders — the admin
 * can override any slot from /admin/media and the DB row wins.
 */
const SLOT_DEFAULTS: Record<string, string> = {
  'hero.background': 'https://media.omnix.co.ke/marketing/hero-background.jpg',
  'hero.product_shot': 'https://media.omnix.co.ke/marketing/hero-product_shot.png',
  'module.dawa.hero': 'https://media.omnix.co.ke/marketing/module-dawa-hero.jpg',
  'module.retail.hero': 'https://media.omnix.co.ke/marketing/module-retail-hero.jpg',
  'module.hardware.hero': 'https://media.omnix.co.ke/marketing/module-hardware-hero.jpg',
  'module.hospitality.hero': 'https://media.omnix.co.ke/marketing/module-hospitality-hero.jpg',
  'pricing.hero': 'https://media.omnix.co.ke/marketing/pricing-hero.jpg',
  'about.team_photo': 'https://media.omnix.co.ke/marketing/about-team_photo.jpg',
  'og.default': 'https://media.omnix.co.ke/marketing/og-default.jpg',
  // Homepage "Four trades" rows.
  'module-row.dawa-pharmacy': 'https://media.omnix.co.ke/marketing/module-row-dawa-pharmacy.jpg',
  'module-row.soko-retail': 'https://media.omnix.co.ke/marketing/module-row-soko-retail.jpg',
  'module-row.hardware': 'https://media.omnix.co.ke/marketing/module-row-hardware.jpg',
  'module-row.hospitality': 'https://media.omnix.co.ke/marketing/module-row-hospitality.jpg',
}

export async function getSlotImage(slot: string): Promise<SlotImage | null> {
  // Admin-uploaded image wins. Fall back to the seeded default so the
  // page never renders an empty placeholder.
  const fallback = (): SlotImage | null =>
    SLOT_DEFAULTS[slot]
      ? { url: SLOT_DEFAULTS[slot], alt: null, filename: null, mimeType: 'image/jpeg' }
      : null
  try {
    const rows = await db
      .select()
      .from(platformMedia)
      .where(eq(platformMedia.slot, slot))
      .orderBy(desc(platformMedia.createdAt))
      .limit(1)
    const row = rows[0]
    if (!row) return fallback()
    return {
      url: row.url,
      alt: row.alt,
      filename: row.filename,
      mimeType: row.mimeType,
    }
  } catch {
    // DB unreachable during build/preview — still show the default.
    return fallback()
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
  { slot: 'module-row.dawa-pharmacy', label: 'Homepage row — Dawa Pharmacy', section: 'Homepage trades', aspect: '16/10', searchQuery: 'pharmacy counter pharmacist dispensing medicine' },
  { slot: 'module-row.soko-retail', label: 'Homepage row — Soko Retail', section: 'Homepage trades', aspect: '16/10', searchQuery: 'minimart grocery shop shelves checkout' },
  { slot: 'module-row.hardware', label: 'Homepage row — Hardware', section: 'Homepage trades', aspect: '16/10', searchQuery: 'hardware store tools building materials' },
  { slot: 'module-row.hospitality', label: 'Homepage row — Hospitality', section: 'Homepage trades', aspect: '16/10', searchQuery: 'restaurant bar dining counter interior' },
] as const

export type SlotId = (typeof MEDIA_SLOTS)[number]['slot']

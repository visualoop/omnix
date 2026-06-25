/**
 * platform_media — uploaded images for the marketing site + admin slots.
 *
 * Every image gets:
 *   - `key`: R2 object key (e.g. "media/2026/06/hero-bg-abcdef.webp")
 *   - `url`: public CDN URL — what every consumer reads
 *   - `slot`: optional named pinpoint (e.g. "hero.background",
 *             "module.dawa.hero", "blog.first-post.featured"). The slot
 *             lets `getSlotImage(slot)` resolve a fixed identity to
 *             whatever the admin most recently uploaded.
 *
 * The same image can be referenced by multiple slots (just create
 * multiple platform_media rows with different `slot` values but the
 * same `key` + `url`). Cheaper than a join table; the data is tiny.
 */
import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

export const platformMedia = pgTable(
  'platform_media',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),                      // R2 object key
    url: text('url').notNull(),                      // public CDN URL
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    filename: text('filename'),                      // original filename for human reference
    alt: text('alt'),                                 // accessibility alt text
    /** Named slot binding (one image can fill many slots — duplicate the row). */
    slot: text('slot'),
    uploadedBy: text('uploaded_by').notNull(),       // user id
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slotIdx: index('platform_media_slot_idx').on(t.slot),
    createdAtIdx: index('platform_media_created_at_idx').on(t.createdAt),
  }),
)

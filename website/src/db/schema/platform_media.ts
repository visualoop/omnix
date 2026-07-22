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
import { auditLog } from './audit_log'
import { user } from './auth'

export const platformMedia = pgTable(
  'platform_media',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().default(''),          // public R2 object key; empty until approval
    url: text('url').notNull().default(''),          // public CDN URL; empty until approval
    quarantineKey: text('quarantine_key'),           // private object used for admin review
    objectState: text('object_state').notNull().default('quarantine'),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    filename: text('filename'),                      // original filename for human reference
    alt: text('alt').notNull().default(''),           // required before upload/approval
    /** Named slot binding (one image can fill many slots — duplicate the row). */
    slot: text('slot'),
    rightsBasis: text('rights_basis').notNull().default('unverified'),
    rightsHolder: text('rights_holder').notNull().default(''),
    rightsSource: text('rights_source').notNull().default(''),
    approvalState: text('approval_state').notNull().default('pending'),
    approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approvalAuditId: text('approval_audit_id').references(() => auditLog.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    uploadedBy: text('uploaded_by').notNull(),       // user id
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slotIdx: index('platform_media_slot_idx').on(t.slot),
    createdAtIdx: index('platform_media_created_at_idx').on(t.createdAt),
  }),
)

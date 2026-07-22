/**
 * Public marketing-team records. Photos reference governed platform media;
 * the legacy photo_url column remains only in the database for migration.
 */
import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { platformMedia } from './platform_media'

export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    bio: text('bio'),
    mediaId: text('media_id').references(() => platformMedia.id, { onDelete: 'set null' }),
    /** Optional links shown on the card. */
    linkedinUrl: text('linkedin_url'),
    /** Lower sorts first. */
    sortOrder: integer('sort_order').notNull().default(0),
    /** Hidden from the public page when false. */
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('team_members_active_idx').on(t.active),
    sortIdx: index('team_members_sort_idx').on(t.sortOrder),
    mediaIdx: index('team_members_media_idx').on(t.mediaId),
  }),
)

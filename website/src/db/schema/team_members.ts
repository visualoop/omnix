/**
 * team_members — the public-facing marketing team shown on /team.
 *
 * Distinct from the `user` / platform-staff tables (those are login
 * accounts with roles). A team member here is just content the admin
 * curates: name, role, bio, photo, and a sort order. No auth, no login.
 *
 * Photos are uploaded to R2 via /api/admin/media and the resulting
 * public URL is stored in `photo_url`.
 */
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    bio: text('bio'),
    photoUrl: text('photo_url'),
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
  }),
)

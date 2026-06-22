/**
 * Better Auth organization plugin tables.
 *
 * organization · member · invitation · team · teamMember
 *
 * All foreign keys to user.id cascade on user delete.
 */
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role'),
  status: text('status').notNull(),
  teamId: text('team_id'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const team = pgTable('team', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const teamMember = pgTable('team_member', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => team.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

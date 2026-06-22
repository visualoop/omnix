/**
 * Licenses — issued per customer + variant. Bound to one or more machines.
 *
 * Mirrors the legacy Payload `licenses` collection.
 */
import { pgTable, text, integer, timestamp, jsonb, doublePrecision, boolean, index } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { organization } from './org'

export const licenses = pgTable(
  'licenses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organization.id, { onDelete: 'set null' }),

    licenseKey: text('license_key').notNull().unique(),
    variant: text('variant').notNull(),                    // pro | dawa | retail | hospitality | hardware
    tier: text('tier').notNull().default('starter'),       // trial | starter | business
    status: text('status').notNull().default('trial'),     // trial | active | lapsed | suspended | revoked
    modules: jsonb('modules').notNull().default([]).$type<string[]>(),

    // Limits
    maxBranches: integer('max_branches').notNull().default(1),
    maxMachines: integer('max_machines').notNull().default(3),

    // RSA-signed payload (set on issue, never updated)
    signedKey: text('signed_key'),

    // Cycle dates
    trialStartedAt: timestamp('trial_started_at'),
    trialEndsAt: timestamp('trial_ends_at'),
    paidAt: timestamp('paid_at'),
    maintenanceUntil: timestamp('maintenance_until'),
    majorVersionCap: integer('major_version_cap').notNull().default(1),

    // Cloud backup add-on
    cloudBackupEnabled: boolean('cloud_backup_enabled').notNull().default(false),
    cloudBackupExpiresAt: timestamp('cloud_backup_expires_at'),

    // Pricing snapshot at purchase time
    priceFeePaid: doublePrecision('price_fee_paid'),
    currency: text('currency'),

    metadata: jsonb('metadata'),

    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('licenses_user_idx').on(t.userId),
    orgIdx: index('licenses_org_idx').on(t.organizationId),
    statusIdx: index('licenses_status_idx').on(t.status),
  }),
)

/**
 * Machines — every desktop install, one row per machine.
 *
 * Mirrors the legacy Payload `machines` collection. A machine self-
 * registers on first activation; the `auth_token_hash` is matched on
 * every telemetry POST. Each machine is bound to exactly one license.
 */
import { pgTable, text, integer, timestamp, jsonb, doublePrecision, index } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { organization } from './org'
import { licenses } from './licenses'

export const machines = pgTable(
  'machines',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    organizationId: text('organization_id').references(() => organization.id, { onDelete: 'set null' }),
    licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),

    // Identity
    machineId: text('machine_id').notNull().unique(),     // hardware fingerprint
    authTokenHash: text('auth_token_hash').notNull(),
    hostname: text('hostname'),
    os: text('os').default('windows'),
    osVersion: text('os_version'),
    arch: text('arch'),

    // App state
    currentVersion: text('current_version'),
    activeModule: text('active_module'),                  // core | dawa | retail | hardware | hospitality
    branchName: text('branch_name'),
    currency: text('currency').default('KES'),
    networkMode: text('network_mode'),                    // standalone | lan_master | lan_client

    // Rollups (denormalised — refreshed via telemetry heartbeats)
    productCount: integer('product_count'),
    employeeCount: integer('employee_count'),
    salesCountLast30d: integer('sales_count_last30d'),
    salesValueLast30d: doublePrecision('sales_value_last30d'),

    // Health
    status: text('status').notNull().default('active'),    // active | revoked | rebinding

    // Auto-update staging (v0.29.0)
    // channel: 'stable' (default — gets releases marked stable), 'canary' (gets releases marked beta first)
    // autoUpdateEnabled: false = machine skips auto-update entirely (manual only)
    updateChannel: text('update_channel').notNull().default('stable'),
    autoUpdateEnabled: text('auto_update_enabled').notNull().default('true'),

    lastSyncAt: timestamp('last_sync_at'),
    firstSeenAt: timestamp('first_seen_at'),
    lastSeenAt: timestamp('last_seen_at'),

    // Geo
    lastIp: text('last_ip'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    city: text('city'),
    county: text('county'),

    // Catch-all for fields we haven't flattened yet (lan peers, integrations
    // toggles, etc.). Future migrations promote frequently-queried fields.
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('machines_user_idx').on(t.userId),
    licenseIdx: index('machines_license_idx').on(t.licenseId),
    orgIdx: index('machines_org_idx').on(t.organizationId),
  }),
)

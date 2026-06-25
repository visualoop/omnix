/**
 * license_sync_log — one row per key processed by /api/licensing/sync.
 *
 * The desktop POSTs every locally-stored licence key on startup and the
 * server classifies each one into a status:
 *   - verified        : exists in DB, owned by current user
 *   - foreign         : exists in DB, owned by a different user
 *   - orphan_payload  : not in DB, no valid RSA signature
 *   - recreated       : not in DB, valid RSA sig + matching email → recreated
 *   - seat_taken      : owned, but at max_machines on different machines
 *
 * Reading the log gives support a single place to look when a customer
 * says "the app won't open" — every key they tried, every classification,
 * every timestamp.
 */
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const licenseSyncLog = pgTable(
  'license_sync_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    machineId: text('machine_id'),
    licenseKey: text('license_key').notNull(),
    status: text('status').notNull(),
    message: text('message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('license_sync_log_user_idx').on(t.userId),
  }),
)

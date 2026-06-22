/**
 * Activations — log of every license-bind attempt.
 */
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { licenses } from './licenses'
import { machines } from './machines'

export const activations = pgTable(
  'activations',
  {
    id: text('id').primaryKey(),
    licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
    machineId: text('machine_id').references(() => machines.id, { onDelete: 'set null' }),
    outcome: text('outcome').notNull(),                    // ok | fingerprint_mismatch | revoked | trial_expired | seat_full
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    licenseIdx: index('activations_license_idx').on(t.licenseId),
    createdIdx: index('activations_created_idx').on(t.createdAt),
  }),
)

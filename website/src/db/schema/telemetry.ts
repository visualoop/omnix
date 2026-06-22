/**
 * Telemetry events — high-volume, write-heavy. The cron telemetry-retention
 * route drops rows older than 90 days nightly.
 */
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { machines } from './machines'

export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: text('id').primaryKey(),
    machineId: text('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),                          // heartbeat | crash | error | event
    occurredAt: timestamp('occurred_at').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    machineIdx: index('telemetry_machine_idx').on(t.machineId),
    occurredIdx: index('telemetry_occurred_idx').on(t.occurredAt),
  }),
)

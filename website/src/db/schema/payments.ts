/**
 * Payments — Paystack-initiated transactions. One row per init call.
 * The webhook updates status + paid_at; refunds add a paired negative
 * row tied via parent_id.
 */
import { pgTable, text, doublePrecision, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { organization } from './org'
import { licenses } from './licenses'

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organization.id, { onDelete: 'set null' }),
    licenseId: text('license_id').references(() => licenses.id, { onDelete: 'set null' }),

    paystackReference: text('paystack_reference').notNull().unique(),
    purpose: text('purpose').notNull(),                    // license_fee | maintenance_renewal | major_upgrade | cloud_backup | extra_branch | extra_machine
    amount: doublePrecision('amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull().default('pending'),   // pending | success | failed | reversed
    paidAt: timestamp('paid_at'),
    parentId: text('parent_id'),                           // refund link
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('payments_user_idx').on(t.userId),
    licenseIdx: index('payments_license_idx').on(t.licenseId),
    statusIdx: index('payments_status_idx').on(t.status),
  }),
)

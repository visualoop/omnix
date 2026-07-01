/**
 * Resellers — external partners who sell Omnix licences on our behalf.
 * Each reseller is linked one-to-one to a user account. When they issue
 * a licence for a customer, we track:
 *   - which reseller issued it (licenses.resellerId)
 *   - what discount they got at wholesale
 *   - what commission they earned (aggregated on this row)
 *
 * Commission ledger entries live in `reseller_commissions` — one row per
 * payment. This table holds the summary + reseller profile.
 */
import { pgTable, text, integer, doublePrecision, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const resellers = pgTable(
  'resellers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),

    // The per-reseller discount off the retail price. Applied when the
    // reseller checks out with the reseller Paystack flow. Owner can
    // override the global tier ladder here per partner.
    discountPercent: integer('discount_percent').notNull().default(15),

    status: text('status').notNull().default('active'), // active | suspended

    // Rolling totals — updated on each successful payment where the
    // licence has resellerId set. Keeps `/reseller` dashboard cheap.
    totalLicensesIssued: integer('total_licenses_issued').notNull().default(0),
    totalRevenueBrought: doublePrecision('total_revenue_brought').notNull().default(0),
    totalCommissionEarned: doublePrecision('total_commission_earned').notNull().default(0),
    unpaidCommission: doublePrecision('unpaid_commission').notNull().default(0),
    commissionCurrency: text('commission_currency').notNull().default('KES'),

    approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),

    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('resellers_status_idx').on(t.status),
  }),
)

/**
 * Reseller commission ledger — one row per successful payment on a
 * reseller-issued licence. Used to build the payout report + prevent
 * double-crediting on refunds.
 */
export const resellerCommissions = pgTable(
  'reseller_commissions',
  {
    id: text('id').primaryKey(),
    resellerId: text('reseller_id').notNull().references(() => resellers.id, { onDelete: 'cascade' }),
    paymentId: text('payment_id').notNull().unique(),
    licenseId: text('license_id').notNull(),
    grossAmount: doublePrecision('gross_amount').notNull(),
    commissionAmount: doublePrecision('commission_amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull().default('pending'), // pending | paid | reversed
    paidOutAt: timestamp('paid_out_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    resellerIdx: index('reseller_commissions_reseller_idx').on(t.resellerId),
    statusIdx: index('reseller_commissions_status_idx').on(t.status),
  }),
)

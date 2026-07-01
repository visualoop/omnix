/**
 * Affiliates — referrers who bring us paying customers. Each affiliate
 * gets a unique short ref-code that they share as ?ref=CODE. Landing
 * pages set a 30-day `omnix_ref` cookie; on successful payment the
 * webhook credits the affiliate 1/3 of the payment value.
 *
 * Cap at first-purchase-only: credited only when the paying customer's
 * `affiliates.first_credited_user_ids` array doesn't contain them yet
 * — no compounding on renewals, upgrades, or extras.
 *
 * Anti-fraud:
 *   - Self-referral rejected: paying user must not equal affiliate.userId,
 *     and paying user.email must not equal affiliates.contactEmail.
 *   - Blocked affiliates (`blocked=true`) get no credit.
 */
import { pgTable, text, doublePrecision, boolean, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const affiliates = pgTable(
  'affiliates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),

    // Short shareable code — used in ?ref=CODE. Case-insensitive.
    refCode: text('ref_code').notNull().unique(),

    displayName: text('display_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    payoutMethod: text('payout_method'),   // paystack_transfer | mpesa_paybill | bank_transfer | mpesa_number
    payoutDetails: jsonb('payout_details').notNull().default({}),

    // Commission model — 1/3 of payment value on first purchase. This
    // percent can be tuned per-affiliate.
    commissionPercent: integer('commission_percent').notNull().default(33),

    // Rolling totals — updated on each credit.
    totalReferralsCredited: integer('total_referrals_credited').notNull().default(0),
    totalCommissionEarned: doublePrecision('total_commission_earned').notNull().default(0),
    unpaidBalance: doublePrecision('unpaid_balance').notNull().default(0),
    commissionCurrency: text('commission_currency').notNull().default('KES'),

    // Fraud + admin gates.
    blocked: boolean('blocked').notNull().default(false),
    blockedReason: text('blocked_reason'),
    approvedAt: timestamp('approved_at'),

    // Cache the set of user IDs we've credited from — enforces the
    // "first purchase only" cap. Small JSON array, capped at 500 recent
    // ids (well below any realistic per-affiliate volume).
    creditedUserIds: jsonb('credited_user_ids').notNull().default([]).$type<string[]>(),

    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    blockedIdx: index('affiliates_blocked_idx').on(t.blocked),
  }),
)

/**
 * Ledger of every credit — one row per attributed payment. Same
 * idempotency guarantee as `reseller_commissions` (paymentId UNIQUE).
 */
export const affiliateCredits = pgTable(
  'affiliate_credits',
  {
    id: text('id').primaryKey(),
    affiliateId: text('affiliate_id').notNull().references(() => affiliates.id, { onDelete: 'cascade' }),
    paymentId: text('payment_id').notNull().unique(),
    licenseId: text('license_id'),
    referredUserId: text('referred_user_id').notNull(),
    grossAmount: doublePrecision('gross_amount').notNull(),
    commissionAmount: doublePrecision('commission_amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull().default('pending'), // pending | paid | reversed | rejected_self_referral | rejected_repeat
    paidOutAt: timestamp('paid_out_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    affiliateIdx: index('affiliate_credits_affiliate_idx').on(t.affiliateId),
    statusIdx: index('affiliate_credits_status_idx').on(t.status),
  }),
)

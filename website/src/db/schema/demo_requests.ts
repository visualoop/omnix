import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export interface DemoAttribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export const demoRequests = pgTable(
  'demo_requests',
  {
    id: text('id').primaryKey(),
    status: text('status').notNull().default('new'),
    fullName: text('full_name').notNull(),
    workEmail: text('work_email').notNull(),
    phone: text('phone').notNull(),
    businessName: text('business_name').notNull(),
    product: text('product').notNull(),
    locationCount: integer('location_count').notNull().default(1),
    currentSystem: text('current_system'),
    priorities: jsonb('priorities').$type<string[]>().notNull().default([]),
    notes: text('notes'),
    preferredChannel: text('preferred_channel').notNull(),
    preferredWindow: text('preferred_window').notNull(),
    locale: text('locale').notNull().default('ke'),
    sourcePath: text('source_path').notNull(),
    referrer: text('referrer'),
    attribution: jsonb('attribution').$type<DemoAttribution>().notNull().default({}),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('demo_requests_status_idx').on(table.status),
    createdIdx: index('demo_requests_created_idx').on(table.createdAt),
    productIdx: index('demo_requests_product_idx').on(table.product),
  }),
)

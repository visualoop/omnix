/**
 * Public API tokens — issued to customers who want to integrate with Omnix
 * via REST. Distinct from the desktop's `api_tokens` table (LAN clients).
 */
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),          // human label: "Zapier integration", "My mobile app"
    tokenHash: text('token_hash').notNull().unique(),
    scopes: text('scopes'),                // comma-separated: 'read:products,read:customers,read:sales'
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => ({
    userIdx: index('api_tokens_user_idx').on(t.userId),
    hashIdx: index('api_tokens_hash_idx').on(t.tokenHash),
  }),
)

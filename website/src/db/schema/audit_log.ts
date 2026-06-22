/**
 * Audit log — system-wide. Every admin action, every payment success, every
 * licence issue / suspend / rebind, every user ban / impersonation. Cron
 * archives rows > 1 year old to cold S3 storage.
 */
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),                      // 'license.issue', 'user.ban', 'payment.refund'
    resource: text('resource'),                            // 'license:abc123', 'user:def456'
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_log_actor_idx').on(t.actorId),
    actionIdx: index('audit_log_action_idx').on(t.action),
    createdIdx: index('audit_log_created_idx').on(t.createdAt),
  }),
)

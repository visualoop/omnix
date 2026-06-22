/**
 * Support tickets + messages.
 * Threaded: tickets has summary fields; messages is the chronological log.
 */
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    category: text('category').notNull(),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('open'),       // open | pending | resolved | closed
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('support_tickets_user_idx').on(t.userId),
    statusIdx: index('support_tickets_status_idx').on(t.status),
  }),
)

export const supportMessages = pgTable(
  'support_messages',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    attachments: jsonb('attachments').default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    ticketIdx: index('support_messages_ticket_idx').on(t.ticketId),
  }),
)

/**
 * Cloud backups — encrypted blob metadata. Actual blobs in S3/R2.
 */
import { pgTable, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { machines } from './machines'

export const cloudBackups = pgTable(
  'cloud_backups',
  {
    id: text('id').primaryKey(),
    machineId: text('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    s3Key: text('s3_key').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    encryptedSha256: text('encrypted_sha256').notNull(),
    metadata: jsonb('metadata'),
    takenAt: timestamp('taken_at').notNull(),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => ({
    machineIdx: index('cloud_backups_machine_idx').on(t.machineId),
    userIdx: index('cloud_backups_user_idx').on(t.userId),
  }),
)

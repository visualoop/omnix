/**
 * Releases — desktop installer manifest. Read by the auto-updater on every
 * heartbeat. Editable from the new admin dashboard.
 */
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const releases = pgTable('releases', {
  id: text('id').primaryKey(),
  version: text('version').notNull().unique(),             // semver: 0.7.16
  channel: text('channel').notNull().default('stable'),    // stable | beta | nightly
  publishedAt: timestamp('published_at').notNull().defaultNow(),
  notes: text('notes'),                                    // markdown
  msiUrl: text('msi_url'),
  exeUrl: text('exe_url'),
  dmgUrl: text('dmg_url'),
  appImageUrl: text('app_image_url'),
  signature: text('signature'),                            // tauri-updater signature
  metadata: jsonb('metadata'),
})

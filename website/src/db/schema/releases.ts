/**
 * Releases — desktop and Android release manifest. Desktop fields remain the
 * Tauri updater contract; nullable Android fields are populated by signed CI.
 */
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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
  androidPlatform: text('android_platform'),               // android when a signed APK exists
  androidPackageId: text('android_package_id'),
  androidVersionCode: integer('android_version_code'),
  androidApkUrl: text('android_apk_url'),
  androidAabUrl: text('android_aab_url'),
  androidApkSize: integer('android_apk_size'),
  androidAabSize: integer('android_aab_size'),
  sha256Apk: text('sha256_apk'),
  sha256Aab: text('sha256_aab'),
  androidSigningCertificateSha256: text('android_signing_certificate_sha256'),
  metadata: jsonb('metadata'),
})

/**
 * Platform settings — admin-editable runtime config.
 *
 * Key/value rows with category tags. Sensitive values (Paystack secret,
 * Resend API key, Google OAuth secret, S3 keys) are encrypted at rest
 * using AES-256-GCM with a key derived from PLATFORM_SETTINGS_MASTER
 * env var.
 *
 * Access:
 *   - Read via getSetting(key) helper (cached 60s in-process)
 *   - Write via /api/admin/settings (platform_admin only)
 *   - Audit log entry on every write
 *
 * Why DB-stored vs env-only:
 *   The user wants to rotate secrets + tweak feature flags without a
 *   redeploy. Env-only forced a Vercel redeploy for every key rotation,
 *   which is slow and disruptive.
 */
import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core'

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),                            // e.g. 'paystack.secret_key'
  category: text('category').notNull(),                     // 'paystack' | 'email' | 'oauth' | 'storage' | 'feature_flags' | 'pricing'
  label: text('label').notNull(),                           // human-readable name for the admin UI
  description: text('description'),                         // helper text in the admin UI
  /** Whether the value is sensitive (masked in UI, encrypted at rest). */
  sensitive: boolean('sensitive').notNull().default(false),
  /** AES-256-GCM ciphertext (base64) when sensitive=true; otherwise plaintext. */
  value: text('value'),
  /** JSON metadata (validation rules, allowed values, etc.) */
  metadata: jsonb('metadata'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by'),
})

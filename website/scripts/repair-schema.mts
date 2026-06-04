/**
 * One-shot, idempotent production schema repair.
 *
 * Root cause: the prod DB has a batch=-1 row in payload_migrations (from
 * a prior dev-mode push). That causes `payload migrate` to show an interactive
 * prompt that defaults to NO in CI, silently skipping migrations. Result: the
 * Settings `integrations_*` columns never landed, so every findGlobal('settings')
 * 500s with `column "integrations_paystack_public_key" does not exist`.
 *
 * This script applies the missing DDL idempotently, then repairs the migration
 * ledger so future `payload migrate` is a clean no-op.
 *
 * Usage:  DATABASE_URL=... pnpm exec tsx scripts/repair-schema.mts
 */

import { Pool } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

const pool = new Pool({ connectionString: url })
const q = (sql: string) => pool.query(sql)

async function main() {
  // ── 1. Settings integrations columns (the ones causing the 500) ──────────
  const settingsCols: Array<[string, string]> = [
    ['integrations_paystack_public_key', 'varchar'],
    ['integrations_paystack_secret_key', 'varchar'],
    ['integrations_paystack_webhook_secret', 'varchar'],
    ['integrations_resend_api_key', 'varchar'],
    ['integrations_resend_from_email', 'varchar'],
    ['integrations_google_analytics_id', 'varchar'],
    ['integrations_cloud_backup_enabled', 'boolean DEFAULT false'],
    ['integrations_cloud_backup_price_monthly', 'numeric DEFAULT 500'],
    ['integrations_cloud_backup_retention_days', 'numeric DEFAULT 30'],
  ]
  for (const [col, type] of settingsCols) {
    await q(`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "${col}" ${type};`)
  }
  console.log('[repair] settings integrations columns OK')

  // ── 2. SEO meta fields on pages/blog_posts/modules ───────────────────────
  for (const t of ['pages', 'blog_posts', 'modules']) {
    await q(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "meta_title" varchar;`)
    await q(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "meta_description" varchar;`)
    await q(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;`)
  }
  console.log('[repair] meta columns OK')

  // ── 3. cloud_backups table (already existed per 403 proof, but ensure cols) ─
  // No-op if the CREATE in migration 2 already ran (it did, partially).

  // ── 4. Repair migration ledger ───────────────────────────────────────────
  // Remove the dev-push marker (batch=-1) that forces the interactive prompt.
  await q(`DELETE FROM "payload_migrations" WHERE "batch" = -1;`)

  // Mark both migrations as applied so `payload migrate` is a no-op going forward.
  for (const name of [
    '20260602_101348',
    '20260603_194237_seo_cloudbackups_settings',
  ]) {
    await q(`
      INSERT INTO "payload_migrations" ("name", "batch", "created_at", "updated_at")
      SELECT '${name}', 1, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "payload_migrations" WHERE "name" = '${name}');
    `)
  }
  console.log('[repair] migration ledger OK')

  const { rows } = await q(
    `SELECT "name", "batch" FROM "payload_migrations" ORDER BY "name";`,
  )
  console.log('[repair] ledger:', JSON.stringify(rows))
  console.log('[repair] done — re-run backfill-releases to sync v0.2.25')
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error('[repair] FAILED:', e)
    await pool.end()
    process.exit(1)
  })

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

import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

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

  // ── 3. cloud_backups table + payload_locked_documents_rels.cloud_backups_id
  await q(`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_cloud_backups_status" AS ENUM('pending', 'uploaded', 'pruned', 'quarantined');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await q(`
    CREATE TABLE IF NOT EXISTS "cloud_backups" (
      "id" serial PRIMARY KEY NOT NULL,
      "license_id" integer NOT NULL,
      "customer_id" integer NOT NULL,
      "machine_id" integer,
      "object_key" varchar NOT NULL,
      "bucket" varchar DEFAULT 'omnix-backups',
      "size_bytes" numeric,
      "sha256" varchar,
      "client_key_hint" varchar,
      "status" "enum_cloud_backups_status" DEFAULT 'pending',
      "prune_after" timestamp(3) with time zone,
      "finalized_at" timestamp(3) with time zone,
      "desktop_version" varchar,
      "source_rows" numeric,
      "source_size_bytes" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  // FKs and indexes (idempotent)
  for (const [name, ref] of [
    ['cloud_backups_license_id_licenses_id_fk', '"licenses"("id")'],
    ['cloud_backups_customer_id_customers_id_fk', '"customers"("id")'],
    ['cloud_backups_machine_id_machines_id_fk', '"machines"("id")'],
  ] as const) {
    const col = name.split('_')[2] + '_id'
    await q(`
      DO $$ BEGIN
        ALTER TABLE "cloud_backups"
          ADD CONSTRAINT "${name}"
          FOREIGN KEY ("${col}") REFERENCES "public".${ref}
          ON DELETE set null ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `)
  }
  for (const [idx, col, unique] of [
    ['cloud_backups_license_idx', 'license_id', false],
    ['cloud_backups_customer_idx', 'customer_id', false],
    ['cloud_backups_machine_idx', 'machine_id', false],
    ['cloud_backups_object_key_idx', 'object_key', true],
    ['cloud_backups_status_idx', 'status', false],
    ['cloud_backups_updated_at_idx', 'updated_at', false],
    ['cloud_backups_created_at_idx', 'created_at', false],
  ] as const) {
    await q(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx}" ON "cloud_backups" USING btree ("${col}");`)
  }
  console.log('[repair] cloud_backups table OK')

  await q(`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "cloud_backups_id" integer;`)
  await q(`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_cloud_backups_fk"
        FOREIGN KEY ("cloud_backups_id") REFERENCES "public"."cloud_backups"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await q(`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_cloud_backups_id_idx" ON "payload_locked_documents_rels" USING btree ("cloud_backups_id");`)
  console.log('[repair] payload_locked_documents_rels.cloud_backups_id OK')

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

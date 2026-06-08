import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — License variant binding.
 *
 * Adds a `variant` enum column to the licenses table. Variant identifies
 * which Omnix binary the license can activate:
 *
 *   - pro          → multi-trade (legacy v0.3.x users land here automatically)
 *   - dawa         → Omnix Dawa (Pharmacy)
 *   - retail       → Omnix Retail
 *   - hospitality  → Omnix Hospitality
 *   - hardware     → Omnix Hardware
 *
 * All existing rows default to 'pro' so v0.3.x customers continue to
 * activate today's binary (which becomes the Pro variant from v0.4.0).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Create the variant enum
    CREATE TYPE "public"."enum_licenses_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');

    -- Add the variant column with a default of 'pro' so existing rows backfill
    ALTER TABLE "licenses" ADD COLUMN "variant" "enum_licenses_variant" DEFAULT 'pro' NOT NULL;

    -- Index for filtering (analytics / dashboard / admin)
    CREATE INDEX "licenses_variant_idx" ON "licenses" USING btree ("variant");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "licenses_variant_idx";
    ALTER TABLE "licenses" DROP COLUMN IF EXISTS "variant";
    DROP TYPE IF EXISTS "public"."enum_licenses_variant";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — License + Release variant binding.
 *
 * Adds a `variant` enum column to both the licenses table and the
 * releases table. Variant identifies which Omnix binary the row applies to:
 *
 *   - pro          → multi-trade (legacy v0.3.x users land here automatically)
 *   - dawa         → Omnix Dawa (Pharmacy)
 *   - retail       → Omnix Retail
 *   - hospitality  → Omnix Hospitality
 *   - hardware     → Omnix Hardware
 *
 * All existing rows default to 'pro' so v0.3.x customers continue to
 * activate today's binary (which becomes the Pro variant from v0.4.0)
 * and the existing release archive is treated as Pro.
 *
 * The releases.version unique constraint is replaced with a composite
 * unique on (version, variant) since CI now publishes one release row
 * per variant per version (5 rows per release).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Shared variant enum (used by both licenses and releases)
    CREATE TYPE "public"."enum_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');

    -- ── Licenses ──
    ALTER TABLE "licenses" ADD COLUMN "variant" "enum_variant" DEFAULT 'pro' NOT NULL;
    CREATE INDEX "licenses_variant_idx" ON "licenses" USING btree ("variant");

    -- ── Releases ──
    ALTER TABLE "releases" ADD COLUMN "variant" "enum_variant" DEFAULT 'pro' NOT NULL;
    CREATE INDEX "releases_variant_idx" ON "releases" USING btree ("variant");

    -- Drop the version-only unique (we now allow one row per variant per version).
    -- Payload's auto-generated unique index name follows "<table>_<col>_idx" pattern.
    DROP INDEX IF EXISTS "releases_version_idx";
    ALTER TABLE "releases" DROP CONSTRAINT IF EXISTS "releases_version_unique";
    ALTER TABLE "releases" DROP CONSTRAINT IF EXISTS "releases_version_key";

    -- Composite unique: (version, variant)
    CREATE UNIQUE INDEX "releases_version_variant_unique_idx" ON "releases" USING btree ("version", "variant");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "releases_version_variant_unique_idx";
    DROP INDEX IF EXISTS "releases_variant_idx";
    DROP INDEX IF EXISTS "licenses_variant_idx";
    ALTER TABLE "releases" DROP COLUMN IF EXISTS "variant";
    ALTER TABLE "licenses" DROP COLUMN IF EXISTS "variant";
    DROP TYPE IF EXISTS "public"."enum_variant";

    -- Restore old single-column unique (best-effort; if duplicate version
    -- rows now exist this will fail and require manual cleanup).
    CREATE UNIQUE INDEX IF NOT EXISTS "releases_version_idx" ON "releases" USING btree ("version");
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Fix variant enum naming.
 *
 * The earlier 20260608_080000_license_variant migration created a SHARED
 * "enum_variant" type and used it for both licenses.variant and
 * releases.variant. Payload v3, however, expects per-table enums named
 * "enum_<table>_<field>" — i.e. "enum_licenses_variant" and
 * "enum_releases_variant".
 *
 * The mismatch caused every read of a license or release row to fail
 * with a generic 500 from the Payload REST layer (the underlying Drizzle
 * query references the wrong enum and Postgres rejects it).
 *
 * This migration creates the correct per-table enums and re-types the
 * variant columns. Idempotent — guards every step with IF NOT EXISTS /
 * IF EXISTS so re-runs are safe.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Per-table enums (Payload's expected naming) ─────────────────
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_licenses_variant') THEN
        CREATE TYPE "public"."enum_licenses_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_releases_variant') THEN
        CREATE TYPE "public"."enum_releases_variant" AS ENUM('pro', 'dawa', 'retail', 'hospitality', 'hardware');
      END IF;
    END $$;

    -- ── Re-type licenses.variant ────────────────────────────────────
    -- Drop default first (Postgres won't change column type with a default
    -- referencing the old type), change type, set default back.
    ALTER TABLE "licenses" ALTER COLUMN "variant" DROP DEFAULT;
    ALTER TABLE "licenses"
      ALTER COLUMN "variant" TYPE "public"."enum_licenses_variant"
      USING "variant"::text::"public"."enum_licenses_variant";
    ALTER TABLE "licenses" ALTER COLUMN "variant" SET DEFAULT 'pro';
    ALTER TABLE "licenses" ALTER COLUMN "variant" SET NOT NULL;

    -- ── Re-type releases.variant ────────────────────────────────────
    ALTER TABLE "releases" ALTER COLUMN "variant" DROP DEFAULT;
    ALTER TABLE "releases"
      ALTER COLUMN "variant" TYPE "public"."enum_releases_variant"
      USING "variant"::text::"public"."enum_releases_variant";
    ALTER TABLE "releases" ALTER COLUMN "variant" SET DEFAULT 'pro';
    ALTER TABLE "releases" ALTER COLUMN "variant" SET NOT NULL;

    -- ── Drop the shared enum (now unused) ───────────────────────────
    DROP TYPE IF EXISTS "public"."enum_variant";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No-op — we don't want to revert to the broken naming.
}

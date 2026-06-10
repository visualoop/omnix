import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.6 — Final pricing model.
 *
 * Trade variants (Dawa, Retail, Hospitality, Hardware) → KES 50,000 one-time.
 * Pro (multi-trade)                                    → KES 150,000 one-time.
 * Maintenance fee → 0 (perpetual licence, no annual renewal).
 *
 * Maps to Pricing global as:
 *   starter  = trade variants
 *   business = Pro
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "pricing"
    SET "starter_one_time_fee" = 50000,
        "starter_maintenance_yearly" = 0,
        "business_one_time_fee" = 150000,
        "business_maintenance_yearly" = 0;

    ALTER TABLE "pricing" ALTER COLUMN "starter_one_time_fee" SET DEFAULT 50000;
    ALTER TABLE "pricing" ALTER COLUMN "starter_maintenance_yearly" SET DEFAULT 0;
    ALTER TABLE "pricing" ALTER COLUMN "business_one_time_fee" SET DEFAULT 150000;
    ALTER TABLE "pricing" ALTER COLUMN "business_maintenance_yearly" SET DEFAULT 0;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {}

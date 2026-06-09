import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Update Pricing global to KES 30,000.
 *
 * The Pricing global was seeded with starter=100,000 / business=75,000.
 * The actual public price (per AGENTS.md, hero, pricing page, FAQ, all
 * variant landing pages) is KES 30,000 one-time + 12,000/year. The
 * checkout was reading the wrong amount from the global and showing
 * customers KES 100,000 at /buy/[licenseId].
 *
 * Brings every existing Pricing row to the correct numbers + sets
 * column defaults so future inserts pick up the right amounts.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "pricing"
    SET "starter_one_time_fee" = 30000,
        "business_one_time_fee" = 30000;

    ALTER TABLE "pricing" ALTER COLUMN "starter_one_time_fee" SET DEFAULT 30000;
    ALTER TABLE "pricing" ALTER COLUMN "business_one_time_fee" SET DEFAULT 30000;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pricing" ALTER COLUMN "starter_one_time_fee" SET DEFAULT 100000;
    ALTER TABLE "pricing" ALTER COLUMN "business_one_time_fee" SET DEFAULT 75000;
  `)
}

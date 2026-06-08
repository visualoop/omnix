import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Clean up probe/test customer rows.
 *
 * During the auth-flow debugging session a few customer rows were created
 * to verify the signup → login round-trip. They have @test-omnix.co.ke
 * email domains and were never owned by a real person. Also removes
 * justinequartz@gmail.com (id=4) which was created during the probe with
 * a debug password the real user doesn't know — they'll sign up cleanly
 * after this migration runs.
 *
 * The licenses afterChange-hook also creates a trial licence per customer,
 * so we delete those rows by customer first.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Find the customer ids we want to nuke
    WITH targets AS (
      SELECT id FROM "customers"
      WHERE "email" LIKE '%@test-omnix.co.ke'
         OR "email" = 'justinequartz@gmail.com'
    )
    DELETE FROM "licenses" WHERE "customer_id" IN (SELECT id FROM targets);

    DELETE FROM "customers"
    WHERE "email" LIKE '%@test-omnix.co.ke'
       OR "email" = 'justinequartz@gmail.com';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No-op — we cannot recreate deleted accounts without their original passwords.
}

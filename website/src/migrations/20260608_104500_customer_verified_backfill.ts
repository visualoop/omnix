import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Drop email-verification gate.
 *
 * The Customers collection had `auth.verify: true`, which made every login
 * fail with 401 until the customer clicked an email-verification link.
 * Resend delivery is flaky and many users never received the email.
 *
 * We've changed the collection config to `verify: false`. Payload also
 * tracks per-row verification status via the `_verified` column, which
 * existing rows still have set to `false` — so this migration marks every
 * existing customer as verified so they can log in immediately after the
 * config change deploys.
 *
 * Idempotent: running it again is a no-op (no rows where _verified is false).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "customers" SET "_verified" = true WHERE "_verified" IS DISTINCT FROM true;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Cannot reliably reverse — we don't know which rows were verified
  // before this migration ran. Keep them all verified.
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Clear stale customer lockouts.
 *
 * Payload locks customer accounts after 8 failed login attempts for 10 min.
 * During the email-verification debacle, several real users hit the lockout
 * because their failed attempts were caused by the (now-fixed) verify gate,
 * not by typos. This migration zeros loginAttempts and clears lockUntil
 * for every customer so they can log in immediately on the next attempt.
 *
 * Idempotent. Safe to re-run.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "customers"
    SET "loginAttempts" = 0,
        "lockUntil" = NULL
    WHERE "loginAttempts" > 0 OR "lockUntil" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No-op — we don't want to re-lock anyone.
}

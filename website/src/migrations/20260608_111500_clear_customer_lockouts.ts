import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * v0.4.0 — Clear stale customer lockouts.
 *
 * Postgres column names are snake_case (login_attempts, lock_until) even
 * though Payload references them as camelCase in queries.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "customers"
    SET "login_attempts" = 0,
        "lock_until" = NULL
    WHERE COALESCE("login_attempts", 0) > 0 OR "lock_until" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No-op
}

/**
 * Auto-migrate — runs the inlined migration SQL idempotently.
 *
 * Used by /api/migrate-db (manual, token-guarded) AND by ensureMigrated()
 * which runs ONCE per server process on first request, so a fresh deploy
 * self-migrates (creates team_members, etc.) without anyone hitting an
 * endpoint. Every statement is `IF NOT EXISTS` / tolerant of "already
 * exists", so re-running is safe and cheap.
 */
import { neon } from '@neondatabase/serverless'
import { MIGRATION_SQL, splitStatements } from '@/db/migration-sql'

export interface MigrateResult {
  ok: boolean
  statementCount: number
  failed: number
  errors: string[]
}

export async function runMigrations(): Promise<MigrateResult> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return { ok: false, statementCount: 0, failed: 0, errors: ['no DATABASE_URL'] }

  const sql = neon(url)
  const stmts = splitStatements(MIGRATION_SQL)
  const errors: string[] = []

  for (const s of stmts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sql as any).query(s)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists') || msg.includes('duplicate')) continue
      errors.push(`${s.split('\n')[0]?.slice(0, 60)}: ${msg}`)
    }
  }
  return { ok: errors.length === 0, statementCount: stmts.length, failed: errors.length, errors }
}

// Process-level guard so we only attempt the migration once per cold
// start, not on every request.
let migratePromise: Promise<MigrateResult> | null = null

/**
 * Ensure the schema is migrated. Idempotent + memoised per process.
 * Safe to call from a layout/route on every request — only the first
 * call does work.
 */
export function ensureMigrated(): Promise<MigrateResult> {
  if (!migratePromise) {
    migratePromise = runMigrations().catch((e) => ({
      ok: false,
      statementCount: 0,
      failed: 1,
      errors: [e instanceof Error ? e.message : String(e)],
    }))
  }
  return migratePromise
}

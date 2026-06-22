/**
 * /api/migrate-db — apply the inlined migration SQL to the connected DB.
 *
 * Reads the migration string from src/db/migration-sql.ts (bundled at
 * build time). Executes statements one by one, ignoring 'already exists'
 * errors so re-running is safe.
 *
 * Auth: Bearer BOOTSTRAP_TOKEN.
 */
import { neon } from '@neondatabase/serverless'
import { MIGRATION_SQL, splitStatements } from '@/db/migration-sql'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return Response.json({ error: 'no DATABASE_URL' }, { status: 500 })

  const sql = neon(url)
  const stmts = splitStatements(MIGRATION_SQL)

  const results: Array<{ ok: boolean; sql: string; error?: string }> = []
  for (const s of stmts) {
    try {
      // neon HTTP's sql() expects a tagged template; use the .query method
      // for raw runtime strings instead.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sql as any).query(s)
      results.push({ ok: true, sql: s.split('\n')[0]?.slice(0, 80) ?? '' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Tolerate already-exists errors so re-running is safe.
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push({ ok: true, sql: s.split('\n')[0]?.slice(0, 80) ?? '', error: 'already exists (skipped)' })
        continue
      }
      results.push({ ok: false, sql: s.split('\n')[0]?.slice(0, 80) ?? '', error: msg })
    }
  }

  const failed = results.filter((r) => !r.ok)
  return Response.json({
    ok: failed.length === 0,
    statementCount: stmts.length,
    failed: failed.length,
    results: failed.length > 0 ? failed : results.slice(0, 5),
  })
}

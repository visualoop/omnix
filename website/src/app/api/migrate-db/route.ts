/**
 * /api/migrate-db
 *
 * POST — apply the inlined migration SQL to the connected DB.
 *        Reads the migration string from src/db/migration-sql.ts (bundled at
 *        build time). Executes statements one by one, ignoring 'already exists'
 *        errors so re-running is safe.
 *
 * GET  — diagnostic: returns row counts for the most-used tables so we can
 *        confirm data was created without giving anyone DB-level access.
 *
 * Auth: Bearer BOOTSTRAP_TOKEN on both methods.
 */
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TABLES_FOR_COUNT = [
  'user', 'organization', 'member', 'invitation',
  'licenses', 'machines', 'payments', 'support_tickets',
  'audit_log', 'releases',
] as const

export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return Response.json({ error: 'no DATABASE_URL' }, { status: 500 })

  const sql = neon(url)
  const counts: Record<string, number | string> = {}
  for (const table of TABLES_FOR_COUNT) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (await (sql as any).query(`SELECT count(*)::int as n FROM "${table}"`)) as Array<{ n: number }>
      counts[table] = rows[0]?.n ?? 0
    } catch (e) {
      counts[table] = e instanceof Error ? `ERR: ${e.message}` : 'ERR'
    }
  }
  return Response.json({ ok: true, counts })
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return Response.json({ error: 'no DATABASE_URL' }, { status: 500 })

  const { runMigrations } = await import('@/lib/auto-migrate')
  const result = await runMigrations()
  return Response.json({
    ok: result.ok,
    statementCount: result.statementCount,
    failed: result.failed,
    errors: result.errors.slice(0, 20),
  })
}

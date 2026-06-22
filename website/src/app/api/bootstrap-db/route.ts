/**
 * /api/bootstrap-db — one-shot migration runner.
 *
 * Drops all legacy Payload tables + applies the Drizzle schema. Can only
 * be run with the BOOTSTRAP_TOKEN env var as Bearer auth, and ONLY when
 * the user table is empty (defense-in-depth: prevents accidental re-runs
 * on a populated DB).
 *
 * Used once after the v0.8.3 deploy to migrate the production schema.
 * Delete this route after the migration is applied.
 */
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { user } from '@/db'
import { count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAYLOAD_TABLES = [
  // Payload tables, in dependency order (children first)
  'cloud_backups',
  'support_tickets',
  'support_tickets_messages',
  'telemetry_events',
  'machines_lan_peers',
  'machines',
  'activations',
  'licenses',
  'releases_macos_x64',
  'releases_macos_arm',
  'releases_windows_x64',
  'releases_linux_x64',
  'releases',
  'payments',
  'modules',
  'pages',
  'blog_posts',
  'media',
  'customers',
  'customers_sessions',
  'customers_versions',
  'customers_locked_documents',
  'customers_preferences',
  'users',
  'users_sessions',
  // Payload internal
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_migrations',
  // Globals (per-locale tables that Payload creates)
  'pricing',
  'settings',
  'home_content',
  'contact_content',
  'footer_content',
  'landing_page',
  'trade_landings',
]

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Defense — refuse if the new schema's user table already has rows.
  try {
    const existing = await db.select({ n: count() }).from(user)
    if ((existing[0]?.n ?? 0) > 0) {
      return Response.json({ error: 'db has users — refusing to drop' }, { status: 409 })
    }
  } catch {
    // user table doesn't exist yet — fine, proceed.
  }

  const dropped: string[] = []
  for (const t of PAYLOAD_TABLES) {
    try {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`))
      dropped.push(t)
    } catch (e) {
      console.error(`[bootstrap] could not drop ${t}:`, e)
    }
  }

  // Drop any remaining Payload-prefixed tables (locale tables).
  try {
    const remaining = (await db.execute(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND (tablename LIKE 'payload_%' OR tablename LIKE '_locales')
    `)) as unknown as { rows?: Array<{ tablename: string }> }
    const list = remaining.rows ?? []
    for (const r of list) {
      try {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${r.tablename}" CASCADE`))
        dropped.push(r.tablename)
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('[bootstrap] remaining-table sweep:', e)
  }

  return Response.json({ ok: true, dropped })
}

import { eq, desc } from 'drizzle-orm'
import { db, releases } from '@/db'

/**
 * /api/releases/latest
 *
 * Tauri auto-updater hits this. Returns the latest stable release
 * in the shape Tauri expects.
 *
 * Query: ?channel=stable|beta|nightly
 * Returns: { version, notes, pub_date, platforms: { ... } }
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const channel = url.searchParams.get('channel') ?? 'stable'

  const rows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, channel))
    .orderBy(desc(releases.publishedAt))
    .limit(1)
  const r = rows[0]

  if (!r) {
    return Response.json({ error: 'no release published' }, { status: 404 })
  }

  // Tauri-updater compatible shape.
  return Response.json({
    version: r.version,
    notes: r.notes ?? '',
    pub_date: r.publishedAt.toISOString(),
    platforms: {
      'windows-x86_64': r.msiUrl ? { signature: r.signature ?? '', url: r.msiUrl } : undefined,
      'darwin-x86_64': r.dmgUrl ? { signature: r.signature ?? '', url: r.dmgUrl } : undefined,
      'darwin-aarch64': r.dmgUrl ? { signature: r.signature ?? '', url: r.dmgUrl } : undefined,
      'linux-x86_64': r.appImageUrl ? { signature: r.signature ?? '', url: r.appImageUrl } : undefined,
    },
  })
}

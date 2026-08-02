import { desc } from 'drizzle-orm'
import { db, releases } from '@/db'
import {
  isDesktopVariant,
  resolveDesktopUpdate, resolveDesktopUpdateFromReleases,
  type DesktopRelease,
} from '@/lib/desktop-updater'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export interface ReleasesLatestRow extends DesktopRelease {
  id: string
  channel: string
}

type LoadReleases = () => Promise<ReleasesLatestRow[]>

const responseHeaders = (status: string): HeadersInit => ({
  'Cache-Control': 'no-store',
  'X-Omnix-Updater-Status': status,
})

async function loadRecentReleases(): Promise<ReleasesLatestRow[]> {
  return db.select().from(releases).orderBy(desc(releases.publishedAt)).limit(20)
}

/**
 * Tauri v2 desktop updater endpoint.
 *
 * Installed apps send `variant` and their `license` (current version). Variant
 * assets and signatures are written by CI to metadata.variants. An incomplete
 * release is a 503 operational error; a 204 is reserved for a client that is
 * already on the latest version.
 */
export function createReleasesLatestHandler(loadReleases: LoadReleases = loadRecentReleases) {
  return async function GET(req: Request): Promise<Response> {
    const requestUrl = new URL(req.url)
    const rawVariant = requestUrl.searchParams.get('variant')?.toLowerCase() ?? 'pro'
    if (!isDesktopVariant(rawVariant)) {
      // Tauri's updater cannot parse an error body; it reports "update server
      // returned an unexpected json" and surfaces that to the customer. Every
      // non-update outcome is therefore 204 with a diagnostic header.
      console.error('[releases-latest] unknown desktop variant', { variant: rawVariant })
      return new Response(null, { status: 204, headers: responseHeaders('invalid-variant') })
    }

    const currentVersion = requestUrl.searchParams.get('license') ?? ''
    const rawChannel = requestUrl.searchParams.get('channel')?.toLowerCase() ?? 'stable'
    const channel = ['stable', 'beta', 'nightly'].includes(rawChannel) ? rawChannel : 'stable'

    let rows: ReleasesLatestRow[]
    try {
      rows = await loadReleases()
    } catch (error) {
      console.error('[releases-latest] database read failed', { variant: rawVariant, error })
      return new Response(null, { status: 204, headers: responseHeaders('database-error') })
    }

    const channelRows = rows.filter((row) => row.channel === channel)
    const candidates = channelRows.length > 0 ? channelRows : rows.filter((row) => row.channel === 'stable')
    const latest = candidates[0] ?? rows[0]
    if (!latest) {
      return new Response(null, { status: 204, headers: responseHeaders('no-release') })
    }

    const resolution = resolveDesktopUpdateFromReleases(
      candidates.length > 0 ? candidates : rows,
      rawVariant,
      currentVersion,
    )
    if (resolution.status === 'up-to-date') {
      return new Response(null, { status: 204, headers: responseHeaders('up-to-date') })
    }

    if (resolution.status === 'missing-assets') {
      console.error('[releases-latest] incomplete variant metadata', {
        releaseId: latest.id,
        version: latest.version,
        variant: rawVariant,
        missing: resolution.missing,
      })
      return new Response(null, { status: 204, headers: responseHeaders('missing-assets') })
    }

    return Response.json(resolution.manifest, {
      headers: responseHeaders('update'),
    })
  }
}

export const GET = createReleasesLatestHandler()

import { desc } from 'drizzle-orm'
import { db, releases } from '@/db'
import {
  isDesktopVariant,
  resolveDesktopUpdate,
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
      return Response.json(
        { error: `unknown desktop variant ${rawVariant}` },
        { status: 400, headers: responseHeaders('invalid-variant') },
      )
    }

    const currentVersion = requestUrl.searchParams.get('license') ?? ''
    const rawChannel = requestUrl.searchParams.get('channel')?.toLowerCase() ?? 'stable'
    const channel = ['stable', 'beta', 'nightly'].includes(rawChannel) ? rawChannel : 'stable'

    let rows: ReleasesLatestRow[]
    try {
      rows = await loadReleases()
    } catch (error) {
      console.error('[releases-latest] database read failed', { variant: rawVariant, error })
      return Response.json(
        { error: 'release metadata is temporarily unavailable', variant: rawVariant },
        { status: 503, headers: responseHeaders('database-error') },
      )
    }

    const latest =
      rows.find((row) => row.channel === channel) ??
      rows.find((row) => row.channel === 'stable') ??
      rows[0]
    if (!latest) {
      return Response.json(
        { error: 'no desktop release is published', variant: rawVariant },
        { status: 404, headers: responseHeaders('no-release') },
      )
    }

    const resolution = resolveDesktopUpdate(latest, rawVariant, currentVersion)
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
      return Response.json(
        {
          error: `release metadata is incomplete for variant ${rawVariant}`,
          version: latest.version,
          variant: rawVariant,
          missing: resolution.missing,
        },
        { status: 503, headers: responseHeaders('missing-assets') },
      )
    }

    return Response.json(resolution.manifest, {
      headers: responseHeaders('update'),
    })
  }
}

export const GET = createReleasesLatestHandler()

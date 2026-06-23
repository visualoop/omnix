import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, releases, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pull the latest N GitHub releases into the local releases table.
 *
 * Auth: platform_admin OR Bearer BOOTSTRAP_TOKEN (so it can be hit from
 * a CI workflow after every successful build without requiring a session).
 *
 * For each release:
 *   - version = tag without 'v' prefix
 *   - exeUrl  = first asset matching /Omnix_<v>_x64-setup\.exe$/
 *   - msiUrl  = first asset matching /Omnix_<v>_x64.*\.msi$/
 *   - signature = the matching .sig content, fetched + base64-encoded
 *                 (Tauri updater format).
 *   - notes   = release body
 *
 * Idempotent — upserts by version.
 *
 * The legacy 'Omnix_<v>' (no variant suffix) binary is the multi-trade
 * Pro build, which is the canonical "Omnix" installer. Per-variant
 * binaries (Dawa / Retail / Hospitality / Hardware) live in the same
 * GitHub release but the website's downloads page renders ONE row per
 * version — every variant card shares the same Pro installer for now.
 *
 * (The original Payload schema split releases by variant. Drizzle
 *  unified them. Per-variant URLs come back as a v0.9.x improvement
 *  if the user wants distinct binaries on the downloads page.)
 */

const GITHUB_OWNER = 'visualoop'
const GITHUB_REPO = 'omnix'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`

interface GhAsset {
  name: string
  size: number
  browser_download_url: string
  content_type: string
}

interface GhRelease {
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  published_at: string
  assets: GhAsset[]
}

async function authorize(req: Request): Promise<{ ok: boolean; status?: number; actor: string }> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (bearer && bearer === process.env.BOOTSTRAP_TOKEN) return { ok: true, actor: 'bootstrap' }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { ok: false, status: 401, actor: '' }
  if (session.user.role !== 'platform_admin') return { ok: false, status: 403, actor: '' }
  return { ok: true, actor: session.user.id }
}

export async function POST(req: Request) {
  const a = await authorize(req)
  if (!a.ok) return Response.json({ error: a.status === 401 ? 'unauthenticated' : 'forbidden' }, { status: a.status ?? 401 })

  const url = new URL(req.url)
  const limit = Math.min(20, Number(url.searchParams.get('limit') ?? '5'))

  // Optional: GH_TOKEN env raises rate limit from 60 → 5000 req/h.
  const ghHeaders: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GH_TOKEN) {
    ;(ghHeaders as Record<string, string>).Authorization = `Bearer ${process.env.GH_TOKEN}`
  }

  const res = await fetch(`${GITHUB_API}?per_page=${limit}`, { headers: ghHeaders, cache: 'no-store' })
  if (!res.ok) {
    return Response.json({ error: `GitHub API ${res.status}` }, { status: 502 })
  }

  const ghReleases = (await res.json()) as GhRelease[]
  const inserted: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const r of ghReleases) {
    if (r.draft) { skipped.push(`${r.tag_name} (draft)`); continue }
    const version = r.tag_name.replace(/^v/, '')

    // Find canonical Pro installer (no variant suffix).
    const exeAsset = r.assets.find((a) => /^Omnix_[\d.]+_x64-setup\.exe$/i.test(a.name))
    const msiAsset = r.assets.find((a) => /^Omnix_[\d.]+_x64.*\.msi$/i.test(a.name))
    const sigAsset = r.assets.find((a) => /^Omnix_[\d.]+_x64-setup\.exe\.sig$/i.test(a.name))

    if (!exeAsset && !msiAsset) {
      skipped.push(`${r.tag_name} (no installers found)`)
      continue
    }

    // Fetch the .sig content if present (small, ~400 bytes).
    let signature: string | null = null
    if (sigAsset) {
      try {
        const sigRes = await fetch(sigAsset.browser_download_url, { cache: 'no-store' })
        if (sigRes.ok) signature = (await sigRes.text()).trim()
      } catch { /* skip */ }
    }

    const channel = r.prerelease ? 'beta' : 'stable'
    const publishedAt = new Date(r.published_at)

    // Strip GH's auto-generated changelog repetition.
    const notesLines = (r.body ?? '').split('\n')
    const dedupedNotes = Array.from(new Set(notesLines)).join('\n').trim()

    const existing = (await db.select().from(releases).where(eq(releases.version, version)).limit(1))[0]
    if (existing) {
      await db.update(releases).set({
        channel,
        publishedAt,
        notes: dedupedNotes || `Omnix ${version}`,
        exeUrl: exeAsset?.browser_download_url ?? existing.exeUrl,
        msiUrl: msiAsset?.browser_download_url ?? existing.msiUrl,
        signature: signature ?? existing.signature,
        metadata: {
          assetCount: r.assets.length,
          source: 'github',
          syncedAt: new Date().toISOString(),
        },
      }).where(eq(releases.id, existing.id))
      updated.push(version)
    } else {
      await db.insert(releases).values({
        id: createId(),
        version,
        channel,
        publishedAt,
        notes: dedupedNotes || `Omnix ${version}`,
        exeUrl: exeAsset?.browser_download_url ?? null,
        msiUrl: msiAsset?.browser_download_url ?? null,
        signature,
        metadata: {
          assetCount: r.assets.length,
          source: 'github',
          syncedAt: new Date().toISOString(),
        },
      })
      inserted.push(version)
    }
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: a.actor,
    action: 'releases.sync_from_github',
    resource: 'releases',
    metadata: { inserted, updated, skipped },
  })

  return Response.json({ ok: true, inserted, updated, skipped, processed: ghReleases.length })
}

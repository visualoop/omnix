/**
 * /api/releases-latest
 *
 * Tauri auto-updater endpoint. The installed desktop apps all query
 * this URL (see src-tauri/tauri.conf.json + tauri.<variant>.conf.json).
 * Every variant hits the same URL and passes:
 *   ?variant=<pro|dawa|retail|hospitality|hardware>
 *   ?license=<current-version>   (Tauri auto-fills {{current_version}})
 *
 * We match `?variant=` against the per-variant asset URLs stashed in
 * `releases.metadata.variants[variant].{exe,msi,signature}` (populated
 * by /api/admin/releases/sync-from-github). If the variant has no
 * asset yet we fall back to the top-level msiUrl/exeUrl (which is the
 * canonical Pro build).
 *
 * Response shape follows Tauri v2 updater spec — see
 * https://v2.tauri.app/plugin/updater/#server-json-format.
 *
 * When there's no update available we return 204 No Content so the
 * updater plugin doesn't log an error to the client.
 */
import { desc } from 'drizzle-orm'
import { db, releases } from '@/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
const ALLOWED_VARIANTS: VariantId[] = ['pro', 'dawa', 'retail', 'hospitality', 'hardware']

interface VariantAssets {
  exe?: string
  msi?: string
  signature?: string
}

/** Semver-compare — returns positive if a > b, 0 equal, negative if a < b. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rawVariant = url.searchParams.get('variant')?.toLowerCase() ?? 'pro'
  const variant = (ALLOWED_VARIANTS.includes(rawVariant as VariantId) ? rawVariant : 'pro') as VariantId
  const currentVersion = url.searchParams.get('license') ?? ''

  // Pick the newest stable release. If none exists we return 204 so the
  // updater treats it as "no update" instead of surfacing a JSON error.
  let latest
  try {
    const rows = await db
      .select()
      .from(releases)
      .orderBy(desc(releases.publishedAt))
      .limit(10)
    // Prefer stable channel; fall back to any released row so pre-release
    // builds still get an answer.
    latest = rows.find((r) => r.channel === 'stable') ?? rows[0]
  } catch (e) {
    // DB cold or table missing — treat as no-update.
    console.error('[releases-latest] db read failed:', e)
    return new Response(null, { status: 204 })
  }
  if (!latest) return new Response(null, { status: 204 })

  // If the caller is already on the latest version, tell the updater
  // there's nothing to do (204). This saves the client from downloading
  // + validating a signature it doesn't need.
  if (currentVersion && compareVersions(currentVersion, latest.version) >= 0) {
    return new Response(null, { status: 204 })
  }

  // Pull per-variant assets from metadata; fall back to top-level fields.
  const variants =
    ((latest.metadata as { variants?: Partial<Record<VariantId, VariantAssets>> } | null)?.variants) ??
    ({} as Partial<Record<VariantId, VariantAssets>>)
  const va: VariantAssets = variants[variant] ?? {}
  const proAssets: VariantAssets = variants.pro ?? {}

  // Prefer the NSIS .exe setup for Tauri updater; fall back to .msi if
  // that's all the sync captured for this variant, then to Pro's, then
  // to the top-level exeUrl/msiUrl (which is Pro-canonical by design).
  const url_ =
    va.exe ??
    va.msi ??
    proAssets.exe ??
    proAssets.msi ??
    latest.exeUrl ??
    latest.msiUrl ??
    null

  // Signature — variant-specific if the sync grabbed it, else Pro's,
  // else the top-level signature column (set to Pro's sig by the sync).
  const signature = va.signature ?? proAssets.signature ?? latest.signature ?? ''

  if (!url_) {
    // Latest row exists but has no installer URL populated — treat as
    // no update rather than serving a JSON with an empty url that would
    // break the download step.
    return new Response(null, { status: 204 })
  }

  // Tauri v2 updater expected JSON body.
  return Response.json({
    version: latest.version,
    notes: latest.notes ?? `Omnix ${latest.version}`,
    pub_date: latest.publishedAt.toISOString(),
    platforms: {
      'windows-x86_64': { signature, url: url_ },
      // We only ship Windows installers today, but keeping macOS/Linux
      // keys here means when we add those the updater picks them up
      // without a code change — just populate the DB URL columns.
      ...(latest.dmgUrl
        ? {
            'darwin-x86_64': { signature, url: latest.dmgUrl },
            'darwin-aarch64': { signature, url: latest.dmgUrl },
          }
        : {}),
      ...(latest.appImageUrl
        ? { 'linux-x86_64': { signature, url: latest.appImageUrl } }
        : {}),
    },
  })
}

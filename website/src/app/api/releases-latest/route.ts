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
import { desc, eq } from 'drizzle-orm'
import { db, releases } from '@/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'
const ALLOWED_VARIANTS: VariantId[] = ['dawa', 'retail', 'hospitality', 'hardware', 'salon']

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

  // Channel selection — 'beta' or 'nightly' opt-in via ?channel=X, else 'stable'.
  // Canary machines pass channel=beta so they get pre-release versions first.
  // See /api/updater/gate for who decides which channel a machine is on.
  const rawChannel = url.searchParams.get('channel')?.toLowerCase() ?? 'stable'
  const channel = ['stable', 'beta', 'nightly'].includes(rawChannel) ? rawChannel : 'stable'

  // Pick the newest stable release. If none exists we return 204 so the
  // updater treats it as "no update" instead of surfacing a JSON error.
  let latest
  try {
    const rows = await db
      .select()
      .from(releases)
      .orderBy(desc(releases.publishedAt))
      .limit(20)
    // Channel selection: canary machines pass ?channel=beta and receive
    // the latest beta release (which becomes the pre-flight test build).
    // Everyone else defaults to stable. If nothing on the requested
    // channel, fall back to stable so no machine ever gets stranded.
    latest =
      rows.find((r) => r.channel === channel) ??
      rows.find((r) => r.channel === 'stable') ??
      rows[0]
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
  // else the top-level signature column. If ALL are missing but we have
  // a URL, lazy-fetch the sibling `.sig` file from R2 (CI uploads it
  // alongside the installer) and persist it back to
  // metadata.variants[variant].signature so subsequent reads skip the
  // network hop. Fixes v0.16.4-v0.27.1 releases that shipped with an
  // empty signature because /api/releases-sync only wrote signatures
  // when variant='pro' (which we don't build).
  let signature = va.signature ?? proAssets.signature ?? latest.signature ?? ''

  if (!signature && url_) {
    try {
      // Encode the URL. CI stores paths like ".../Omnix Dawa_0.27.1_x64-setup.exe"
      // with a raw space. Cloudflare R2 returns 400 without percent-encoding.
      // encodeURI is safe here because it preserves the scheme + host structure.
      const safeUrl = encodeURI(url_)
      const sigUrl = `${safeUrl}.sig`
      const res = await fetch(sigUrl, { cache: 'no-store' })
      if (res.ok) {
        signature = (await res.text()).trim()
        // Write back so we don't refetch on every request. Best-effort —
        // if the DB write fails, we still return the sig on this
        // response so the caller isn't blocked by our self-heal.
        try {
          const nextVariants = {
            ...variants,
            [variant]: { ...va, signature },
          }
          await db
            .update(releases)
            .set({
              metadata: {
                ...((latest.metadata as Record<string, unknown> | null) ?? {}),
                variants: nextVariants,
                selfHealedAt: new Date().toISOString(),
              },
            })
            .where(eq(releases.id, latest.id))
        } catch (e) {
          console.warn('[releases-latest] sig self-heal write failed:', e)
        }
      } else {
        console.warn(`[releases-latest] sig fetch ${sigUrl} → HTTP ${res.status}`)
      }
    } catch (e) {
      console.warn('[releases-latest] sig fetch threw:', e)
    }
  }

  if (!url_) {
    // Latest row exists but has no installer URL populated — treat as
    // no update rather than serving a JSON with an empty url that would
    // break the download step.
    return new Response(null, { status: 204 })
  }

  // Tauri v2 updater expected JSON body. URL-encode paths so raw
  // spaces in filenames (e.g. "Omnix Dawa_0.27.1_x64-setup.exe") don't
  // break reqwest's download step on the client.
  const safeInstallerUrl = encodeURI(url_)
  return Response.json({
    version: latest.version,
    notes: latest.notes ?? `Omnix ${latest.version}`,
    pub_date: latest.publishedAt.toISOString(),
    platforms: {
      'windows-x86_64': { signature, url: safeInstallerUrl },
      // We only ship Windows installers today, but keeping macOS/Linux
      // keys here means when we add those the updater picks them up
      // without a code change — just populate the DB URL columns.
      ...(latest.dmgUrl
        ? {
            'darwin-x86_64': { signature, url: encodeURI(latest.dmgUrl) },
            'darwin-aarch64': { signature, url: encodeURI(latest.dmgUrl) },
          }
        : {}),
      ...(latest.appImageUrl
        ? { 'linux-x86_64': { signature, url: encodeURI(latest.appImageUrl) } }
        : {}),
    },
  })
}

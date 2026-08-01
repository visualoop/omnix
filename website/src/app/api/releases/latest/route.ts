import { and, eq, desc, isNotNull } from 'drizzle-orm'
import { db, releases } from '@/db'
import { isDesktopVariant, resolveDesktopUpdate } from '@/lib/desktop-updater'

const PINNED_ANDROID_RELEASE_CERTIFICATE =
  'c7f91eb28f7b6c6b23781382dc30b8c360cb2780d8c6b74db9ff07013fcd08bb'

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

  if (url.searchParams.get('platform') === 'android') {
    const currentVersionCode = Number.parseInt(url.searchParams.get('versionCode') ?? '0', 10)
    const requestedReleaseId = url.searchParams.get('releaseId')
    if (!Number.isSafeInteger(currentVersionCode) || currentVersionCode < 0) {
      return Response.json({ error: 'invalid Android version code' }, { status: 400 })
    }

    const androidRows = await db
      .select()
      .from(releases)
      .where(and(eq(releases.channel, channel), isNotNull(releases.androidApkUrl)))
      .orderBy(desc(releases.publishedAt))
      .limit(1)
    const android = androidRows[0]
    if (
      !android ||
      android.androidPackageId !== 'co.ke.omnix.app' ||
      android.androidPlatform !== 'android' ||
      !android.androidVersionCode ||
      android.androidVersionCode <= currentVersionCode ||
      !android.androidApkUrl ||
      !android.androidApkSize ||
      !android.sha256Apk ||
      android.androidSigningCertificateSha256?.toLowerCase() !== PINNED_ANDROID_RELEASE_CERTIFICATE ||
      (requestedReleaseId !== null && requestedReleaseId !== android.id)
    ) {
      return new Response(null, { status: 204 })
    }

    return Response.json(
      {
        releaseId: android.id,
        versionName: android.version,
        versionCode: android.androidVersionCode,
        downloadUrl: android.androidApkUrl,
        sha256: android.sha256Apk.toLowerCase(),
        signingCertificateSha256: PINNED_ANDROID_RELEASE_CERTIFICATE,
        sizeBytes: android.androidApkSize,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const variant = url.searchParams.get('variant')?.toLowerCase()
  if (!variant || !isDesktopVariant(variant)) {
    return Response.json(
      { error: 'a valid desktop `variant` query parameter is required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const rows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, channel))
    .orderBy(desc(releases.publishedAt))
    .limit(1)
  const release = rows[0]

  if (!release) {
    return Response.json({ error: 'no release published' }, { status: 404 })
  }

  const resolution = resolveDesktopUpdate(release, variant, '')
  if (resolution.status === 'missing-assets') {
    console.error('[releases/latest] incomplete desktop variant metadata', {
      releaseId: release.id,
      version: release.version,
      variant,
      missing: resolution.missing,
    })
    return Response.json(
      {
        error: `release metadata is incomplete for variant ${variant}`,
        version: release.version,
        missing: resolution.missing,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // An empty current version can never resolve as up-to-date.
  if (resolution.status !== 'update') {
    return new Response(null, { status: 204 })
  }
  return Response.json(resolution.manifest, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

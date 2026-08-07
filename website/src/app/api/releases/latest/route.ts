import { and, eq, desc, isNotNull } from 'drizzle-orm'
import { db, releases } from '@/db'
import { GET as resolveDesktopRequest } from '../../releases-latest/route'

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

  // Desktop updates resolve through the hardened handler behind
  // /api/releases-latest. This path used to carry a second copy that answered
  // 400/404/503 with a JSON body, which Tauri cannot parse — it surfaces
  // "update server returned an unexpected json" to the customer. That copy also
  // read only the newest release, so it had no fallback: the Android-only
  // v0.77.0 made it report every desktop variant as broken with HTTP 503 even
  // though v0.76.1 had complete signed installers. One resolver, one contract:
  // only a real manifest returns 200, every other outcome is 204 with
  // X-Omnix-Updater-Status.
  return resolveDesktopRequest(req)
}

import { and, eq, desc, isNotNull } from 'drizzle-orm'
import { db, releases } from '@/db'

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

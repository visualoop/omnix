import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { db, releases } from '@/db'

export interface AndroidRelease {
  version: string
  apkUrl: string | null
  apkSize: number | null
  sha256: string | null
}

/** Returns the newest stable signed Android artifact published in the release record. */
export async function getLatestAndroidRelease(): Promise<AndroidRelease | undefined> {
  try {
    return (
      await db
        .select({
          version: releases.version,
          apkUrl: releases.androidApkUrl,
          apkSize: releases.androidApkSize,
          sha256: releases.sha256Apk,
        })
        .from(releases)
        .where(and(eq(releases.channel, 'stable'), isNotNull(releases.androidApkUrl)))
        .orderBy(desc(releases.publishedAt))
        .limit(1)
    )[0]
  } catch (error) {
    console.error('[android-release] Latest release lookup failed:', error)
    return undefined
  }
}

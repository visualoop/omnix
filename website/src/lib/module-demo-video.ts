/**
 * Public resolver for admin-managed module demo videos.
 *
 * Fail-closed by construction:
 *   - Any DB / table / connection error resolves to null (no video state).
 *   - Only a published row that passes `toPublicModuleDemoVideo` (valid product,
 *     valid 11-char ID, non-empty title + summary) is ever returned.
 *   - It returns the normalised video ID only — never the raw admin URL — so a
 *     public embed can only ever be built from youtube-nocookie.com/embed/<id>.
 *   - No outbound metadata fetch is performed.
 */
import { eq } from 'drizzle-orm'
import { db, moduleDemoVideos } from '@/db'
import {
  toPublicModuleDemoVideo,
  type ModuleDemoProduct,
  type PublicModuleDemoVideo,
} from '@/lib/youtube-demo'

/** Resolve the published, complete, valid demo video for one product, or null. */
export async function getPublishedModuleDemoVideo(
  product: ModuleDemoProduct,
): Promise<PublicModuleDemoVideo | null> {
  try {
    const rows = await db
      .select({
        product: moduleDemoVideos.product,
        videoId: moduleDemoVideos.videoId,
        title: moduleDemoVideos.title,
        summary: moduleDemoVideos.summary,
        published: moduleDemoVideos.published,
      })
      .from(moduleDemoVideos)
      .where(eq(moduleDemoVideos.product, product))
      .limit(1)

    return toPublicModuleDemoVideo(rows[0])
  } catch {
    return null
  }
}

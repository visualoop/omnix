import { getApprovedMediaById, type SlotMedia } from '@/lib/media-slots'

export type ApprovedMediaResolver = (id: string) => Promise<SlotMedia | null>

/**
 * Resolve a team photo through the licensed-media publication gate.
 * Missing, rejected, pending, deleted, non-image, and malformed references
 * all return null so callers render the initials fallback instead.
 */
export async function getApprovedTeamMemberPhoto(
  mediaId: string | null | undefined,
  resolveApprovedMedia: ApprovedMediaResolver = getApprovedMediaById,
): Promise<SlotMedia | null> {
  if (typeof mediaId !== 'string' || !mediaId.trim() || mediaId !== mediaId.trim()) return null

  try {
    const media = await resolveApprovedMedia(mediaId)
    return media?.mimeType.startsWith('image/') ? media : null
  } catch {
    return null
  }
}

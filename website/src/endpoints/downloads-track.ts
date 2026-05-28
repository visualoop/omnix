import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'

/**
 * POST /api/downloads/track
 * Increments downloadCount on a Release. Public, but rate-limited.
 *
 * Body: { releaseId } | { version }
 */
export const downloadsTrackEndpoint: Endpoint = {
  path: '/downloads/track',
  method: 'post',
  handler: async (req) => {
    const body = await readJson<{ releaseId?: string; version?: string }>(req)
    if (!body) return errorResponse('Bad request', 400)

    let releaseId = body.releaseId

    if (!releaseId && body.version) {
      const found = await req.payload.find({
        collection: 'releases',
        where: { version: { equals: body.version } },
        limit: 1,
        depth: 0,
      })
      releaseId = (found.docs[0] as { id?: string | number } | undefined)?.id?.toString()
    }

    if (!releaseId) return errorResponse('Release not found', 404)

    const release = await req.payload.findByID({
      collection: 'releases',
      id: releaseId,
      depth: 0,
    })

    const current = (release as { downloadCount?: number }).downloadCount ?? 0
    await req.payload.update({
      collection: 'releases',
      id: releaseId,
      data: { downloadCount: current + 1 },
      overrideAccess: true,
    })

    return jsonResponse({ ok: true, downloadCount: current + 1 })
  },
}

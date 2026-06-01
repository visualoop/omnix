import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, logActivation, readJson } from './_auth'

/**
 * POST /api/trials/start
 *
 * Records a trial fingerprint so the same machine cannot farm repeated trials
 * after a reinstall. We do NOT issue a signed key here — the desktop runs the
 * trial locally; this endpoint only enforces one-trial-per-fingerprint, using
 * the append-only Activations log as the dedupe store.
 *
 * Body: { moduleId, machineId }
 * Response: 200 { ok:true } first time, 409 { ok:false } if already used.
 */
export const trialsStartEndpoint: Endpoint = {
  path: '/trials/start',
  method: 'post',
  handler: async (req) => {
    const body = await readJson<{ moduleId?: string; machineId?: string }>(req)
    if (!body?.machineId) return errorResponse('Missing machineId', 400)

    // Already activated against a real licence? Then it's not eligible for a fresh trial.
    const activated = await req.payload.find({
      collection: 'machines',
      where: { machineId: { equals: body.machineId } },
      limit: 1,
      depth: 0,
    })

    // Prior trial recorded for this fingerprint?
    const priorTrial = await req.payload.find({
      collection: 'activations',
      where: {
        and: [
          { machineId: { equals: body.machineId } },
          { event: { equals: 'activate' } },
          { detail: { like: 'Trial started' } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (activated.totalDocs > 0 || priorTrial.totalDocs > 0) {
      await logActivation(req, {
        event: 'activate',
        outcome: 'rejected_invalid',
        machineId: body.machineId,
        detail: 'Trial already used on this machine',
      })
      return jsonResponse({ ok: false, error: 'A trial has already been used on this machine.' }, 409)
    }

    await logActivation(req, {
      event: 'activate',
      outcome: 'success',
      machineId: body.machineId,
      detail: `Trial started (${body.moduleId ?? 'unknown'})`,
    })
    return jsonResponse({ ok: true })
  },
}

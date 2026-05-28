import { randomBytes } from 'crypto'
import type { Endpoint } from 'payload'
import { errorResponse, hashToken, jsonResponse, readJson } from './_auth'

/**
 * POST /api/licenses/activate
 *
 * Called by the Tauri desktop app once on first launch.
 * Registers the machine against the licence and returns a long-lived
 * machine token for subsequent telemetry / heartbeat calls.
 *
 * Body: {
 *   licenseKey,
 *   machineId,         // hardware fingerprint
 *   hostname,
 *   os, osVersion, arch,
 *   currentVersion
 * }
 *
 * Response: { authToken } — store in OS keychain on the desktop.
 */
export const licensesActivateEndpoint: Endpoint = {
  path: '/licenses/activate',
  method: 'post',
  handler: async (req) => {
    const body = await readJson<{
      licenseKey?: string
      machineId?: string
      hostname?: string
      os?: 'windows' | 'linux' | 'macos'
      osVersion?: string
      arch?: 'x86_64' | 'aarch64'
      currentVersion?: string
    }>(req)

    if (!body || !body.licenseKey || !body.machineId) {
      return errorResponse('Missing licenseKey or machineId', 400)
    }

    // Find the licence
    const licRes = await req.payload.find({
      collection: 'licenses',
      where: { licenseKey: { equals: body.licenseKey } },
      limit: 1,
      depth: 0,
    })
    const license = licRes.docs[0] as unknown as
      | undefined
      | {
          id: string | number
          status: string
          maxMachines?: number
        }
    if (!license) return errorResponse('Licence key not recognised', 404)

    if (license.status === 'suspended' || license.status === 'cancelled') {
      return errorResponse('Licence is suspended', 403)
    }

    // Existing registration?
    const existingRes = await req.payload.find({
      collection: 'machines',
      where: { machineId: { equals: body.machineId } },
      limit: 1,
      depth: 0,
    })
    const existing = existingRes.docs[0] as unknown as
      | undefined
      | { id: string | number; license: string | { id: string | number } }

    if (existing) {
      // Re-issue a fresh token (rotates on every activation)
      const token = randomBytes(32).toString('hex')
      await req.payload.update({
        collection: 'machines',
        id: existing.id,
        data: {
          authToken: hashToken(token),
          status: 'active',
          deactivatedAt: undefined,
          lastSeenAt: new Date().toISOString(),
          currentVersion: body.currentVersion,
        },
        overrideAccess: true,
      })
      return jsonResponse({ ok: true, authToken: token, action: 'reactivated' })
    }

    // Capacity check
    const countRes = await req.payload.count({
      collection: 'machines',
      where: {
        and: [
          { license: { equals: license.id } },
          { status: { not_equals: 'deactivated' } },
        ],
      },
    })
    if (countRes.totalDocs >= (license.maxMachines ?? 3)) {
      return errorResponse(
        `Licence is at machine cap (${license.maxMachines ?? 3}). Deactivate an old machine first or buy an extra seat.`,
        409,
      )
    }

    // Create new machine
    const token = randomBytes(32).toString('hex')
    const ip = req.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    await req.payload.create({
      collection: 'machines',
      data: {
        machineId: body.machineId,
        authToken: hashToken(token),
        license: license.id as never,
        hostname: body.hostname,
        os: (body.os as never) ?? 'windows',
        osVersion: body.osVersion,
        arch: (body.arch as never) ?? 'x86_64',
        currentVersion: body.currentVersion,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        lastIp: ip ?? undefined,
        status: 'active',
      },
      overrideAccess: true,
    })

    return jsonResponse({ ok: true, authToken: token, action: 'registered' })
  },
}

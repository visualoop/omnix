import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, logActivation, readJson } from './_auth'

type LicenseDoc = {
  id: string | number
  customer: string | number | { id: string | number }
  rebindLimitPerWindow?: number
  rebindWindowDays?: number
  rebindCountInWindow?: number
  rebindWindowStartedAt?: string
}

const customerId = (c: LicenseDoc['customer']): string | number =>
  typeof c === 'object' ? c.id : c

/**
 * POST /api/licenses/rebind
 *
 * Customer-initiated: deactivate one of their machines to free a seat so a
 * replacement PC can activate. Rate-limited by the license's rolling rebind
 * window (rebindLimitPerWindow / rebindWindowDays) to stop reseller abuse.
 *
 * Body: { machineId }  (the hardware fingerprint to deactivate)
 * Auth: customer session.
 * Response: { ok, rebindsUsed, rebindLimit, windowResetsAt }
 */
export const licensesRebindEndpoint: Endpoint = {
  path: '/licenses/rebind',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (!user || user.collection !== 'customers') {
      return errorResponse('Not authenticated', 401)
    }

    const body = await readJson<{ machineId?: string }>(req)
    if (!body?.machineId) return errorResponse('Missing machineId', 400)

    // Find the machine + its license.
    const machRes = await req.payload.find({
      collection: 'machines',
      where: { machineId: { equals: body.machineId } },
      limit: 1,
      depth: 1,
    })
    const machine = machRes.docs[0] as unknown as
      | undefined
      | { id: string | number; license: LicenseDoc | string | number; status: string }
    if (!machine) return errorResponse('Machine not found', 404)

    const licenseRef = machine.license
    const license =
      typeof licenseRef === 'object'
        ? (licenseRef as LicenseDoc)
        : ((
            await req.payload.findByID({ collection: 'licenses', id: licenseRef, depth: 0 })
          ) as unknown as LicenseDoc)

    // Ownership check — customers may only rebind their own licences.
    if (String(customerId(license.customer)) !== String(user.id)) {
      return errorResponse('This machine does not belong to your account', 403)
    }

    // Cooldown bookkeeping (rolling window).
    const limit = license.rebindLimitPerWindow ?? 2
    const windowDays = license.rebindWindowDays ?? 30
    const now = Date.now()
    const windowMs = windowDays * 24 * 60 * 60 * 1000
    const startedAt = license.rebindWindowStartedAt ? new Date(license.rebindWindowStartedAt).getTime() : 0
    const windowActive = startedAt > 0 && now - startedAt < windowMs
    const usedInWindow = windowActive ? license.rebindCountInWindow ?? 0 : 0

    if (limit > 0 && usedInWindow >= limit) {
      const resetsAt = new Date(startedAt + windowMs).toISOString()
      await logActivation(req, {
        event: 'rebind',
        outcome: 'rejected_cooldown',
        license: license.id,
        machine: machine.id,
        machineId: body.machineId,
        detail: `Rebind limit ${limit}/${windowDays}d reached`,
      })
      return jsonResponse(
        { ok: false, error: 'Rebind limit reached for this period.', rebindsUsed: usedInWindow, rebindLimit: limit, windowResetsAt: resetsAt },
        429,
      )
    }

    // Free the seat.
    await req.payload.update({
      collection: 'machines',
      id: machine.id,
      data: { status: 'deactivated', deactivatedAt: new Date().toISOString(), deactivationReason: 'replaced' },
      overrideAccess: true,
    })

    // Advance the window counter.
    const newCount = windowActive ? usedInWindow + 1 : 1
    await req.payload.update({
      collection: 'licenses',
      id: license.id,
      data: {
        rebindCountInWindow: newCount,
        rebindWindowStartedAt: windowActive
          ? license.rebindWindowStartedAt
          : new Date(now).toISOString(),
      },
      overrideAccess: true,
    })

    await logActivation(req, {
      event: 'rebind',
      outcome: 'success',
      license: license.id,
      machine: machine.id,
      machineId: body.machineId,
      detail: `Seat freed (${newCount}/${limit})`,
    })

    const effStart = windowActive ? startedAt : now
    return jsonResponse({
      ok: true,
      rebindsUsed: newCount,
      rebindLimit: limit,
      windowResetsAt: new Date(effStart + windowMs).toISOString(),
    })
  },
}

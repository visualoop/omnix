import type { Endpoint } from 'payload'
import { authenticateMachine, errorResponse, jsonResponse, readJson } from './_auth'

/**
 * POST /api/telemetry/heartbeat
 *
 * Lightweight 30-min ping. Updates Machine telemetry rollups + lastSyncAt.
 * Returns owner-toggled flags (e.g. requestDiagnostic).
 */
export const telemetryHeartbeatEndpoint: Endpoint = {
  path: '/telemetry/heartbeat',
  method: 'post',
  handler: async (req) => {
    const machine = await authenticateMachine(req)
    if (!machine) return errorResponse('Invalid machine token', 401)
    const m = machine as unknown as {
      id: string | number
      requestDiagnostic?: boolean
    }

    const body = await readJson<{
      appVersion?: string
      activeModule?: string
      branchName?: string
      branchCount?: number
      userCount?: number
      productCount?: number
      salesCount24h?: number
      salesValue30d?: number
      networkMode?: string
      integrations?: {
        etimsConfigured?: boolean
        mpesaConfigured?: boolean
        paystackConfigured?: boolean
        shaConfigured?: boolean
      }
    }>(req)

    if (!body) return errorResponse('Bad request', 400)

    const ip = req.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined

    await req.payload.update({
      collection: 'machines',
      id: m.id,
      data: {
        currentVersion: body.appVersion,
        activeModule: body.activeModule as never,
        branchName: body.branchName,
        productCount: body.productCount,
        employeeCount: body.userCount,
        salesCountLast30d: body.salesCount24h,
        salesValueLast30d: body.salesValue30d,
        networkMode: body.networkMode as never,
        integrations: body.integrations,
        lastSyncAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        lastIp: ip,
        status: 'active',
      },
      overrideAccess: true,
    })

    // Clear the request-diagnostic flag if it was set; client will pull a dump
    let requestDiagnostic = Boolean(m.requestDiagnostic)
    if (requestDiagnostic) {
      await req.payload.update({
        collection: 'machines',
        id: m.id,
        data: { requestDiagnostic: false },
        overrideAccess: true,
      })
    }

    return jsonResponse({
      ok: true,
      requestDiagnostic,
      serverTime: new Date().toISOString(),
    })
  },
}

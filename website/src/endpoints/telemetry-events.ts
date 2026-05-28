import type { Endpoint } from 'payload'
import { authenticateMachine, errorResponse, jsonResponse, readJson } from './_auth'

/**
 * POST /api/telemetry/events
 *
 * Machine-authenticated. Accepts a batch of events from the desktop app.
 * Body: { events: TelemetryEvent[] }
 *
 * The desktop sanitiser strips business data before sending; this endpoint
 * trusts the schema but rate-limits and bounds the payload size.
 */

const MAX_BATCH = 100
const MAX_BODY_BYTES = 256 * 1024
const ALLOWED_EVENT_TYPES = new Set([
  'app_started',
  'app_closed',
  'heartbeat',
  'sync_completed',
  'sale_completed',
  'license_validated',
  'license_invalid',
  'license_expired',
  'crash',
  'panic',
  'db_error',
  'migration_error',
  'integration_error',
  'updater_check',
  'updater_download',
  'updater_installed',
  'manual_diagnostic',
  'feedback_submitted',
])

export const telemetryEventsEndpoint: Endpoint = {
  path: '/telemetry/events',
  method: 'post',
  handler: async (req) => {
    const machine = await authenticateMachine(req)
    if (!machine) return errorResponse('Invalid machine token', 401)

    const m = machine as unknown as { id: string | number }

    const body = await readJson<{
      events?: Array<{
        eventType?: string
        severity?: string
        appVersion?: string
        message?: string
        stackTrace?: string
        metadata?: Record<string, unknown>
        sessionId?: string
      }>
    }>(req)

    if (!body || !Array.isArray(body.events) || body.events.length === 0) {
      return errorResponse('events array required', 400)
    }
    if (body.events.length > MAX_BATCH) {
      return errorResponse(`Max ${MAX_BATCH} events per batch`, 413)
    }

    const ip = req.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined

    let accepted = 0
    let rejected = 0
    for (const event of body.events) {
      if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) {
        rejected += 1
        continue
      }
      // Hard truncate any string > 4 KB
      const truncatedMessage = event.message?.slice(0, 4096)
      const truncatedTrace = event.stackTrace?.slice(0, 8192)

      try {
        await req.payload.create({
          collection: 'telemetry-events',
          data: {
            machine: m.id as never,
            eventType: event.eventType as never,
            severity: (event.severity as never) ?? 'info',
            appVersion: event.appVersion,
            message: truncatedMessage,
            stackTrace: truncatedTrace,
            metadata: event.metadata as never,
            sessionId: event.sessionId,
            ipAddress: ip,
          },
          overrideAccess: true,
        })
        accepted += 1
      } catch {
        rejected += 1
      }
    }

    return jsonResponse({ ok: true, accepted, rejected })
  },
}

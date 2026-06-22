import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, machines, telemetryEvents } from '@/db'
import { createId } from '@/lib/ids'

/**
 * /api/telemetry/heartbeat
 *
 * Auth via machine.auth_token_hash. Updates lastSeenAt + denormalised
 * rollups + records a telemetry_event row.
 *
 * Body: { machine_id, auth_token, kind, payload }
 */
export const dynamic = 'force-dynamic'

interface HeartbeatInput {
  machine_id: string
  auth_token: string
  kind?: string
  payload?: Record<string, unknown>
  product_count?: number
  employee_count?: number
  sales_count_last30d?: number
  sales_value_last30d?: number
  currency?: string
  current_version?: string
  active_module?: string
  network_mode?: string
  city?: string
  county?: string
  lat?: number
  lng?: number
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HeartbeatInput | null
  if (!body?.machine_id || !body.auth_token) {
    return Response.json({ ok: false, error: 'machine_id + auth_token required' }, { status: 400 })
  }

  const m = (await db.select().from(machines).where(eq(machines.machineId, body.machine_id)).limit(1))[0]
  if (!m) return Response.json({ ok: false, error: 'machine not registered' }, { status: 404 })

  const tokenHash = crypto.createHash('sha256').update(body.auth_token).digest('hex')
  if (m.authTokenHash !== tokenHash) {
    return Response.json({ ok: false, error: 'auth token mismatch' }, { status: 401 })
  }

  const now = new Date()
  await db
    .update(machines)
    .set({
      lastSeenAt: now,
      lastSyncAt: now,
      currentVersion: body.current_version ?? m.currentVersion,
      activeModule: body.active_module ?? m.activeModule,
      networkMode: body.network_mode ?? m.networkMode,
      currency: body.currency ?? m.currency,
      productCount: body.product_count ?? m.productCount,
      employeeCount: body.employee_count ?? m.employeeCount,
      salesCountLast30d: body.sales_count_last30d ?? m.salesCountLast30d,
      salesValueLast30d: body.sales_value_last30d ?? m.salesValueLast30d,
      city: body.city ?? m.city,
      county: body.county ?? m.county,
      lat: body.lat ?? m.lat,
      lng: body.lng ?? m.lng,
      lastIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? m.lastIp,
    })
    .where(eq(machines.id, m.id))

  await db.insert(telemetryEvents).values({
    id: createId(),
    machineId: m.id,
    kind: body.kind ?? 'heartbeat',
    occurredAt: now,
    payload: body.payload ?? null,
  })

  return Response.json({ ok: true })
}

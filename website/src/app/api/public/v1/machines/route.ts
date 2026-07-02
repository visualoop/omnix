/**
 * GET /api/public/v1/machines
 *
 * List the customer's registered machines. Scope required: 'read:machines'.
 *
 * Response: { machines: [{ id, hostname, machine_id, current_version, last_seen_at, status }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/public-api-auth'
import { db, machines } from '@/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (!auth.ok) return auth.response
  if (!auth.caller.scopes.includes('read:machines') && !auth.caller.scopes.includes('*')) {
    return NextResponse.json({ error: 'Missing scope: read:machines' }, { status: 403 })
  }

  const rows = auth.caller.ownerUserId
    ? await db
        .select({
          id: machines.id,
          machineId: machines.machineId,
          hostname: machines.hostname,
          currentVersion: machines.currentVersion,
          lastSeenAt: machines.lastSeenAt,
          status: machines.status,
          activeModule: machines.activeModule,
        })
        .from(machines)
        .where(eq(machines.userId, auth.caller.ownerUserId))
        .limit(200)
        .catch(() => [])
    : []

  return NextResponse.json({ machines: rows })
}

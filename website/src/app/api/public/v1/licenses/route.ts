/**
 * GET /api/public/v1/licenses
 *
 * List the customer's licences. Scope required: 'read:licenses'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/public-api-auth'
import { db, licenses } from '@/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (!auth.ok) return auth.response
  if (!auth.caller.scopes.includes('read:licenses') && !auth.caller.scopes.includes('*')) {
    return NextResponse.json({ error: 'Missing scope: read:licenses' }, { status: 403 })
  }
  if (!auth.caller.ownerUserId) {
    return NextResponse.json({ licenses: [] })
  }

  const rows = await db
    .select({
      id: licenses.id,
      licenseKey: licenses.licenseKey,
      variant: licenses.variant,
      status: licenses.status,
      maxMachines: licenses.maxMachines,
      maxBranches: licenses.maxBranches,
      maintenanceUntil: licenses.maintenanceUntil,
      createdAt: licenses.createdAt,
    })
    .from(licenses)
    .where(eq(licenses.userId, auth.caller.ownerUserId))
    .limit(50)
    .catch(() => [])

  return NextResponse.json({ licenses: rows })
}

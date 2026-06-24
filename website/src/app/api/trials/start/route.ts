import { sql } from 'drizzle-orm'
import { db, auditLog } from '@/db'
import { createId } from '@/lib/ids'

/**
 * /api/trials/start — desktop-compatible trial-fingerprint registry.
 *
 * Body: { moduleId, machineId }
 *
 * The desktop calls this when a customer starts an offline trial of a
 * single module. We record the (moduleId, fingerprint) pair in the
 * audit log so the same machine can't farm repeated trials after a
 * reinstall. Returns 200 if fresh, 409 if this fingerprint already
 * started a trial for the requested module.
 *
 * The DB-side trial licence (the one tied to a customer account on
 * /dashboard) is separate — provisioned via /api/dashboard/trial.
 * This endpoint exists only for the desktop's offline-trial flow,
 * which doesn't require an account.
 */
export const dynamic = 'force-dynamic'

interface TrialStartInput {
  moduleId: string
  machineId: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TrialStartInput | null
  if (!body?.moduleId || !body.machineId) {
    return Response.json({ ok: false, error: 'moduleId + machineId required' }, { status: 400 })
  }

  // Check whether this (machineId, moduleId) pair has already started a trial.
  // Look in audit_log for prior `desktop.trial_start` events with matching metadata.
  const prior = await db.execute(sql`
    SELECT id FROM ${auditLog}
    WHERE action = 'desktop.trial_start'
      AND metadata->>'machineId' = ${body.machineId}
      AND metadata->>'moduleId' = ${body.moduleId}
    LIMIT 1
  `).catch(() => ({ rows: [] as unknown[] }))

  // PgResult shape varies; check both .rows and array index access.
  type PgRows = { rows?: unknown[] } | unknown[]
  const rows = Array.isArray(prior) ? prior : (prior as PgRows as { rows?: unknown[] }).rows ?? []
  if (rows.length > 0) {
    return Response.json({ ok: false, error: 'trial already used on this machine' }, { status: 409 })
  }

  try {
    await db.insert(auditLog).values({
      id: createId(),
      actorId: null,
      action: 'desktop.trial_start',
      resource: `module:${body.moduleId}`,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      metadata: { moduleId: body.moduleId, machineId: body.machineId },
    })
  } catch (e) {
    console.error('[trials/start] audit insert failed:', e)
  }

  return Response.json({ ok: true })
}

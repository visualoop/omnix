import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auditLog, db, licenses, withDbTransaction } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'
import { buildLicenseKeyRepairPlan, type LicenseKeyRepairRow } from '@/lib/license-key-repair'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Licence-key canonicalisation, triggered from the admin licences page.
 *
 * This exists as an endpoint rather than only as `scripts/repair-license-keys.mts`
 * because every project secret — DATABASE_URL included — is marked Sensitive in
 * Vercel and is therefore write-only. The connection string cannot be read from a
 * developer machine, so the repair has to run inside the deployment that already
 * holds it.
 *
 *   GET  → dry-run. Returns the plan and changes nothing.
 *   POST → applies the plan inside a transaction and writes an audit row.
 *
 * Only `license_key` is ever written. Rows whose canonical form is unrecognised,
 * disagrees with the row's variant, or would collide with another row are
 * reported and the whole apply is refused, matching the script's behaviour.
 */
async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: Response.json({ error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: Response.json({ error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

async function loadPlan() {
  const rows = (await db
    .select({ id: licenses.id, variant: licenses.variant, licenseKey: licenses.licenseKey })
    .from(licenses)) as LicenseKeyRepairRow[]
  return buildLicenseKeyRepairPlan(rows)
}

export async function GET() {
  const a = await requireAdmin()
  if (a.error) return a.error

  const plan = await loadPlan()
  return Response.json({
    ok: true,
    dryRun: true,
    total: plan.length,
    blocked: plan.filter((c) => c.issue || !c.newKey).length,
    changes: plan,
  })
}

export async function POST() {
  const a = await requireAdmin()
  if (a.error) return a.error

  const plan = await loadPlan()
  if (plan.length === 0) return Response.json({ ok: true, updated: 0, changes: [] })

  const blocked = plan.filter((change) => change.issue || !change.newKey)
  if (blocked.length > 0) {
    return Response.json(
      { error: `Refusing to apply: ${blocked.length} row(s) unrecognised, mismatched, or colliding`, changes: plan },
      { status: 409 },
    )
  }

  const updated = await withDbTransaction(async (tx) => {
    let count = 0
    for (const change of plan) {
      // Match on the old key too, so a row edited since the plan was built is
      // left alone rather than silently overwritten.
      const rows = await tx
        .update(licenses)
        .set({ licenseKey: change.newKey as string })
        .where(and(eq(licenses.id, change.id), eq(licenses.licenseKey, change.oldKey)))
        .returning({ id: licenses.id })
      if (rows.length !== 1) throw new Error(`Licence ${change.id} changed concurrently`)
      count += 1
    }

    await tx.insert(auditLog).values({
      id: createId(),
      actorId: a.session!.user.id,
      action: 'license.key_canonicalised',
      resource: `license:${plan.map((c) => c.id).join(',')}`,
      // The old keys are the only way back, so they belong in the audit trail.
      metadata: { changes: plan.map((c) => ({ id: c.id, from: c.oldKey, to: c.newKey })) },
    })

    return count
  })

  return Response.json({ ok: true, updated, changes: plan })
}

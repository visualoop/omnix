/**
 * GET /api/cloud-backup/list
 *
 * Returns the cloud-backup blobs previously uploaded by this machine.
 *
 * Auth: Bearer <machine_auth_token>. Same pattern as /api/licenses/validate.
 *
 * Response shape (matches desktop cloud_backup_list expectations):
 *   { backups: [{ id, objectKey, sizeBytes, sha256, createdAt, ... }] }
 *
 * When the licence has cloud-backup enabled but expired → 402
 * When it was never enabled                             → 200 with empty list
 *                                                         (desktop UI shows an activation guide)
 * When the token is bad                                 → 401
 */
import { eq, desc } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, machines, licenses, cloudBackups } from '@/db'
import { ensureMigrated } from '@/lib/auto-migrate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  await ensureMigrated().catch(() => { /* non-fatal */ })

  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return Response.json({ error: 'missing bearer token' }, { status: 401 })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  // Find the machine by hashed bearer.
  const mRows = await db
    .select({
      id: machines.id,
      licenseId: machines.licenseId,
      authTokenHash: machines.authTokenHash,
    })
    .from(machines)
    .where(eq(machines.authTokenHash, tokenHash))
    .limit(1)
  const m = mRows[0]
  if (!m) {
    return Response.json({ error: 'machine not recognised' }, { status: 401 })
  }

  // Check licence has cloud-backup entitlement.
  const lRows = await db
    .select({
      id: licenses.id,
      cloudBackupEnabled: licenses.cloudBackupEnabled,
      cloudBackupExpiresAt: licenses.cloudBackupExpiresAt,
    })
    .from(licenses)
    .where(eq(licenses.id, m.licenseId))
    .limit(1)
  const lic = lRows[0]
  if (!lic) {
    return Response.json({ error: 'licence not found' }, { status: 401 })
  }

  // Not activated for this licence — return empty list (200) so the
  // desktop can show a friendly setup guide instead of a raw HTTP error.
  if (!lic.cloudBackupEnabled) {
    return Response.json({
      backups: [],
      enabled: false,
      reason: 'cloud_backup_not_activated',
      activationUrl: 'https://omnix.co.ke/dashboard/billing',
    })
  }

  // Enabled but expired — 402 Payment Required (the desktop shows a paywall for this).
  if (lic.cloudBackupExpiresAt && new Date(lic.cloudBackupExpiresAt) < new Date()) {
    return Response.json(
      {
        error: 'cloud_backup_expired',
        expiredAt: lic.cloudBackupExpiresAt,
        renewUrl: 'https://omnix.co.ke/dashboard/billing',
      },
      { status: 402 },
    )
  }

  // Enabled + valid — return the machine's backups, newest first.
  const rows = await db
    .select({
      id: cloudBackups.id,
      objectKey: cloudBackups.s3Key,
      sizeBytes: cloudBackups.sizeBytes,
      sha256: cloudBackups.encryptedSha256,
      createdAt: cloudBackups.takenAt,
      uploadedAt: cloudBackups.uploadedAt,
      metadata: cloudBackups.metadata,
    })
    .from(cloudBackups)
    .where(eq(cloudBackups.machineId, m.id))
    .orderBy(desc(cloudBackups.takenAt))
    .limit(50)

  const backups = rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    return {
      id: r.id,
      objectKey: r.objectKey,
      sizeBytes: r.sizeBytes,
      sha256: r.sha256,
      createdAt: r.createdAt?.toISOString?.() ?? null,
      finalizedAt: r.uploadedAt?.toISOString?.() ?? null,
      desktopVersion: typeof meta.desktopVersion === 'string' ? meta.desktopVersion : null,
      machineId: typeof meta.machineId === 'string' ? meta.machineId : null,
      pruneAfter: typeof meta.pruneAfter === 'string' ? meta.pruneAfter : null,
      clientKeyHint: typeof meta.clientKeyHint === 'string' ? meta.clientKeyHint : null,
    }
  })

  return Response.json({ backups, enabled: true, expiresAt: lic.cloudBackupExpiresAt })
}

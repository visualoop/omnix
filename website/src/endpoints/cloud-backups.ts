/**
 * Cloud-backup endpoints.
 *
 *   POST /api/cloud-backups/presign       (machine-bearer auth)
 *     → returns presigned PUT URL + a draft CloudBackup row
 *
 *   POST /api/cloud-backups/finalize      (machine-bearer auth)
 *     → confirms the upload landed; sets size + sha256 + status='uploaded'
 *
 *   GET  /api/cloud-backups               (customer-cookie auth)
 *     → lists backups for the calling customer (latest first)
 *
 *   POST /api/cloud-backups/:id/download  (customer-cookie OR machine bearer auth)
 *     → returns presigned GET URL for restore
 */
import { randomBytes } from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import {
  authenticateMachine,
  errorResponse,
  jsonResponse,
  readJson,
} from './_auth'
import { resolveSettings } from '../lib/settings'
import { buildBackupKey, presignDownload, presignUpload } from '../lib/r2-backups'

interface LicenseDoc {
  id: string | number
  status: string
  customer?: string | number | { id: string | number }
  cloudBackupExpiresAt?: string
}

interface MachineDoc {
  id: string | number
  fingerprint?: string
  license?: string | number | LicenseDoc
}

/** Resolve license + customer from a machine bearer or fail. */
async function getMachineContext(req: PayloadRequest) {
  const machine = (await authenticateMachine(req)) as unknown as MachineDoc | null
  if (!machine) return null
  const licenseId =
    typeof machine.license === 'string' || typeof machine.license === 'number'
      ? machine.license
      : machine.license?.id
  if (!licenseId) return null
  const license = (await req.payload.findByID({
    collection: 'licenses',
    id: licenseId as string,
    depth: 0,
  })) as unknown as LicenseDoc
  if (!license) return null
  return { machine, license }
}

/** Verify the customer has a paid cloud-backup window covering "now". */
function cloudBackupActive(license: LicenseDoc): boolean {
  if (!license.cloudBackupExpiresAt) return false
  return new Date(license.cloudBackupExpiresAt).getTime() > Date.now()
}

/* ─── POST /api/cloud-backups/presign ──────────────────────────────── */
export const cloudBackupPresignEndpoint: Endpoint = {
  path: '/cloud-backup/presign',
  method: 'post',
  handler: async (req) => {
    const ctx = await getMachineContext(req)
    if (!ctx) return errorResponse('Machine bearer token required', 401)
    const { machine, license } = ctx

    // Gate: feature must be enabled + customer must have paid window
    const settings = await resolveSettings(req.payload)
    if (!settings.cloudBackupEnabled) {
      return errorResponse('Cloud backup is not enabled on this site', 403)
    }
    if (!cloudBackupActive(license)) {
      return errorResponse('Cloud backup not active for this licence — purchase to activate', 402)
    }

    const body = await readJson<{
      sourceSizeBytes?: number
      sourceRows?: number
      desktopVersion?: string
      clientKeyHint?: string
    }>(req)

    const backupId = randomBytes(8).toString('hex')
    const fingerprint = (machine.fingerprint as string) ?? `m_${machine.id}`
    const objectKey = buildBackupKey(license.id, fingerprint, backupId)
    const customerId =
      typeof license.customer === 'string' || typeof license.customer === 'number'
        ? license.customer
        : license.customer?.id

    // Pre-create the row in 'pending' status so /finalize can find it
    const retentionDays = settings.cloudBackupRetentionDays ?? 30
    const pruneAfter = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()

    await req.payload.create({
      collection: 'cloud-backups',
      data: {
        license: license.id as never,
        customer: customerId as never,
        machineId: fingerprint,
        machine: machine.id as never,
        objectKey,
        bucket: 'omnix-backups',
        status: 'pending',
        clientKeyHint: body?.clientKeyHint,
        desktopVersion: body?.desktopVersion,
        sourceRows: body?.sourceRows,
        sourceSizeBytes: body?.sourceSizeBytes,
        pruneAfter,
      } as never,
      overrideAccess: true,
    })

    const presigned = await presignUpload({ key: objectKey })
    return jsonResponse({
      backupId,
      objectKey,
      bucket: presigned.bucket,
      uploadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      pruneAfter,
    })
  },
}

/* ─── POST /api/cloud-backups/finalize ─────────────────────────────── */
export const cloudBackupFinalizeEndpoint: Endpoint = {
  path: '/cloud-backup/finalize',
  method: 'post',
  handler: async (req) => {
    const ctx = await getMachineContext(req)
    if (!ctx) return errorResponse('Machine bearer token required', 401)

    const body = await readJson<{ objectKey?: string; sizeBytes?: number; sha256?: string }>(req)
    if (!body?.objectKey || !body.sizeBytes || !body.sha256) {
      return errorResponse('Missing objectKey / sizeBytes / sha256', 400)
    }

    const found = await req.payload.find({
      collection: 'cloud-backups',
      where: { objectKey: { equals: body.objectKey } },
      limit: 1,
    })
    const draft = found.docs[0] as unknown as { id: string | number; status: string } | undefined
    if (!draft) return errorResponse('Backup record not found', 404)

    await req.payload.update({
      collection: 'cloud-backups',
      id: draft.id,
      data: {
        sizeBytes: body.sizeBytes,
        sha256: body.sha256,
        status: 'uploaded',
        finalizedAt: new Date().toISOString(),
      } as never,
      overrideAccess: true,
    })
    return jsonResponse({ ok: true })
  },
}

/* ─── GET /api/cloud-backups ───────────────────────────────────────── */
export const cloudBackupListEndpoint: Endpoint = {
  path: '/cloud-backup/list',
  method: 'get',
  handler: async (req) => {
    // Two auth paths:
    //   1. Customer cookie session — listing from the dashboard
    //   2. Machine bearer — listing from inside the desktop app
    let customerId: string | number | undefined
    if (req.user?.collection === 'customers') {
      customerId = req.user.id
    } else {
      const ctx = await getMachineContext(req)
      if (!ctx) {
        return errorResponse('Sign in or send a machine bearer to list backups', 401)
      }
      const cust = ctx.license.customer
      customerId = typeof cust === 'string' || typeof cust === 'number' ? cust : cust?.id
    }
    if (!customerId) {
      return errorResponse('Could not resolve customer', 401)
    }
    const result = await req.payload.find({
      collection: 'cloud-backups',
      where: {
        and: [
          { customer: { equals: customerId } },
          { status: { equals: 'uploaded' } },
        ],
      },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
    })
    return jsonResponse({
      backups: result.docs.map((d) => {
        const b = d as unknown as Record<string, unknown>
        return {
          id: b.id,
          objectKey: b.objectKey,
          machineId: b.machineId,
          desktopVersion: b.desktopVersion,
          sizeBytes: b.sizeBytes,
          sha256: b.sha256,
          createdAt: b.createdAt,
          finalizedAt: b.finalizedAt,
          pruneAfter: b.pruneAfter,
          clientKeyHint: b.clientKeyHint,
        }
      }),
    })
  },
}

/* ─── POST /api/cloud-backups/:id/download ─────────────────────────── */
export const cloudBackupDownloadEndpoint: Endpoint = {
  path: '/cloud-backup/:id/download',
  method: 'post',
  handler: async (req) => {
    const id = req.routeParams?.id as string | undefined
    if (!id) return errorResponse('Missing backup id', 400)

    // Either machine bearer OR customer cookie. Both must own this backup.
    let allowed = false
    let backup: Record<string, unknown> | null = null

    try {
      backup = (await req.payload.findByID({
        collection: 'cloud-backups',
        id,
        depth: 0,
      })) as unknown as Record<string, unknown>
    } catch {
      return errorResponse('Backup not found', 404)
    }
    if (!backup || backup.status !== 'uploaded') {
      return errorResponse('Backup not available', 404)
    }

    if (req.user?.collection === 'customers') {
      allowed = String(backup.customer) === String(req.user.id)
    } else {
      const ctx = await getMachineContext(req)
      if (ctx) {
        allowed = String(backup.license) === String(ctx.license.id)
      }
    }

    if (!allowed) return errorResponse('Forbidden', 403)

    const settings = await resolveSettings(req.payload)
    if (!settings.cloudBackupEnabled) {
      return errorResponse('Cloud backup is not enabled on this site', 403)
    }

    const presigned = await presignDownload({ key: backup.objectKey as string })
    return jsonResponse({
      downloadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      sha256: backup.sha256,
      sizeBytes: backup.sizeBytes,
      objectKey: backup.objectKey,
    })
  },
}

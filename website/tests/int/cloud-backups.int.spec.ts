/**
 * Cloud-backup endpoint tests.
 *
 * Coverage:
 *  - presign:  401 without machine bearer; 403 if Settings.cloudBackupEnabled=false;
 *              402 if license.cloudBackupExpiresAt is past; happy path returns
 *              uploadUrl + creates pending CloudBackup row + sets pruneAfter.
 *  - finalize: 401 without machine bearer; 404 if objectKey unknown;
 *              happy path flips status uploaded + persists size/sha.
 *  - list:     401 anonymous; only own customer's backups returned.
 *  - download: 401/403 ownership rules; happy path returns presigned GET URL.
 *
 * R2 SDK calls are mocked so no network. Settings resolver mocked too.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  cloudBackupPresignEndpoint,
  cloudBackupFinalizeEndpoint,
  cloudBackupListEndpoint,
  cloudBackupDownloadEndpoint,
} from '@/endpoints/cloud-backups'
import { hashToken } from '@/endpoints/_auth'

// ── Mock R2 client + settings BEFORE importing the endpoint module ──
vi.mock('@/lib/r2-backups', async () => {
  const actual = await vi.importActual<typeof import('@/lib/r2-backups')>('@/lib/r2-backups')
  return {
    ...actual,
    presignUpload: vi.fn(async (opts: { key: string; bucket?: string }) => ({
      url: `https://r2-mock/upload/${opts.key}?sig=mock`,
      bucket: opts.bucket ?? 'omnix-backups',
      key: opts.key,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })),
    presignDownload: vi.fn(async (opts: { key: string }) => ({
      url: `https://r2-mock/download/${opts.key}?sig=mock`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })),
  }
})

vi.mock('@/lib/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings')>('@/lib/settings')
  return {
    ...actual,
    resolveSettings: vi.fn(async () => ({
      cloudBackupEnabled: true,
      cloudBackupRetentionDays: 30,
    })),
  }
})

const { resolveSettings } = await import('@/lib/settings')

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(resolveSettings).mockResolvedValue({
    cloudBackupEnabled: true,
    cloudBackupRetentionDays: 30,
  } as never)
})

const headers = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
})

interface Db {
  licenses: Array<Record<string, unknown> & { id: string | number }>
  machines: Array<Record<string, unknown> & { id: string | number; authToken: string }>
  customers: Array<Record<string, unknown> & { id: string | number }>
  'cloud-backups': Array<Record<string, unknown> & { id: string | number }>
}

const seed = (): Db => ({
  licenses: [
    {
      id: 'l1',
      status: 'active',
      customer: 'c1',
      cloudBackupExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  machines: [
    { id: 'm1', authToken: hashToken('mach-token'), fingerprint: 'fpm1abc', license: 'l1' },
  ],
  customers: [{ id: 'c1', email: 'c1@example.com' }],
  'cloud-backups': [],
})

const buildPayload = (db: Db) => {
  const matches = (doc: Record<string, unknown>, where: Record<string, { equals: unknown }>) =>
    Object.entries(where).every(([k, v]) => doc[k] === v.equals)
  return {
    find: vi.fn(async ({ collection, where, limit }: { collection: keyof Db; where?: Record<string, { equals: unknown }>; limit?: number; sort?: string; depth?: number }) => {
      let docs = (db[collection] as Array<Record<string, unknown>>) ?? []
      if (where) {
        if ('and' in where && Array.isArray((where as { and?: unknown[] }).and)) {
          for (const c of (where as { and: Array<Record<string, { equals: unknown }>> }).and) {
            docs = docs.filter((d) => matches(d, c))
          }
        } else {
          docs = docs.filter((d) => matches(d, where))
        }
      }
      return { docs: docs.slice(0, limit ?? 100) }
    }),
    findByID: vi.fn(async ({ collection, id }: { collection: keyof Db; id: string | number; depth?: number }) => {
      const doc = (db[collection] as Array<Record<string, unknown> & { id: string | number }>).find(
        (d) => String(d.id) === String(id),
      )
      if (!doc) throw new Error('Not found')
      return doc
    }),
    create: vi.fn(async ({ collection, data }: { collection: keyof Db; data: Record<string, unknown> }) => {
      const id = `gen-${db[collection].length + 1}`
      const doc = { id, createdAt: new Date().toISOString(), ...data }
      ;(db[collection] as Array<Record<string, unknown>>).push(doc)
      return doc
    }),
    update: vi.fn(async ({ collection, id, data }: { collection: keyof Db; id: string | number; data: Record<string, unknown> }) => {
      const target = (db[collection] as Array<Record<string, unknown> & { id: string | number }>).find(
        (d) => String(d.id) === String(id),
      )
      if (target) Object.assign(target, data)
      return target
    }),
    findGlobal: vi.fn(async () => ({})),
  }
}

const machineReq = (db: Db, body?: Record<string, unknown>) => ({
  payload: buildPayload(db),
  headers: headers({ authorization: 'Bearer mach-token' }),
  text: async () => JSON.stringify(body ?? {}),
  json: async () => body ?? {},
} as unknown as Parameters<typeof cloudBackupPresignEndpoint.handler>[0])

const customerReq = (db: Db, customerId: string | number = 'c1', body?: Record<string, unknown>) => ({
  payload: buildPayload(db),
  headers: headers({}),
  user: { collection: 'customers', id: customerId },
  json: async () => body ?? {},
} as unknown as Parameters<typeof cloudBackupListEndpoint.handler>[0])

/* ─── presign ───────────────────────────────────────────────────────── */
describe('cloud-backups: presign', () => {
  it('401 without machine bearer', async () => {
    const db = seed()
    const req = {
      payload: buildPayload(db),
      headers: headers({}), // no auth
      json: async () => ({}),
    } as unknown as Parameters<typeof cloudBackupPresignEndpoint.handler>[0]
    const res = await cloudBackupPresignEndpoint.handler(req)
    expect(res.status).toBe(401)
  })

  it('403 when Settings.cloudBackupEnabled=false', async () => {
    vi.mocked(resolveSettings).mockResolvedValueOnce({ cloudBackupEnabled: false } as never)
    const res = await cloudBackupPresignEndpoint.handler(machineReq(seed()))
    expect(res.status).toBe(403)
  })

  it('402 when license.cloudBackupExpiresAt is past', async () => {
    const db = seed()
    db.licenses[0].cloudBackupExpiresAt = new Date(Date.now() - 1000).toISOString()
    const res = await cloudBackupPresignEndpoint.handler(machineReq(db))
    expect(res.status).toBe(402)
  })

  it('happy path returns uploadUrl + creates pending CloudBackup row', async () => {
    const db = seed()
    const res = await cloudBackupPresignEndpoint.handler(
      machineReq(db, { sourceSizeBytes: 12345, desktopVersion: '0.2.15', clientKeyHint: 'kh1' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toMatch(/^https:\/\/r2-mock\/upload\//)
    expect(body.objectKey).toMatch(/^backups\/l1\/fpm1abc/)
    expect(db['cloud-backups']).toHaveLength(1)
    expect(db['cloud-backups'][0].status).toBe('pending')
    expect(db['cloud-backups'][0].clientKeyHint).toBe('kh1')
    expect(db['cloud-backups'][0].pruneAfter).toBeTruthy()
  })
})

/* ─── finalize ──────────────────────────────────────────────────────── */
describe('cloud-backups: finalize', () => {
  it('400 when body missing required fields', async () => {
    const db = seed()
    const res = await cloudBackupFinalizeEndpoint.handler(machineReq(db, {}))
    expect(res.status).toBe(400)
  })

  it('404 when objectKey unknown', async () => {
    const db = seed()
    const res = await cloudBackupFinalizeEndpoint.handler(
      machineReq(db, { objectKey: 'unknown', sizeBytes: 100, sha256: 'hex' }),
    )
    expect(res.status).toBe(404)
  })

  it('flips status to uploaded + persists size + sha', async () => {
    const db = seed()
    db['cloud-backups'].push({
      id: 'cb1', license: 'l1', customer: 'c1', objectKey: 'backups/l1/fpm/abc',
      status: 'pending',
    })
    const res = await cloudBackupFinalizeEndpoint.handler(
      machineReq(db, {
        objectKey: 'backups/l1/fpm/abc',
        sizeBytes: 5_242_880,
        sha256: 'a'.repeat(64),
      }),
    )
    expect(res.status).toBe(200)
    expect(db['cloud-backups'][0].status).toBe('uploaded')
    expect(db['cloud-backups'][0].sizeBytes).toBe(5_242_880)
    expect(db['cloud-backups'][0].sha256).toBe('a'.repeat(64))
    expect(db['cloud-backups'][0].finalizedAt).toBeTruthy()
  })
})

/* ─── list ──────────────────────────────────────────────────────────── */
describe('cloud-backups: list', () => {
  it('401 anonymous', async () => {
    const db = seed()
    const req = { payload: buildPayload(db), headers: headers({}) } as never
    const res = await cloudBackupListEndpoint.handler(req)
    expect(res.status).toBe(401)
  })

  it('returns only own backups for the calling customer', async () => {
    const db = seed()
    db['cloud-backups'].push(
      { id: 'cb1', customer: 'c1', status: 'uploaded', objectKey: 'k1', createdAt: '2026-06-01T00:00:00Z' },
      { id: 'cb2', customer: 'c2', status: 'uploaded', objectKey: 'k2', createdAt: '2026-06-02T00:00:00Z' },
      { id: 'cb3', customer: 'c1', status: 'pending', objectKey: 'k3' },
    )
    const res = await cloudBackupListEndpoint.handler(customerReq(db, 'c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Only c1's "uploaded" — cb1 only (cb3 is pending)
    expect(body.backups).toHaveLength(1)
    expect(body.backups[0].id).toBe('cb1')
  })
})

/* ─── download ──────────────────────────────────────────────────────── */
describe('cloud-backups: download', () => {
  it('400 when no id in route', async () => {
    const db = seed()
    const req = {
      payload: buildPayload(db),
      headers: headers({}),
      routeParams: {},
    } as unknown as Parameters<typeof cloudBackupDownloadEndpoint.handler>[0]
    const res = await cloudBackupDownloadEndpoint.handler(req)
    expect(res.status).toBe(400)
  })

  it('404 when backup not in uploaded status', async () => {
    const db = seed()
    db['cloud-backups'].push({ id: 'cb1', customer: 'c1', license: 'l1', status: 'pending', objectKey: 'k1' })
    const req = {
      payload: buildPayload(db),
      headers: headers({}),
      routeParams: { id: 'cb1' },
      user: { collection: 'customers', id: 'c1' },
    } as unknown as Parameters<typeof cloudBackupDownloadEndpoint.handler>[0]
    const res = await cloudBackupDownloadEndpoint.handler(req)
    expect(res.status).toBe(404)
  })

  it('403 when customer does not own the backup', async () => {
    const db = seed()
    db['cloud-backups'].push({ id: 'cb1', customer: 'c1', license: 'l1', status: 'uploaded', objectKey: 'k1' })
    const req = {
      payload: buildPayload(db),
      headers: headers({}),
      routeParams: { id: 'cb1' },
      user: { collection: 'customers', id: 'c-other' },
    } as unknown as Parameters<typeof cloudBackupDownloadEndpoint.handler>[0]
    const res = await cloudBackupDownloadEndpoint.handler(req)
    expect(res.status).toBe(403)
  })

  it('returns presigned GET URL when customer owns backup', async () => {
    const db = seed()
    db['cloud-backups'].push({
      id: 'cb1', customer: 'c1', license: 'l1', status: 'uploaded',
      objectKey: 'backups/l1/fpm1abc/abc.sqlite.gz.enc',
      sha256: 'b'.repeat(64), sizeBytes: 1024,
    })
    const req = {
      payload: buildPayload(db),
      headers: headers({}),
      routeParams: { id: 'cb1' },
      user: { collection: 'customers', id: 'c1' },
    } as unknown as Parameters<typeof cloudBackupDownloadEndpoint.handler>[0]
    const res = await cloudBackupDownloadEndpoint.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.downloadUrl).toMatch(/^https:\/\/r2-mock\/download\//)
    expect(body.sha256).toBe('b'.repeat(64))
    expect(body.sizeBytes).toBe(1024)
  })
})

/**
 * License + machine activation tests.
 *
 *   POST /api/licenses/activate    — register a machine to a license
 *   POST /api/licenses/validate    — desktop heartbeat: state + lockout
 *   POST /api/trials/start         — trial fingerprint enforcement
 *   PATCH /api/customers/me        — customer profile update
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { licensesActivateEndpoint } from '@/endpoints/licenses-activate'
import { licensesValidateEndpoint } from '@/endpoints/licenses-validate'
import { trialsStartEndpoint } from '@/endpoints/trials-start'
import { customersMeEndpoint } from '@/endpoints/customers-me'

const headers = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
})

interface Db {
  licenses: Array<Record<string, unknown> & { id: string | number }>
  machines: Array<Record<string, unknown> & { id: string | number }>
  customers: Array<Record<string, unknown> & { id: string | number }>
  activations: Array<Record<string, unknown> & { id: string | number }>
}

const seed = (overrides: Partial<Db> = {}): Db => ({
  licenses: overrides.licenses ?? [
    {
      id: 'l1',
      licenseKey: 'OMNIX-VALID-KEY',
      status: 'active',
      modules: ['core', 'dawa'],
      maxMachines: 1,
      maxBranches: 1,
      majorVersionCap: 1,
      maintenanceUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      customer: 'c1',
    },
  ],
  machines: overrides.machines ?? [],
  customers: overrides.customers ?? [{ id: 'c1', email: 'c1@example.com' }],
  activations: overrides.activations ?? [],
})

const buildPayload = (db: Db) => {
  const matches = (doc: Record<string, unknown>, where: Record<string, { equals?: unknown; not_equals?: unknown; like?: string }>) =>
    Object.entries(where).every(([k, v]) => {
      if ('equals' in v) return doc[k] === v.equals
      if ('not_equals' in v) return doc[k] !== v.not_equals
      if ('like' in v && typeof v.like === 'string') return String(doc[k] ?? '').includes(v.like)
      return true
    })

  const filterDocs = (rows: Array<Record<string, unknown>>, where?: Record<string, unknown>) => {
    if (!where) return rows
    if ('and' in where && Array.isArray((where as { and?: unknown[] }).and)) {
      return (where as { and: Array<Record<string, never>> }).and.reduce(
        (acc, c) => acc.filter((d) => matches(d, c as never)),
        rows,
      )
    }
    return rows.filter((d) => matches(d, where as never))
  }

  return {
    find: vi.fn(async ({ collection, where, limit }: { collection: keyof Db; where?: Record<string, unknown>; limit?: number; sort?: string; depth?: number }) => {
      const all = filterDocs((db[collection] as unknown as Array<Record<string, unknown>>) ?? [], where)
      const docs = all.slice(0, limit ?? 100)
      return { docs, totalDocs: all.length }
    }),
    findByID: vi.fn(async ({ collection, id }: { collection: keyof Db; id: string | number }) => {
      const doc = (db[collection] as Array<Record<string, unknown> & { id: string | number }>).find(
        (d) => String(d.id) === String(id),
      )
      if (!doc) throw new Error('Not found')
      return doc
    }),
    create: vi.fn(async ({ collection, data }: { collection: keyof Db; data: Record<string, unknown> }) => {
      const id = `${collection}-${db[collection].length + 1}`
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
    count: vi.fn(async ({ collection, where }: { collection: keyof Db; where?: Record<string, unknown> }) => {
      const docs = filterDocs((db[collection] as unknown as Array<Record<string, unknown>>) ?? [], where)
      return { totalDocs: docs.length }
    }),
    findGlobal: vi.fn(async () => ({})),
  }
}

const buildReq = (db: Db, body: Record<string, unknown>, opts: { headers?: Record<string, string>; user?: unknown } = {}) =>
  ({
    payload: buildPayload(db),
    headers: headers(opts.headers ?? {}),
    json: async () => body,
    text: async () => JSON.stringify(body),
    user: opts.user,
  } as unknown as Parameters<typeof licensesActivateEndpoint.handler>[0])

afterEach(() => vi.restoreAllMocks())

/* ─── /api/licenses/activate ────────────────────────────────────────── */
describe('licenses/activate', () => {
  it('400 when missing fields', async () => {
    const res = await licensesActivateEndpoint.handler(buildReq(seed(), {}))
    expect(res.status).toBe(400)
  })

  it('404 when key not recognised', async () => {
    const res = await licensesActivateEndpoint.handler(
      buildReq(seed(), { licenseKey: 'NOPE', machineId: 'mach-1' }),
    )
    expect(res.status).toBe(404)
  })

  it('403 when license is suspended', async () => {
    const db = seed({
      licenses: [{ id: 'l1', licenseKey: 'SUSPENDED-KEY', status: 'suspended', maxMachines: 1 }],
    })
    const res = await licensesActivateEndpoint.handler(
      buildReq(db, { licenseKey: 'SUSPENDED-KEY', machineId: 'mach-1' }),
    )
    expect(res.status).toBe(403)
  })

  it('happy path: registers machine + returns auth token + entitlements', async () => {
    const db = seed()
    const res = await licensesActivateEndpoint.handler(
      buildReq(db, {
        licenseKey: 'OMNIX-VALID-KEY',
        machineId: 'mach-1',
        hostname: 'win-pc',
        os: 'windows',
        currentVersion: '0.2.14',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.authToken).toMatch(/^[a-f0-9]{64}$/) // 32 random bytes hex
    expect(body.action).toBe('registered')
    expect(body.entitlements.modules).toEqual(['core', 'dawa'])
    expect(db.machines).toHaveLength(1)
  })

  it('idempotent re-activation rotates the token', async () => {
    const db = seed({
      machines: [{ id: 'm1', machineId: 'mach-1', license: 'l1', authToken: 'old-hash', status: 'active' }],
    })
    const res = await licensesActivateEndpoint.handler(
      buildReq(db, { licenseKey: 'OMNIX-VALID-KEY', machineId: 'mach-1' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('reactivated')
    expect(db.machines[0].authToken).not.toBe('old-hash')
  })

  it('409 when seat cap is reached', async () => {
    const db = seed({
      machines: [
        { id: 'm1', machineId: 'OTHER', license: 'l1', status: 'active' },
      ],
    })
    const res = await licensesActivateEndpoint.handler(
      buildReq(db, { licenseKey: 'OMNIX-VALID-KEY', machineId: 'mach-NEW' }),
    )
    expect(res.status).toBe(409)
  })

  it('seat-cap honours deactivated machines (frees seat)', async () => {
    const db = seed({
      machines: [
        { id: 'm1', machineId: 'OLD', license: 'l1', status: 'deactivated' },
      ],
    })
    const res = await licensesActivateEndpoint.handler(
      buildReq(db, { licenseKey: 'OMNIX-VALID-KEY', machineId: 'mach-NEW' }),
    )
    expect(res.status).toBe(200) // deactivated doesn't count toward cap
  })
})

/* ─── /api/licenses/validate ────────────────────────────────────────── */
describe('licenses/validate', () => {
  it('400 when missing licenseKey', async () => {
    const res = await licensesValidateEndpoint.handler(buildReq(seed(), {}))
    expect(res.status).toBe(400)
  })

  it('returns status:invalid when license unknown', async () => {
    const res = await licensesValidateEndpoint.handler(
      buildReq(seed(), { licenseKey: 'UNKNOWN' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('invalid')
    expect(body.lockoutMode).toBe('hard')
  })

  it('returns license state for active license', async () => {
    const res = await licensesValidateEndpoint.handler(
      buildReq(seed(), { licenseKey: 'OMNIX-VALID-KEY', machineId: 'mach-1' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('active')
    expect(body.modules).toEqual(['core', 'dawa'])
  })
})

/* ─── /api/trials/start ─────────────────────────────────────────────── */
describe('trials/start', () => {
  it('400 when missing machineId', async () => {
    const res = await trialsStartEndpoint.handler(buildReq(seed(), {}))
    expect(res.status).toBe(400)
  })

  it('200 first time + creates activation record', async () => {
    const db = seed()
    const res = await trialsStartEndpoint.handler(buildReq(db, { machineId: 'mach-X' }))
    expect(res.status).toBe(200)
    expect(db.activations).toHaveLength(1)
  })

  it('409 when same fingerprint already trialled', async () => {
    const db = seed({
      activations: [
        {
          id: 'a1',
          machineId: 'mach-X',
          event: 'activate',
          detail: 'Trial started',
        },
      ],
    })
    const res = await trialsStartEndpoint.handler(buildReq(db, { machineId: 'mach-X' }))
    expect(res.status).toBe(409)
  })
})

/* ─── PATCH /api/customers/me ───────────────────────────────────────── */
describe('customers/me', () => {
  it('401 anonymous', async () => {
    const db = seed()
    const res = await customersMeEndpoint.handler(buildReq(db, { phone: '+254712345678' }))
    expect(res.status).toBe(401)
  })

  it('updates allowed fields only (drops email)', async () => {
    const db = seed()
    const req = buildReq(
      db,
      { phone: '+254712345678', email: 'hacker@evil.com', businessName: 'New Shop' },
      { user: { collection: 'customers', id: 'c1' } },
    )
    const res = await customersMeEndpoint.handler(req)
    expect(res.status).toBe(200)
    const c = db.customers[0]
    expect(c.phone).toBe('+254712345678')
    expect(c.businessName).toBe('New Shop')
    expect(c.email).toBe('c1@example.com') // unchanged
  })
})

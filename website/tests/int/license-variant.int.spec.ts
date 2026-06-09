/**
 * License variant binding tests for the validate + activate endpoints.
 *
 * Verifies:
 *   - Pro licence accepts any binary variant
 *   - Trade licence accepts only its matching binary
 *   - Friendly error message points operator to right download
 *   - Missing variant in body defaults to 'pro' (legacy v0.3.x clients)
 */
import { describe, it, expect, vi } from 'vitest'
import { licensesValidateEndpoint } from '@/endpoints/licenses-validate'
import { licensesActivateEndpoint } from '@/endpoints/licenses-activate'

const headers = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
})

interface Lic {
  id: string | number
  licenseKey: string
  status: string
  variant: string
  modules?: string[]
  majorVersionCap?: number
}

const buildReq = (body: Record<string, unknown>, licenses: Lic[], machines: unknown[] = []) =>
  ({
    url: 'http://localhost/api/licensing/validate',
    json: async () => body,
    headers: headers({}),
    payload: {
      find: vi.fn(async ({ collection, where }: { collection: string; where: Record<string, { equals?: unknown }> }) => {
        if (collection === 'licenses') {
          const k = (where.licenseKey as { equals?: string })?.equals
          return { docs: licenses.filter((l) => l.licenseKey === k), totalDocs: licenses.length }
        }
        if (collection === 'machines') return { docs: machines, totalDocs: 0 }
        if (collection === 'releases') return { docs: [{ version: '0.4.0' }] }
        return { docs: [], totalDocs: 0 }
      }),
      update: vi.fn(),
      findGlobal: vi.fn(async () => ({ trialLockoutMode: 'soft' })),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      create: vi.fn(async () => ({ id: 'm_new' })),
    },
  } as unknown as Parameters<typeof licensesValidateEndpoint.handler>[0])

describe('licenses-validate: variant gate', () => {
  it('Pro licence accepts a Dawa binary', async () => {
    const req = buildReq(
      { licenseKey: 'OMNIX-PRO-1234', machineId: 'M1', variant: 'dawa' },
      [{ id: 'l1', licenseKey: 'OMNIX-PRO-1234', status: 'active', variant: 'pro', modules: ['core', 'dawa', 'retail', 'hospitality', 'hardware'] }],
    )
    const res = await licensesValidateEndpoint.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('active')
    expect(body.variant).toBe('pro')
  })

  it('Dawa licence accepts a Dawa binary', async () => {
    const req = buildReq(
      { licenseKey: 'OMNIX-DAWA-1234', machineId: 'M1', variant: 'dawa' },
      [{ id: 'l1', licenseKey: 'OMNIX-DAWA-1234', status: 'active', variant: 'dawa', modules: ['core', 'dawa'] }],
    )
    const res = await licensesValidateEndpoint.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.variant).toBe('dawa')
  })

  it('Dawa licence rejects a Retail binary with friendly error', async () => {
    const req = buildReq(
      { licenseKey: 'OMNIX-DAWA-1234', machineId: 'M1', variant: 'retail' },
      [{ id: 'l1', licenseKey: 'OMNIX-DAWA-1234', status: 'active', variant: 'dawa', modules: ['core', 'dawa'] }],
    )
    const res = await licensesValidateEndpoint.handler(req)
    expect(res.status).toBe(200) // 200 with status='invalid'
    const body = await res.json()
    expect(body.status).toBe('invalid')
    expect(body.variantMismatch).toBe(true)
    expect(body.message).toContain('Omnix Dawa')
    expect(body.message).toContain('omnix.co.ke/dawa')
  })

  it('legacy client (no variant in body) is treated as pro and accepted by Pro licence', async () => {
    const req = buildReq(
      { licenseKey: 'OMNIX-PRO-LEGACY', machineId: 'M1' }, // no variant
      [{ id: 'l1', licenseKey: 'OMNIX-PRO-LEGACY', status: 'active', variant: 'pro', modules: ['core', 'dawa'] }],
    )
    const res = await licensesValidateEndpoint.handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('active')
  })

  it('legacy client (no variant in body) is rejected by a trade licence', async () => {
    const req = buildReq(
      { licenseKey: 'OMNIX-DAWA-LEGACY', machineId: 'M1' },
      [{ id: 'l1', licenseKey: 'OMNIX-DAWA-LEGACY', status: 'active', variant: 'dawa', modules: ['core', 'dawa'] }],
    )
    const res = await licensesValidateEndpoint.handler(req)
    const body = await res.json()
    expect(body.variantMismatch).toBe(true)
  })
})

describe('licenses-activate: variant gate', () => {
  const makeActReq = (body: Record<string, unknown>, licenses: Lic[]) =>
    ({
      url: 'http://localhost/api/licensing/activate',
      json: async () => body,
      headers: headers({}),
      payload: {
        find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, { equals?: unknown }> }) => {
          if (collection === 'licenses') {
            const k = (where?.licenseKey as { equals?: string } | undefined)?.equals
            return { docs: licenses.filter((l) => l.licenseKey === k), totalDocs: licenses.length }
          }
          return { docs: [], totalDocs: 0 }
        }),
        count: vi.fn(async () => ({ totalDocs: 0 })),
        create: vi.fn(async () => ({ id: 'm_new' })),
        update: vi.fn(),
      },
    } as unknown as Parameters<typeof licensesActivateEndpoint.handler>[0])

  it('rejects activating a Hardware binary with a Dawa licence', async () => {
    const req = makeActReq(
      { licenseKey: 'OMNIX-DAWA-9999', machineId: 'M1', variant: 'hardware' },
      [{ id: 'l1', licenseKey: 'OMNIX-DAWA-9999', status: 'active', variant: 'dawa' }],
    )
    const res = await licensesActivateEndpoint.handler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Omnix Dawa')
    expect(body.error).toContain('Omnix Hardware')
  })

  it('Pro licence activates any binary', async () => {
    const req = makeActReq(
      { licenseKey: 'OMNIX-PRO-9999', machineId: 'M1', variant: 'retail' },
      [{ id: 'l1', licenseKey: 'OMNIX-PRO-9999', status: 'active', variant: 'pro' }],
    )
    const res = await licensesActivateEndpoint.handler(req)
    expect(res.status).toBe(200)
  })
})

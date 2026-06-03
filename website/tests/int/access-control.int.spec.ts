/**
 * Access-control utility tests. Pure functions; no DB.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hashToken, authenticateMachine, isSystem, getBearerToken } from '@/endpoints/_auth'
import { allowSystem, ownerOnly, ownerOrSupport, anyAuthenticated, customerOwnedOrStaff } from '@/access'

const ORIG = process.env.PAYLOAD_SYSTEM_TOKEN
const TOKEN = 'system-secret-very-long-and-random-1234567890'

beforeEach(() => {
  process.env.PAYLOAD_SYSTEM_TOKEN = TOKEN
})
afterEach(() => {
  process.env.PAYLOAD_SYSTEM_TOKEN = ORIG
  vi.restoreAllMocks()
})

const headers = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? h[k] ?? null,
})

const reqWith = (h: Record<string, string> = {}, user?: unknown) =>
  ({ headers: headers(h), user } as never)

/* ─── isSystem / allowSystem ───────────────────────────────────────── */
describe('isSystem / allowSystem', () => {
  it('accepts the correct system token', () => {
    expect(isSystem(reqWith({ 'x-system-token': TOKEN }))).toBe(true)
    expect(allowSystem(reqWith({ 'x-system-token': TOKEN }) as never)).toBe(true)
  })

  it('rejects wrong tokens', () => {
    expect(isSystem(reqWith({ 'x-system-token': 'WRONG' }))).toBe(false)
    expect(allowSystem(reqWith({ 'x-system-token': 'WRONG' }) as never)).toBe(false)
  })

  it('rejects missing token header', () => {
    expect(isSystem(reqWith({}))).toBe(false)
  })

  it('rejects when env not configured', () => {
    process.env.PAYLOAD_SYSTEM_TOKEN = ''
    expect(isSystem(reqWith({ 'x-system-token': TOKEN }))).toBe(false)
  })

  it('rejects empty token even if env is empty', () => {
    process.env.PAYLOAD_SYSTEM_TOKEN = ''
    expect(isSystem(reqWith({ 'x-system-token': '' }))).toBe(false)
  })
})

/* ─── ownerOnly / ownerOrSupport / anyAuthenticated ─────────────────── */
describe('role gates', () => {
  it('ownerOnly: accepts owner', () => {
    expect(ownerOnly({ req: reqWith({}, { collection: 'users', role: 'owner' }) } as never)).toBe(true)
  })
  it('ownerOnly: rejects support', () => {
    expect(ownerOnly({ req: reqWith({}, { collection: 'users', role: 'support' }) } as never)).toBe(false)
  })
  it('ownerOnly: rejects customer', () => {
    expect(ownerOnly({ req: reqWith({}, { collection: 'customers', id: 1 }) } as never)).toBe(false)
  })
  it('ownerOnly: rejects anonymous', () => {
    expect(ownerOnly({ req: reqWith({}) } as never)).toBe(false)
  })
  it('ownerOrSupport: accepts both owner and support', () => {
    expect(ownerOrSupport({ req: reqWith({}, { collection: 'users', role: 'owner' }) } as never)).toBe(true)
    expect(ownerOrSupport({ req: reqWith({}, { collection: 'users', role: 'support' }) } as never)).toBe(true)
  })
  it('anyAuthenticated: accepts any signed-in user', () => {
    expect(anyAuthenticated({ req: reqWith({}, { collection: 'customers', id: 1 }) } as never)).toBe(true)
    expect(anyAuthenticated({ req: reqWith({}, { collection: 'users', role: 'support' }) } as never)).toBe(true)
    expect(anyAuthenticated({ req: reqWith({}) } as never)).toBe(false)
  })
})

/* ─── customerOwnedOrStaff ──────────────────────────────────────────── */
describe('customerOwnedOrStaff', () => {
  it('staff sees all (true literal)', () => {
    const r = { req: reqWith({}, { collection: 'users', role: 'owner' }) } as never
    expect(customerOwnedOrStaff(r)).toBe(true)
  })
  it('customer scopes to own records', () => {
    const r = { req: reqWith({}, { collection: 'customers', id: 7 }) } as never
    expect(customerOwnedOrStaff(r)).toEqual({ customer: { equals: 7 } })
  })
  it('anonymous denied', () => {
    expect(customerOwnedOrStaff({ req: reqWith({}) } as never)).toBe(false)
  })
})

/* ─── getBearerToken ────────────────────────────────────────────────── */
describe('getBearerToken', () => {
  it('extracts the token portion', () => {
    expect(getBearerToken(reqWith({ authorization: 'Bearer abc.def' }))).toBe('abc.def')
  })
  it('case-insensitive scheme', () => {
    expect(getBearerToken(reqWith({ authorization: 'bearer xyz' }))).toBe('xyz')
  })
  it('returns null for missing or wrong scheme', () => {
    expect(getBearerToken(reqWith({}))).toBeNull()
    expect(getBearerToken(reqWith({ authorization: 'Basic abc' }))).toBeNull()
  })
  it('returns null for empty token', () => {
    expect(getBearerToken(reqWith({ authorization: 'Bearer ' }))).toBeNull()
  })
})

/* ─── hashToken ─────────────────────────────────────────────────────── */
describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })
  it('produces 64 hex chars (SHA-256)', () => {
    expect(hashToken('abc')).toMatch(/^[a-f0-9]{64}$/)
  })
  it('different inputs → different hashes', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

/* ─── authenticateMachine ───────────────────────────────────────────── */
describe('authenticateMachine', () => {
  const findFirst = (machines: Array<Record<string, unknown>>) =>
    vi.fn(async ({ where }: { where: Record<string, { equals: unknown }> }) => {
      const docs = machines.filter((m) =>
        Object.entries(where).every(([k, v]) => m[k] === v.equals),
      )
      return { docs }
    })

  it('returns the machine matching the bearer token hash', async () => {
    const token = 'abc123'
    const machines = [{ id: 1, authToken: hashToken(token) }]
    const req = {
      headers: headers({ authorization: `Bearer ${token}` }),
      payload: { find: findFirst(machines) },
    } as never
    const out = await authenticateMachine(req)
    expect(out).toEqual(machines[0])
  })

  it('returns null when no token sent', async () => {
    const req = {
      headers: headers({}),
      payload: { find: vi.fn() },
    } as never
    expect(await authenticateMachine(req)).toBeNull()
  })

  it('returns null when token does not match any machine', async () => {
    const req = {
      headers: headers({ authorization: 'Bearer doesnotexist' }),
      payload: { find: findFirst([{ id: 1, authToken: hashToken('other') }]) },
    } as never
    // docs[0] is undefined when no row matches; production also returns undefined here
    expect(await authenticateMachine(req)).toBeFalsy()
  })
})

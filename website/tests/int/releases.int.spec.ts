/**
 * Releases endpoint tests:
 *   - GET  /api/releases-latest   shape + gates (paid-only, channel, major-version)
 *   - POST /api/releases-sync     system-token gate + upsert + forcePublish
 *
 * Uses fake Payload — no DB. Stubs req.payload.find / findByID / create / update / findGlobal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { releasesLatestEndpoint } from '@/endpoints/releases-latest'
import { releasesPostEndpoint } from '@/endpoints/releases-post'

const SYS_TOKEN = 'system-secret-omnix'
const ORIG = process.env.PAYLOAD_SYSTEM_TOKEN

beforeEach(() => {
  process.env.PAYLOAD_SYSTEM_TOKEN = SYS_TOKEN
})
afterEach(() => {
  process.env.PAYLOAD_SYSTEM_TOKEN = ORIG
  vi.restoreAllMocks()
})

const headers = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
})

interface Release {
  id: string | number
  version: string
  majorVersion: number
  channel: string
  status: string
  publishedAt?: string
  summary?: string
  windowsNsisUrl?: string
  updaterSignature?: string
  requiresPaidLicense?: boolean
  minMajorVersionToUpgrade?: number
}

interface License {
  id: string | number
  licenseKey: string
  status: string
  majorVersionCap?: number
}

const fakeFind = (col: string, store: { releases: Release[]; licenses: License[] }) =>
  vi.fn(async ({ where, sort, limit }: {
    where?: Record<string, { equals?: unknown; less_than_equal?: number }>
    sort?: string
    limit?: number
    and?: Array<Record<string, { equals?: unknown; less_than_equal?: number }>>
  } & { and?: Array<Record<string, { equals?: unknown; less_than_equal?: number }>> }) => {
    const data = (col === 'releases' ? store.releases : col === 'licenses' ? store.licenses : []) as unknown as Array<Record<string, unknown>>
    const conditions: Array<[string, { equals?: unknown; less_than_equal?: number }]> = []
    if (where) {
      if (where.and && Array.isArray(where.and)) {
        for (const c of where.and) for (const [k, v] of Object.entries(c)) conditions.push([k, v as { equals?: unknown; less_than_equal?: number }])
      } else {
        for (const [k, v] of Object.entries(where)) conditions.push([k, v as { equals?: unknown; less_than_equal?: number }])
      }
    }
    let docs = data.filter((d) =>
      conditions.every(([k, v]) => {
        if (v.equals !== undefined) return d[k] === v.equals
        if (v.less_than_equal !== undefined) return Number(d[k]) <= v.less_than_equal
        return true
      }),
    )
    if (sort === '-publishedAt') docs = [...docs].sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')))
    return { docs: docs.slice(0, limit ?? 100) }
  })

const fakeUpdate = (store: { releases: Release[]; licenses: License[] }) =>
  vi.fn(async ({ id, data }: { id: string | number; data: Record<string, unknown> }) => {
    const r = store.releases.find((x) => String(x.id) === String(id))
    if (r) Object.assign(r, data)
    return r
  })

const fakeCreate = (store: { releases: Release[]; licenses: License[] }) =>
  vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const id = `r_${store.releases.length + 1}`
    const doc: Release = { id, ...(data as Record<string, unknown>) } as never
    store.releases.push(doc)
    return doc
  })

const fakeFindGlobal = (autoPublish: boolean) =>
  vi.fn(async () => ({ flags: { autoPublishReleases: autoPublish } }))

const buildReleasesLatestReq = (qs: string, store: { releases: Release[]; licenses: License[] }) =>
  ({
    url: `http://localhost/api/releases-latest${qs}`,
    payload: { find: fakeFind('', store).bind(null) },
    headers: headers({}),
  } as unknown as Parameters<typeof releasesLatestEndpoint.handler>[0])

// Helper: a stable working set of releases
const seedReleases = (): Release[] => [
  {
    id: 1, version: '0.2.14', majorVersion: 0, channel: 'stable', status: 'published',
    publishedAt: '2026-06-02T13:00:00Z', summary: 'liquid glass',
    windowsNsisUrl: 'https://media.omnix.co.ke/releases/v0.2.14/Omnix_0.2.14_x64-setup.exe',
    updaterSignature: 'SIG-0214', requiresPaidLicense: false,
  },
  {
    id: 2, version: '0.2.13', majorVersion: 0, channel: 'stable', status: 'published',
    publishedAt: '2026-06-02T08:00:00Z', summary: 'logo + setup polish',
    windowsNsisUrl: 'https://media.omnix.co.ke/releases/v0.2.13/Omnix_0.2.13_x64-setup.exe',
    updaterSignature: 'SIG-0213',
  },
  {
    id: 3, version: '1.0.0', majorVersion: 1, channel: 'stable', status: 'published',
    publishedAt: '2026-07-01T00:00:00Z', summary: 'major',
    windowsNsisUrl: 'https://media.omnix.co.ke/releases/v1.0.0/Omnix_1.0.0_x64-setup.exe',
    updaterSignature: 'SIG-100', requiresPaidLicense: true,
  },
  {
    id: 4, version: '0.3.0-beta', majorVersion: 0, channel: 'beta', status: 'published',
    publishedAt: '2026-06-15T00:00:00Z',
    windowsNsisUrl: 'https://media.omnix.co.ke/releases/v0.3.0-beta/Omnix_0.3.0_x64-setup.exe',
  },
]

const handlerOf = (h: typeof releasesLatestEndpoint) =>
  h.handler as (req: Parameters<typeof releasesLatestEndpoint.handler>[0]) => Promise<Response>

/* ─── /api/releases-latest ──────────────────────────────────────────── */
describe('releases-latest: shape + ordering', () => {
  it('returns the newest published stable release in Tauri-updater shape', async () => {
    const store = { releases: seedReleases(), licenses: [] }
    const req = {
      url: 'http://localhost/api/releases-latest',
      payload: { find: fakeFind('', store) },
      headers: headers({}),
    } as never
    // patch find so it dispatches by collection
    ;(req as unknown as { payload: { find: ReturnType<typeof vi.fn> } }).payload.find = vi.fn(
      async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
        fakeFind(collection, store)(rest as never),
    )
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe('1.0.0')
    expect(body.platforms['windows-x86_64'].url).toContain('media.omnix.co.ke')
    expect(body.platforms['windows-x86_64'].signature).toBe('SIG-100')
    expect(body.requires_paid_license).toBe(true)
  })

  it('beta channel returns the beta release', async () => {
    const store = { releases: seedReleases(), licenses: [] }
    const req = {
      url: 'http://localhost/api/releases-latest?channel=beta',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe('0.3.0-beta')
  })

  it('returns 404 when no release exists in channel', async () => {
    const store = { releases: [], licenses: [] }
    const req = {
      url: 'http://localhost/api/releases-latest',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(404)
  })
})

describe('releases-latest: gates', () => {
  it('paid-only release blocked for trial license → 402', async () => {
    const store = {
      releases: [seedReleases()[2]], // 1.0.0 requiresPaidLicense
      licenses: [{ id: 'l1', licenseKey: 'TRIAL-KEY', status: 'trial' }],
    }
    const req = {
      url: 'http://localhost/api/releases-latest?license=TRIAL-KEY',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(402)
  })

  it('paid-only release served to active license', async () => {
    const store = {
      releases: [seedReleases()[2]],
      licenses: [{ id: 'l1', licenseKey: 'PAID', status: 'active' }],
    }
    const req = {
      url: 'http://localhost/api/releases-latest?license=PAID',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(200)
  })

  it('majorVersionCap filters out newer majors', async () => {
    const store = {
      releases: seedReleases(), // includes 1.0.0
      licenses: [{ id: 'l1', licenseKey: 'CAP0', status: 'active', majorVersionCap: 0 }],
    }
    const req = {
      url: 'http://localhost/api/releases-latest?license=CAP0',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // 1.0.0 was filtered out; latest matching majorVersion <= 0 is 0.2.14
    expect(body.version).toBe('0.2.14')
  })

  it('lapsed license treated as trial — paid-only release blocked', async () => {
    const store = {
      releases: [seedReleases()[2]],
      licenses: [{ id: 'l1', licenseKey: 'LAPSED', status: 'lapsed' }],
    }
    const req = {
      url: 'http://localhost/api/releases-latest?license=LAPSED',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(402)
  })

  it('alpha channel — empty when no alpha release published', async () => {
    const store = { releases: seedReleases(), licenses: [] }
    const req = {
      url: 'http://localhost/api/releases-latest?channel=alpha',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(404)
  })

  it('unknown license param falls back to default major cap (99)', async () => {
    const store = { releases: seedReleases(), licenses: [] }
    const req = {
      url: 'http://localhost/api/releases-latest?license=DOES-NOT-EXIST',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Default cap = 99 → returns latest (1.0.0)
    expect(body.version).toBe('1.0.0')
  })

  it('caller_license_status echoed in response', async () => {
    const store = {
      releases: [seedReleases()[0]],
      licenses: [{ id: 'l1', licenseKey: 'ACT', status: 'active' }],
    }
    const req = {
      url: 'http://localhost/api/releases-latest?license=ACT',
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
      },
      headers: headers({}),
    } as never
    const res = await handlerOf(releasesLatestEndpoint)(req)
    const body = await res.json()
    expect(body.caller_license_status).toBe('active')
  })
})

/* ─── /api/releases-sync ────────────────────────────────────────────── */
describe('releases-sync: gate', () => {
  it('rejects without x-system-token', async () => {
    const store = { releases: [] as Release[], licenses: [] as License[] }
    const req = {
      headers: headers({}),
      json: async () => ({ version: '0.3.0' }),
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(true),
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    const res = await releasesPostEndpoint.handler(req)
    expect(res.status).toBe(401)
  })

  it('accepts with correct token', async () => {
    const store = { releases: [] as Release[], licenses: [] as License[] }
    const req = {
      headers: headers({ 'x-system-token': SYS_TOKEN }),
      json: async () => ({ version: '0.3.0' }),
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(false),
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    const res = await releasesPostEndpoint.handler(req)
    expect([200, 201]).toContain(res.status)
  })
})

describe('releases-sync: upsert', () => {
  it('creates a new release row when version is new', async () => {
    const store = { releases: [] as Release[], licenses: [] as License[] }
    const req = {
      headers: headers({ 'x-system-token': SYS_TOKEN }),
      json: async () => ({ version: '0.4.0', windowsNsisUrl: 'https://media.omnix.co.ke/x.exe', updaterSignature: 'sig' }),
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(true),
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    await releasesPostEndpoint.handler(req)
    expect(store.releases).toHaveLength(1)
    expect(store.releases[0].version).toBe('0.4.0')
    expect(store.releases[0].status).toBe('published') // forcePublish via flag
  })

  it('updates existing row when version already present (idempotent re-sync)', async () => {
    const store = {
      releases: [{ id: 1, version: '0.4.0', majorVersion: 0, channel: 'stable', status: 'draft' } as Release],
      licenses: [] as License[],
    }
    const req = {
      headers: headers({ 'x-system-token': SYS_TOKEN }),
      json: async () => ({
        version: '0.4.0',
        windowsNsisUrl: 'https://media.omnix.co.ke/v0.4.0/setup.exe',
        updaterSignature: 'sig',
        forcePublish: true,
      }),
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(false), // settings says don't auto-publish, but body forces
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    await releasesPostEndpoint.handler(req)
    expect(store.releases).toHaveLength(1) // still one row
    expect(store.releases[0].status).toBe('published') // forcePublish wins
  })

  it('rejects body missing version', async () => {
    const store = { releases: [] as Release[], licenses: [] as License[] }
    const req = {
      headers: headers({ 'x-system-token': SYS_TOKEN }),
      json: async () => ({}),
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(true),
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    const res = await releasesPostEndpoint.handler(req)
    expect(res.status).toBe(400)
  })

  it('respects autoPublishReleases=false (creates draft)', async () => {
    const store = { releases: [] as Release[], licenses: [] as License[] }
    const req = {
      headers: headers({ 'x-system-token': SYS_TOKEN }),
      json: async () => ({ version: '0.5.0' }), // NO forcePublish in body
      payload: {
        find: vi.fn(async ({ collection, ...rest }: { collection: string; [k: string]: unknown }) =>
          fakeFind(collection, store)(rest as never),
        ),
        create: fakeCreate(store),
        update: fakeUpdate(store),
        findGlobal: fakeFindGlobal(false),
      },
    } as unknown as Parameters<typeof releasesPostEndpoint.handler>[0]
    await releasesPostEndpoint.handler(req)
    expect(store.releases[0].status).toBe('draft')
  })
})

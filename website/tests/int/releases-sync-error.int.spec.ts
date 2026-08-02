import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { releases } = await import('@/db/schema/releases')
  return {
    releases,
    db: {
      select: () => {
        throw new Error('database unavailable during release upsert')
      },
    },
  }
})

import { POST } from '@/app/api/releases-sync/route'

describe('/api/releases-sync failure boundary', () => {
  const token = 'release-ingest-secret'
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env.RELEASE_INGEST_TOKEN = token
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    delete process.env.RELEASE_INGEST_TOKEN
    errorSpy.mockRestore()
  })

  it('returns a diagnosable sanitised JSON 500 without logging request secrets', async () => {
    const response = await POST(
      new Request('https://omnix.co.ke/api/releases-sync', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-system-token': token,
        },
        body: JSON.stringify({
          version: '0.74.1',
          variant: 'dawa',
          windowsNsisUrl: 'https://media.omnix.co.ke/release.exe',
          updaterSignature: 'signed-release-value',
        }),
      }),
    )

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toContain('application/json')
    const body = await response.json()
    expect(body).toEqual({
      error: 'release metadata sync failed',
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })

    expect(errorSpy).toHaveBeenCalledOnce()
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain('database unavailable during release upsert')
    expect(logged).toContain(body.requestId)
    expect(logged).not.toContain(token)
    expect(logged).not.toContain('signed-release-value')
  })
})

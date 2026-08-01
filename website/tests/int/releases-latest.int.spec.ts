import { describe, expect, it } from 'vitest'
import { createReleasesLatestHandler, type ReleasesLatestRow } from '@/app/api/releases-latest/route'

const signature = 'signed-by-the-existing-tauri-private-key'
const release: ReleasesLatestRow = {
  id: 'release-0740',
  version: '0.74.0',
  channel: 'stable',
  publishedAt: new Date('2026-08-01T11:25:09.411Z'),
  notes: 'Omnix 0.74.0',
  metadata: {
    variants: {
      dawa: {
        exe: 'https://media.omnix.co.ke/releases/v0.74.0/dawa/Omnix Dawa_0.74.0_x64-setup.exe',
        signature,
      },
    },
  },
}

function request(query: string): Request {
  return new Request(`https://omnix.co.ke/api/releases-latest?${query}`)
}

describe('/api/releases-latest', () => {
  it('offers an older client its exact variant installer and signature', async () => {
    const GET = createReleasesLatestHandler(async () => [release])

    const response = await GET(request('variant=dawa&license=0.73.0'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-omnix-updater-status')).toBe('update')
    await expect(response.json()).resolves.toEqual({
      version: '0.74.0',
      notes: 'Omnix 0.74.0',
      pub_date: '2026-08-01T11:25:09.411Z',
      platforms: {
        'windows-x86_64': {
          signature,
          url: 'https://media.omnix.co.ke/releases/v0.74.0/dawa/Omnix%20Dawa_0.74.0_x64-setup.exe',
        },
      },
    })
  })

  it('returns 204 only when the client is already up to date', async () => {
    const GET = createReleasesLatestHandler(async () => [release])

    const response = await GET(request('variant=dawa&license=0.74.0'))

    expect(response.status).toBe(204)
    expect(response.headers.get('x-omnix-updater-status')).toBe('up-to-date')
  })

  it('reports missing variant assets instead of silently claiming no update', async () => {
    const GET = createReleasesLatestHandler(async () => [release])

    const response = await GET(request('variant=retail&license=0.73.0'))

    expect(response.status).toBe(503)
    expect(response.headers.get('x-omnix-updater-status')).toBe('missing-assets')
    await expect(response.json()).resolves.toEqual({
      error: 'release metadata is incomplete for variant retail',
      version: '0.74.0',
      variant: 'retail',
      missing: ['installer', 'signature'],
    })
  })
})

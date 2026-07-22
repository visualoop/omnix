import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasValidBootstrapToken } from '@/lib/bootstrap-auth'

const request = (authorization?: string) => new Request('https://omnix.co.ke/api/migrate-db', {
  headers: authorization ? { authorization } : undefined,
})

describe('bootstrap bearer authentication fails closed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a missing server secret even when the request has no token', () => {
    vi.stubEnv('BOOTSTRAP_TOKEN', '')
    expect(hasValidBootstrapToken(request())).toBe(false)
  })

  it('rejects missing, malformed, and incorrect request credentials', () => {
    vi.stubEnv('BOOTSTRAP_TOKEN', 'preview-bootstrap-secret')

    expect(hasValidBootstrapToken(request())).toBe(false)
    expect(hasValidBootstrapToken(request('Basic preview-bootstrap-secret'))).toBe(false)
    expect(hasValidBootstrapToken(request('Bearer wrong-secret'))).toBe(false)
  })

  it('accepts only the exact configured bearer token', () => {
    vi.stubEnv('BOOTSTRAP_TOKEN', 'preview-bootstrap-secret')

    expect(hasValidBootstrapToken(request('Bearer preview-bootstrap-secret'))).toBe(true)
  })
})


describe('scheduled jobs fail closed when their server secret is missing', () => {
  it('requires a configured cron secret before either job can run', async () => {
    const { readFile } = await import('node:fs/promises')
    const routes = [
      'src/app/api/cron/daily/route.ts',
      'src/app/api/cron/telemetry-retention/route.ts',
    ]

    for (const route of routes) {
      const source = await readFile(route, 'utf8')
      expect(source).toContain("if (!cronSecret)")
      expect(source).toContain("error: 'cron_not_configured'")
      expect(source).toContain('status: 503')
      expect(source).toContain('auth !== `Bearer ${cronSecret}`')
    }
  })
})

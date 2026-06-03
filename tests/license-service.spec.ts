/**
 * Tests for getMachineAuthToken — reads the machine bearer from local SQLite
 * (set by activateLicense after online activation). Returns null when the
 * licence is offline-only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { getMachineAuthToken } from '@/services/license'
import { query } from '@/lib/db'

const mockedQuery = vi.mocked(query)

beforeEach(() => {
  mockedQuery.mockReset()
})

describe('getMachineAuthToken', () => {
  it('returns the activation_token when present', async () => {
    mockedQuery.mockResolvedValueOnce([{ activation_token: 'a'.repeat(64) }])
    const t = await getMachineAuthToken()
    expect(t).toBe('a'.repeat(64))
  })

  it('returns null when the column is null (offline-only licence)', async () => {
    mockedQuery.mockResolvedValueOnce([{ activation_token: null }])
    const t = await getMachineAuthToken()
    expect(t).toBeNull()
  })

  it('returns null when there is no licence row yet', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const t = await getMachineAuthToken()
    expect(t).toBeNull()
  })

  it("queries the active licence row only (id='active')", async () => {
    mockedQuery.mockResolvedValueOnce([])
    await getMachineAuthToken()
    const sql = mockedQuery.mock.calls[0][0] as string
    expect(sql).toContain("id = 'active'")
    expect(sql).toMatch(/LIMIT 1/i)
  })
})

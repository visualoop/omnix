/**
 * Config CRUD tests:
 *   - listProviders maps the row shape and sorts by priority
 *   - updateProvider merges patch with existing row
 *   - listFeatures coerces enabled int → bool, preserves tier
 *   - loadSettings returns defaults when keys missing
 *   - saveSetting upserts with stringified value
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import {
  listProviders, updateProvider, setProviderRuntimeState,
  listFeatures, updateFeature,
  loadSettings, saveSetting,
} from '@/services/ai/config'
import { query, execute } from '@/lib/db'

const mockedQuery = vi.mocked(query)
const mockedExecute = vi.mocked(execute)

beforeEach(() => {
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

const FAKE_PROVIDER_ROW = {
  id: 'groq', display_name: 'Groq', enabled: 1, api_key_encrypted: 'sk-test',
  base_url: 'https://api.groq.com/openai/v1', priority: 10,
  preferred_text_model: 'llama-3.3-70b-versatile', preferred_vision_model: null,
  preferred_reasoning_model: null, daily_call_count: 0, daily_window_start: null,
  rate_limited_until: null, last_error: null, notes: 'Free tier',
}

describe('listProviders()', () => {
  it('coerces enabled int to bool', async () => {
    mockedQuery.mockResolvedValueOnce([FAKE_PROVIDER_ROW])
    const out = await listProviders()
    expect(out[0].enabled).toBe(true)
    expect(out[0].id).toBe('groq')
  })

  it('queries with priority sort', async () => {
    mockedQuery.mockResolvedValueOnce([])
    await listProviders()
    const sql = mockedQuery.mock.calls[0][0] as string
    expect(sql).toMatch(/ORDER BY priority ASC/)
  })
})

describe('updateProvider()', () => {
  it('merges patch over existing row', async () => {
    mockedQuery.mockResolvedValueOnce([FAKE_PROVIDER_ROW])
    await updateProvider('groq', { enabled: false, priority: 5 })
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect(args[1]).toBe(0)              // enabled → 0
    expect(args[2]).toBe('sk-test')      // api_key_encrypted unchanged
    expect(args[4]).toBe(5)              // priority overridden
  })

  it('throws when provider not found', async () => {
    mockedQuery.mockResolvedValueOnce([])
    await expect(updateProvider('nope', { enabled: false })).rejects.toThrow(/not found/)
  })
})

describe('setProviderRuntimeState()', () => {
  it('updates rate_limited_until + last_error without mutating other fields', async () => {
    await setProviderRuntimeState('groq', { rateLimitedUntil: '2026-01-01', lastError: 'oops' })
    const sql = mockedExecute.mock.calls[0][0] as string
    expect(sql).toMatch(/SET rate_limited_until/)
    expect(mockedExecute.mock.calls[0][1]).toEqual(['groq', '2026-01-01', 'oops'])
  })
})

const FAKE_FEATURE_ROW = {
  feature_id: 'enrich_product', display_name: 'Enrich product',
  description: 'desc', enabled: 1, privacy_tier: 'low', task_kind: 'text',
  preferred_provider: null, preferred_model: null,
}

describe('listFeatures()', () => {
  it('coerces enabled to bool', async () => {
    mockedQuery.mockResolvedValueOnce([FAKE_FEATURE_ROW])
    const out = await listFeatures()
    expect(out[0].enabled).toBe(true)
    expect(out[0].privacy_tier).toBe('low')
    expect(out[0].task_kind).toBe('text')
  })
})

describe('updateFeature()', () => {
  it('merges patch over existing row', async () => {
    mockedQuery.mockResolvedValueOnce([FAKE_FEATURE_ROW])
    await updateFeature('enrich_product', { privacy_tier: 'medium' })
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect(args[2]).toBe('medium')
    expect(args[1]).toBe(1)  // enabled unchanged
  })
})

describe('loadSettings()', () => {
  it('returns defaults when no rows present', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const s = await loadSettings()
    expect(s.free_models_only).toBe(true)
    expect(s.cache_enabled).toBe(true)
    expect(s.high_tier_optin).toBe(false)
    expect(s.cache_ttl_days).toBe(30)
  })

  it('parses string values correctly', async () => {
    mockedQuery.mockResolvedValueOnce([
      { key: 'free_models_only', value: '0' },
      { key: 'cache_ttl_days', value: '14' },
      { key: 'monthly_spend_cap_usd', value: '12.5' },
    ])
    const s = await loadSettings()
    expect(s.free_models_only).toBe(false)
    expect(s.cache_ttl_days).toBe(14)
    expect(s.monthly_spend_cap_usd).toBe(12.5)
  })
})

describe('saveSetting()', () => {
  it('upserts boolean as "1" / "0"', async () => {
    await saveSetting('free_models_only', false)
    expect(mockedExecute.mock.calls[0][1]).toEqual(['free_models_only', '0'])
  })

  it('upserts number as string', async () => {
    await saveSetting('cache_ttl_days', 14)
    expect(mockedExecute.mock.calls[0][1]).toEqual(['cache_ttl_days', '14'])
  })
})

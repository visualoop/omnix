/**
 * Router tests: integration-level coverage of invoke() with mocked DB +
 * mocked HTTP. We exercise the provider fallback chain, privacy gating,
 * cache integration, and the no-provider error path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock tauri-plugin-http fetch via vi.hoisted so the factory can reference it
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mockFetch,
}))

// Mock DB so config + cache + audit all use in-memory test doubles
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { invoke, pingProvider } from '@/services/ai/router'
import { AiError } from '@/services/ai/types'
import { query, execute } from '@/lib/db'

const mockedQuery = vi.mocked(query)
const mockedExecute = vi.mocked(execute)

beforeEach(() => {
  mockFetch.mockReset()
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

const FEATURE_LOW = {
  feature_id: 'enrich_product', display_name: 'X', description: 'd',
  enabled: 1, privacy_tier: 'low', task_kind: 'text',
  preferred_provider: null, preferred_model: null,
}
const FEATURE_HIGH = { ...FEATURE_LOW, privacy_tier: 'high' }

const PROVIDER_GROQ = {
  id: 'groq', display_name: 'Groq', enabled: 1, api_key_encrypted: 'gsk-test',
  base_url: 'https://api.groq.com/openai/v1', priority: 10,
  preferred_text_model: 'llama-3.3-70b-versatile', preferred_vision_model: null,
  preferred_reasoning_model: null, daily_call_count: 0, daily_window_start: null,
  rate_limited_until: null, last_error: null, notes: '',
}
const PROVIDER_OR = {
  ...PROVIDER_GROQ, id: 'openrouter', display_name: 'OpenRouter',
  api_key_encrypted: 'or-test', base_url: 'https://openrouter.ai/api/v1', priority: 20,
  preferred_text_model: 'meta-llama/llama-3.1-70b-instruct:free',
}

const SETTINGS_DEFAULT = [
  { key: 'free_models_only', value: '0' },
  { key: 'cache_enabled', value: '1' },
  { key: 'high_tier_optin', value: '0' },
  { key: 'cache_ttl_days', value: '30' },
]

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

const OPENAI_OK_REPLY = {
  choices: [{ message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
  model: 'llama-3.3-70b-versatile',
}

describe('invoke() — happy path', () => {
  it('calls the first enabled provider, audits, and returns response', async () => {
    // getFeature
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    // loadSettings
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    // resolveCandidates: listProviders
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ])
    // cache lookup: empty
    mockedQuery.mockResolvedValueOnce([])
    mockFetch.mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))

    const r = await invoke('enrich_product', {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(r.text).toBe('{"ok":true}')
    expect(r.provider).toBe('groq')
    expect(r.tokens_in).toBe(12)
    expect(r.tokens_out).toBe(4)
    // Audit + cache write + provider runtime state reset
    expect(mockedExecute).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

describe('invoke() — feature gating', () => {
  it('throws when feature is unknown', async () => {
    mockedQuery.mockResolvedValueOnce([]) // getFeature returns nothing
    await expect(invoke('unknown', { messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/Unknown feature/)
  })

  it('throws when feature is disabled', async () => {
    mockedQuery.mockResolvedValueOnce([{ ...FEATURE_LOW, enabled: 0 }])
    await expect(invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/disabled in settings/)
  })
})

describe('invoke() — privacy gate', () => {
  it('blocks high-tier feature when high_tier_optin is off', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_HIGH])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT) // high_tier_optin=0

    await expect(invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toMatchObject({ status: 'blocked_privacy' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('allows high-tier when opt-in is on', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_HIGH])
    mockedQuery.mockResolvedValueOnce([
      ...SETTINGS_DEFAULT.filter(s => s.key !== 'high_tier_optin'),
      { key: 'high_tier_optin', value: '1' },
    ])
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ])
    mockedQuery.mockResolvedValueOnce([]) // cache miss
    mockFetch.mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))

    const r = await invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] })
    expect(r.provider).toBe('groq')
  })
})

describe('invoke() — no provider', () => {
  it('throws no_provider when no provider is enabled with a key', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([{ ...PROVIDER_GROQ, enabled: 0, api_key_encrypted: null }])

    await expect(invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toMatchObject({ status: 'no_provider' })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('invoke() — provider fallback chain', () => {
  it('falls through to next provider on 429', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ, PROVIDER_OR])
    mockedQuery.mockResolvedValueOnce([]) // cache miss

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'rate' }, 429))
      .mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))

    const r = await invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] })
    expect(r.provider).toBe('openrouter')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns final error when all providers fail', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ, PROVIDER_OR])
    mockedQuery.mockResolvedValueOnce([])

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'rate' }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: 'server' }, 500))

    await expect(invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toBeInstanceOf(AiError)
  })
})

describe('invoke() — cache integration', () => {
  it('returns cached response without making HTTP call', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ])
    mockedQuery.mockResolvedValueOnce([{
      response_json: JSON.stringify({
        text: 'cached answer', json: null, provider: 'groq',
        model: 'llama-3.3-70b-versatile', tokens_in: 0, tokens_out: 0, cost_usd: 0,
      }),
      tokens_in: 0, tokens_out: 0, model: 'llama-3.3-70b-versatile',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }])

    const r = await invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] })
    expect(r.cache_hit).toBe(true)
    expect(r.text).toBe('cached answer')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('respects bypassCache option', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ])
    // No cache lookup happens when bypassCache=true; next query is for fetch results
    mockFetch.mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))

    const r = await invoke(
      'enrich_product',
      { messages: [{ role: 'user', content: 'hi' }] },
      { bypassCache: true },
    )
    expect(r.cache_hit).toBe(false)
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})

describe('pingProvider()', () => {
  it('returns ok:false when provider not found', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const r = await pingProvider('groq')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/not found/)
  })

  it('returns ok:false when no API key', async () => {
    mockedQuery.mockResolvedValueOnce([{ ...PROVIDER_GROQ, api_key_encrypted: null }])
    const r = await pingProvider('groq')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no API key/)
  })

  it('returns ok:true on successful ping', async () => {
    mockedQuery.mockResolvedValueOnce([PROVIDER_GROQ])
    mockFetch.mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))
    const r = await pingProvider('groq')
    expect(r.ok).toBe(true)
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })
})

describe('invoke() — OpenRouter custom headers', () => {
  it('attaches Referer + X-Title for openrouter calls', async () => {
    mockedQuery.mockResolvedValueOnce([FEATURE_LOW])
    mockedQuery.mockResolvedValueOnce(SETTINGS_DEFAULT)
    mockedQuery.mockResolvedValueOnce([PROVIDER_OR])
    mockedQuery.mockResolvedValueOnce([])
    mockFetch.mockResolvedValueOnce(jsonResponse(OPENAI_OK_REPLY))

    await invoke('enrich_product', { messages: [{ role: 'user', content: 'hi' }] })
    const fetchCall = mockFetch.mock.calls[0]
    const headers = (fetchCall[1] as { headers: Record<string, string> }).headers
    expect(headers['HTTP-Referer']).toBe('https://omnix.co.ke')
    expect(headers['X-Title']).toBe('Omnix')
  })
})

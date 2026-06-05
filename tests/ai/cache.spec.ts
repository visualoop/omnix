/**
 * Cache layer tests:
 *   - cacheKey is deterministic across logically-equal inputs
 *   - cacheKey differs when model / messages / schema differ
 *   - readCache returns null when row missing or expired
 *   - writeCache then readCache round-trips
 *   - purgeExpired drops expired rows
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { cacheKey, readCache, writeCache, purgeExpired } from '@/services/ai/cache'
import { query, execute } from '@/lib/db'
import type { ChatRequest, ChatResponse } from '@/services/ai/types'

const mockedQuery = vi.mocked(query)
const mockedExecute = vi.mocked(execute)

beforeEach(() => {
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

const baseRequest: ChatRequest = {
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
  ],
  temperature: 0.2,
  maxTokens: 100,
}

describe('cacheKey()', () => {
  it('returns the same key for identical input', async () => {
    const a = await cacheKey('groq/llama-3.3', baseRequest)
    const b = await cacheKey('groq/llama-3.3', baseRequest)
    expect(a).toBe(b)
  })

  it('is stable across object key order', async () => {
    const a = await cacheKey('groq/llama-3.3', { ...baseRequest, jsonSchema: { type: 'object', x: 1, y: 2 } })
    const b = await cacheKey('groq/llama-3.3', { ...baseRequest, jsonSchema: { y: 2, x: 1, type: 'object' } as Record<string, unknown> })
    expect(a).toBe(b)
  })

  it('differs when model differs', async () => {
    const a = await cacheKey('groq/llama-3.3', baseRequest)
    const b = await cacheKey('openai/gpt-4o-mini', baseRequest)
    expect(a).not.toBe(b)
  })

  it('differs when messages differ', async () => {
    const a = await cacheKey('groq/llama-3.3', baseRequest)
    const b = await cacheKey('groq/llama-3.3', {
      ...baseRequest,
      messages: [{ role: 'user', content: 'different' }],
    })
    expect(a).not.toBe(b)
  })

  it('differs when jsonSchema is set vs unset', async () => {
    const a = await cacheKey('groq/llama-3.3', baseRequest)
    const b = await cacheKey('groq/llama-3.3', { ...baseRequest, jsonSchema: { type: 'object' } })
    expect(a).not.toBe(b)
  })

  it('returns 64-char hex (sha-256)', async () => {
    const k = await cacheKey('m', baseRequest)
    expect(k).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('readCache()', () => {
  it('returns null when no row found', async () => {
    mockedQuery.mockResolvedValueOnce([])
    expect(await readCache('abc')).toBeNull()
  })

  it('returns parsed response with cache_hit=true', async () => {
    const stored: Omit<ChatResponse, 'cache_hit' | 'latency_ms'> = {
      text: 'cached text', json: null, provider: 'groq', model: 'm',
      tokens_in: 10, tokens_out: 5, cost_usd: 0,
    }
    mockedQuery.mockResolvedValueOnce([{
      response_json: JSON.stringify(stored),
      tokens_in: 10, tokens_out: 5, model: 'm',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }])
    const r = await readCache('abc')
    expect(r?.text).toBe('cached text')
    expect(r?.cache_hit).toBe(true)
    expect(r?.latency_ms).toBe(0)
  })

  it('returns null when stored JSON is malformed', async () => {
    mockedQuery.mockResolvedValueOnce([{
      response_json: '{not json',
      tokens_in: 0, tokens_out: 0, model: 'm', expires_at: '2099-01-01',
    }])
    expect(await readCache('abc')).toBeNull()
  })
})

describe('writeCache()', () => {
  it('inserts a row with the given TTL days', async () => {
    const response: ChatResponse = {
      text: 't', json: null, provider: 'groq', model: 'm',
      tokens_in: 1, tokens_out: 2, cost_usd: 0, latency_ms: 100, cache_hit: false,
    }
    await writeCache('key', 'feature', response, 30)
    expect(mockedExecute).toHaveBeenCalled()
    const args = mockedExecute.mock.calls[0]
    expect(args[1]).toEqual(['key', 'feature', 'm', expect.any(String), 1, 2, 30])
  })
})

describe('purgeExpired()', () => {
  it('returns count of expired rows + executes delete', async () => {
    mockedQuery.mockResolvedValueOnce([{ n: 7 }])
    expect(await purgeExpired()).toBe(7)
    expect(mockedExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM ai_cache'))
  })

  it('returns 0 when nothing expired', async () => {
    mockedQuery.mockResolvedValueOnce([{ n: 0 }])
    expect(await purgeExpired()).toBe(0)
  })
})

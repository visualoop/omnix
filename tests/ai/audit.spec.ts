/**
 * Audit-log tests:
 *   - recordCall inserts a row with redacted prompt/response and correct status
 *   - listCalls returns rows in created_at desc order
 *   - callStats aggregates totals + cache hit %
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { recordCall, listCalls, callStats } from '@/services/ai/audit'
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
    { role: 'system', content: 'You are AI.' },
    { role: 'user', content: 'normalize this' },
  ],
}

const baseResponse: ChatResponse = {
  text: 'short response text',
  json: null,
  provider: 'groq',
  model: 'llama-3.3-70b',
  tokens_in: 25,
  tokens_out: 8,
  cost_usd: 0,
  latency_ms: 320,
  cache_hit: false,
}

describe('recordCall()', () => {
  it('inserts a row with status=ok on success', async () => {
    await recordCall({
      featureId: 'enrich_product', providerId: 'groq', model: 'llama-3.3-70b',
      userId: null, request: baseRequest, response: baseResponse,
      privacyTier: 'low', status: 'ok',
    })
    expect(mockedExecute).toHaveBeenCalledOnce()
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect(args[1]).toBe('enrich_product')   // feature_id
    expect(args[2]).toBe('groq')              // provider_id
    expect(args[3]).toBe('llama-3.3-70b')     // model
    expect(args[5]).toBe('normalize this')    // prompt summary (last user msg)
    expect(args[6]).toBe('short response text')
    expect(args[7]).toBe(25)                  // tokens_in
    expect(args[8]).toBe(8)                   // tokens_out
    expect(args[12]).toBe(320)                // latency_ms
    expect(args[13]).toBe('ok')               // status
  })

  it('records cache hit with cache_hit=1', async () => {
    await recordCall({
      featureId: 'enrich_product', providerId: 'groq', model: 'm', userId: null,
      request: baseRequest, response: { ...baseResponse, cache_hit: true, latency_ms: 0 },
      privacyTier: 'low', status: 'ok',
    })
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect(args[10]).toBe(1) // cache_hit column
  })

  it('records error with status=error and error_message', async () => {
    await recordCall({
      featureId: 'enrich_product', providerId: 'none', model: '', userId: null,
      request: baseRequest, response: null,
      privacyTier: 'low', status: 'error', errorMessage: 'rate limited',
    })
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect(args[13]).toBe('error')
    expect(args[14]).toBe('rate limited')
  })

  it('truncates long prompts to 800 chars', async () => {
    const huge = 'x'.repeat(2000)
    await recordCall({
      featureId: 'f', providerId: 'groq', model: 'm', userId: null,
      request: { messages: [{ role: 'user', content: huge }] },
      response: baseResponse, privacyTier: 'low', status: 'ok',
    })
    const args = mockedExecute.mock.calls[0][1] as unknown[]
    expect((args[5] as string).length).toBe(800)
  })
})

describe('listCalls()', () => {
  it('selects with limit', async () => {
    mockedQuery.mockResolvedValueOnce([])
    await listCalls(50)
    const sql = mockedQuery.mock.calls[0][0] as string
    expect(sql).toMatch(/ORDER BY datetime\(created_at\) DESC/)
    expect(mockedQuery.mock.calls[0][1]).toEqual([50])
  })
})

describe('callStats()', () => {
  it('computes totals + cache hit percentage', async () => {
    mockedQuery.mockResolvedValueOnce([{
      n: 100, ok: 90, err: 5, rl: 5, cache: 60, tin: 50000, tout: 20000, cost: 0.42,
    }])
    const stats = await callStats(30)
    expect(stats.total).toBe(100)
    expect(stats.success).toBe(90)
    expect(stats.errors).toBe(5)
    expect(stats.rate_limited).toBe(5)
    expect(stats.cache_hit_pct).toBeCloseTo(60)
    expect(stats.total_tokens_in).toBe(50000)
    expect(stats.total_tokens_out).toBe(20000)
    expect(stats.total_cost_usd).toBeCloseTo(0.42)
  })

  it('returns zeros when no rows', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const stats = await callStats(7)
    expect(stats.total).toBe(0)
    expect(stats.cache_hit_pct).toBe(0)
  })
})

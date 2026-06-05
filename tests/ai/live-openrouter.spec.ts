/**
 * Live e2e test against OpenRouter free tier. Skipped unless
 * OPENROUTER_API_KEY is set. Exercises the multi-model fallback chain:
 * even if the primary `:free` model is upstream rate-limited, the router
 * walks `FALLBACK_MODELS.openrouter.text` until one succeeds.
 *
 * Only 2 features are exercised here (enrich + explainEtims) to stay
 * within the free tier's per-IP throttle. The full feature surface is
 * verified against Groq in live-groq.spec.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const KEY = process.env.OPENROUTER_API_KEY ?? ''
const RUN = KEY.length > 0

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { ai } from '@/services/ai'
import { query, execute } from '@/lib/db'

const mockedQuery = vi.mocked(query)
const mockedExecute = vi.mocked(execute)

const PROVIDER_OR = {
  id: 'openrouter', display_name: 'OpenRouter', enabled: 1, api_key_encrypted: KEY,
  base_url: 'https://openrouter.ai/api/v1', priority: 10,
  preferred_text_model: 'openai/gpt-oss-20b:free',
  preferred_vision_model: 'meta-llama/llama-3.2-90b-vision-instruct:free',
  preferred_reasoning_model: 'z-ai/glm-4.5-air:free',
  daily_call_count: 0, daily_window_start: null,
  rate_limited_until: null, last_error: null, notes: '',
}

const SETTINGS = [
  { key: 'free_models_only', value: '1' },
  { key: 'cache_enabled', value: '0' },
  { key: 'high_tier_optin', value: '0' },
  { key: 'cache_ttl_days', value: '30' },
]

interface FeatureRow {
  feature_id: string; display_name: string; description: string;
  enabled: number; privacy_tier: 'low' | 'medium' | 'high';
  task_kind: 'text' | 'vision' | 'reasoning';
  preferred_provider: string | null; preferred_model: string | null;
}

const feature = (id: string, kind: 'text' | 'vision' | 'reasoning' = 'text'): FeatureRow => ({
  feature_id: id, display_name: id, description: '',
  enabled: 1, privacy_tier: 'low', task_kind: kind,
  preferred_provider: null, preferred_model: null,
})

const setupMocks = (id: string) => {
  mockedQuery
    .mockResolvedValueOnce([feature(id)])
    .mockResolvedValueOnce(SETTINGS)
    .mockResolvedValueOnce([PROVIDER_OR])
}

beforeEach(() => {
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

describe.skipIf(!RUN)('live: OpenRouter multi-model fallback', () => {
  it('enrichProduct succeeds via primary or fallback free model', async () => {
    setupMocks('enrich_product')
    const r = await ai.enrichProduct('panadol')
    console.log('[live-or] enrichProduct →', JSON.stringify(r))
    expect(r.name).toBeTruthy()
    expect(['high', 'medium', 'low']).toContain(r.confidence)
  }, 90_000)

  it('explainEtims succeeds via primary or fallback free model', async () => {
    // Pause to space free-tier requests
    await new Promise((r) => setTimeout(r, 12_000))
    setupMocks('explain_etims')
    const r = await ai.explainEtims('CMC-001', 'Invalid control unit registration. PIN mismatch.')
    console.log('[live-or] explainEtims →', JSON.stringify(r))
    expect(r.summary).toBeTruthy()
    expect(['low', 'medium', 'high']).toContain(r.severity)
  }, 90_000)
})

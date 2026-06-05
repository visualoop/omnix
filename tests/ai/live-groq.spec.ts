/**
 * Live e2e test against Groq. Skipped unless GROQ_API_KEY is set.
 * Groq's free tier (30 RPM) is generous enough that the suite runs
 * back-to-back without throttling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const KEY = process.env.GROQ_API_KEY ?? ''
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

const PROVIDER_GROQ = {
  id: 'groq', display_name: 'Groq', enabled: 1, api_key_encrypted: KEY,
  base_url: 'https://api.groq.com/openai/v1', priority: 10,
  preferred_text_model: 'llama-3.3-70b-versatile',
  preferred_vision_model: 'llama-3.2-90b-vision-preview',
  preferred_reasoning_model: 'qwen-qwq-32b',
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

const setupMocks = (id: string, kind: 'text' | 'vision' | 'reasoning' = 'text') => {
  mockedQuery
    .mockResolvedValueOnce([feature(id, kind)])
    .mockResolvedValueOnce(SETTINGS)
    .mockResolvedValueOnce([PROVIDER_GROQ])
}

beforeEach(() => {
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

describe.skipIf(!RUN)('live: Groq free tier', () => {
  it('enrichProduct — Panadol → Paracetamol 500mg', async () => {
    setupMocks('enrich_product')
    const r = await ai.enrichProduct('panadol')
    console.log('[live-groq] enrichProduct →', JSON.stringify(r))
    expect(r.name).toBeTruthy()
  }, 30_000)

  it('normalizeImport — Kenyan supplier headers', async () => {
    setupMocks('normalize_import')
    const r = await ai.normalizeImport(['ITEM', 'qty pakd', 'unt price ksh', 'expires'])
    console.log('[live-groq] normalizeImport →', JSON.stringify(r))
    expect(r).toHaveLength(4)
  }, 30_000)

  it('explainEtims — control unit error', async () => {
    setupMocks('explain_etims')
    const r = await ai.explainEtims('CMC-001', 'Invalid control unit registration. PIN mismatch.')
    console.log('[live-groq] explainEtims →', JSON.stringify(r))
    expect(r.summary).toBeTruthy()
    expect(['low', 'medium', 'high']).toContain(r.severity)
  }, 30_000)

  it('docsQa — how to run a Z report', async () => {
    setupMocks('docs_qa')
    const r = await ai.docsQa('how do I run a Z report?', { route: '/dashboard' })
    console.log('[live-groq] docsQa →', JSON.stringify(r))
    expect(r.answer).toBeTruthy()
  }, 30_000)

  it('setupAssist — Kisumu chemist', async () => {
    setupMocks('setup_assist')
    const r = await ai.setupAssist('I run a small chemist in Kisumu, 1 branch, 2 cashiers.')
    console.log('[live-groq] setupAssist →', JSON.stringify(r))
    expect(r.modules.length).toBeGreaterThan(0)
    expect([16, 8, 0]).toContain(r.tax_setup.vat_rate)
  }, 30_000)
})

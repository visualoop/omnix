/**
 * Task-level tests: each Tier-1 feature builds the right prompt + parses
 * the AI response into typed output. We mock the router's `invoke` to
 * return canned responses; the test asserts the task wraps it correctly
 * and degrades gracefully on bad JSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))

vi.mock('@/services/ai/router', () => ({
  invoke: mockInvoke,
  pingProvider: vi.fn(),
}))

import { ai } from '@/services/ai'

beforeEach(() => {
  mockInvoke.mockReset()
})

const baseResponse = {
  text: '',
  json: null as unknown,
  provider: 'groq' as const,
  model: 'llama-3.3-70b-versatile',
  tokens_in: 10,
  tokens_out: 5,
  cost_usd: 0,
  latency_ms: 100,
  cache_hit: false,
}

// ─── enrichProduct ────────────────────────────────────────────────────────

describe('ai.enrichProduct()', () => {
  it('returns parsed JSON when router provides it', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      json: {
        name: 'Paracetamol 500mg',
        category: 'Analgesic',
        unit: 'tablet',
        tax_rate: 0,
        active_ingredient: 'paracetamol',
        confidence: 'high',
        notes: 'Common KE OTC',
      },
    })
    const r = await ai.enrichProduct('panadol')
    expect(r.name).toBe('Paracetamol 500mg')
    expect(r.unit).toBe('tablet')
    expect(r.confidence).toBe('high')
  })

  it('parses text response when json is null', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      text: '{"name":"X","category":null,"unit":"pcs","tax_rate":16,"active_ingredient":null,"confidence":"medium","notes":null}',
    })
    const r = await ai.enrichProduct('whatever')
    expect(r.name).toBe('X')
    expect(r.tax_rate).toBe(16)
  })

  it('returns degraded result when both json and text fail to parse', async () => {
    mockInvoke.mockResolvedValueOnce({ ...baseResponse, text: 'not json' })
    const r = await ai.enrichProduct('mystery item')
    expect(r.name).toBe('mystery item') // echoes input
    expect(r.confidence).toBe('low')
    expect(r.notes).toMatch(/manually/)
  })
})

// ─── normalizeImport ──────────────────────────────────────────────────────

describe('ai.normalizeImport()', () => {
  it('returns empty array for empty input', async () => {
    const r = await ai.normalizeImport([])
    expect(r).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns mappings when router provides JSON', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      json: {
        mappings: [
          { source_header: 'ITEM', target_field: 'name', confidence: 'high' },
          { source_header: 'qty pakd', target_field: 'initial_stock', confidence: 'medium' },
          { source_header: 'mystery', target_field: null, confidence: 'low' },
        ],
      },
    })
    const r = await ai.normalizeImport(['ITEM', 'qty pakd', 'mystery'])
    expect(r).toHaveLength(3)
    expect(r[0].target_field).toBe('name')
    expect(r[2].target_field).toBeNull()
  })

  it('returns null mappings when router output is unparseable', async () => {
    mockInvoke.mockResolvedValueOnce({ ...baseResponse, text: 'oops not json' })
    const r = await ai.normalizeImport(['A', 'B'])
    expect(r).toHaveLength(2)
    expect(r.every((m) => m.target_field === null)).toBe(true)
  })
})

// ─── explainEtims ─────────────────────────────────────────────────────────

describe('ai.explainEtims()', () => {
  it('returns parsed explanation', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      json: {
        summary: 'Control unit registration expired',
        steps: ['Renew on KRA portal', 'Restart eTIMS device'],
        owner: 'kra_support',
        severity: 'high',
      },
    })
    const r = await ai.explainEtims('CMC-001', 'Invalid control unit')
    expect(r.severity).toBe('high')
    expect(r.steps).toHaveLength(2)
  })

  it('returns generic fallback on parse failure', async () => {
    mockInvoke.mockResolvedValueOnce({ ...baseResponse, text: '' })
    const r = await ai.explainEtims('UNKNOWN', 'something broke')
    expect(r.summary).toMatch(/Could not interpret/)
    expect(r.owner).toBe('kra_support')
  })
})

// ─── docsQa ───────────────────────────────────────────────────────────────

describe('ai.docsQa()', () => {
  it('routes context.route into the prompt', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      json: {
        answer: 'Press F8 from the dashboard.',
        suggestions: [{ label: 'Z report', shortcut: 'F8' }],
        confidence: 'high',
      },
    })
    const r = await ai.docsQa('how do I run a Z report', { route: '/dashboard' })
    expect(r.answer).toMatch(/F8/)
    const userMsg = mockInvoke.mock.calls[0][1].messages.find((m: { role: string }) => m.role === 'user')
    expect(userMsg.content).toMatch(/\[user is on \/dashboard\]/)
  })

  it('returns text + low-confidence fallback when JSON missing', async () => {
    mockInvoke.mockResolvedValueOnce({ ...baseResponse, text: 'plain answer' })
    const r = await ai.docsQa('huh')
    expect(r.answer).toBe('plain answer')
    expect(r.confidence).toBe('low')
  })
})

// ─── setupAssist ──────────────────────────────────────────────────────────

describe('ai.setupAssist()', () => {
  it('returns parsed suggestion', async () => {
    mockInvoke.mockResolvedValueOnce({
      ...baseResponse,
      json: {
        modules: [{ id: 'dawa', reason: 'pharmacy described' }],
        receipt_language: 'mixed',
        tax_setup: { vat_rate: 0, etims_required: true, reason: 'medicines' },
        starter_products: [{ name: 'Panadol', category: 'OTC', unit: 'tablet' }],
        welcome_note: 'Karibu',
      },
    })
    const r = await ai.setupAssist('chemist in Kisumu, 1 branch, 2 cashiers')
    expect(r.modules[0].id).toBe('dawa')
    expect(r.tax_setup.vat_rate).toBe(0)
    expect(r.starter_products).toHaveLength(1)
  })

  it('returns conservative defaults on parse failure', async () => {
    mockInvoke.mockResolvedValueOnce({ ...baseResponse, text: 'broken' })
    const r = await ai.setupAssist('whatever')
    expect(r.modules[0].id).toBe('core')
    expect(r.tax_setup.vat_rate).toBe(16)
  })
})

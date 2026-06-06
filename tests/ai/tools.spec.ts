/**
 * Tool layer tests — verify each tool's schema validates correctly + that
 * the handlers shape their results as expected. We mock @/lib/db (the
 * SQLite query helper) and react-router's navigate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

// pos-helpers is dynamically imported by getTodaySales / getInventoryAlerts
vi.mock('@/services/pos-helpers', () => ({
  getTodaySalesSummary: vi.fn(),
  getLowStockProducts: vi.fn(),
}))

// tauri-plugin-opener (used by openDocs)
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}))

import { buildAssistantTools } from '@/services/ai/tools'
import { query } from '@/lib/db'
import { getTodaySalesSummary, getLowStockProducts } from '@/services/pos-helpers'

const mockedQuery = vi.mocked(query)
const mockedToday = vi.mocked(getTodaySalesSummary)
const mockedLow = vi.mocked(getLowStockProducts)

beforeEach(() => {
  mockedQuery.mockReset()
  mockedToday.mockReset()
  mockedLow.mockReset()
})

const navigate = vi.fn()
const tools = () => buildAssistantTools({ navigate })

describe('navigate tool', () => {
  it('schema accepts /route shape', () => {
    expect(() =>
      tools().navigate.inputSchema.parse({ route: '/pos' })
    ).not.toThrow()
  })

  it('schema rejects relative path', () => {
    expect(() =>
      tools().navigate.inputSchema.parse({ route: 'pos' })
    ).toThrow()
  })

  it('execute calls navigate + returns ack', async () => {
    navigate.mockClear()
    const out = await tools().navigate.execute!({ route: '/inventory' }, { toolCallId: 't1', messages: [] })
    expect(navigate).toHaveBeenCalledWith('/inventory')
    expect(out).toEqual({ ok: true, navigatedTo: '/inventory', reason: 'Opened' })
  })

  it('execute uses provided reason in result', async () => {
    const out = await tools().navigate.execute!(
      { route: '/pos', reason: 'starting POS' },
      { toolCallId: 't2', messages: [] },
    )
    expect((out as { reason: string }).reason).toBe('starting POS')
  })
})

describe('getTodaySales tool', () => {
  it('returns whatever pos-helpers gives us', async () => {
    mockedToday.mockResolvedValueOnce({
      count: 12, revenue: 4500, cash: 2000, mpesa: 2500, card: 0, other: 0, refunds: 0, avg_basket: 375,
    })
    const out = await tools().getTodaySales.execute!({}, { toolCallId: 't', messages: [] })
    expect(out).toMatchObject({ count: 12, revenue: 4500 })
  })
})

describe('getInventoryAlerts tool', () => {
  it('passes limit through + wraps result', async () => {
    mockedLow.mockResolvedValueOnce([
      { id: 'p1', name: 'Panadol', stock_qty: 2, reorder_level: 10 },
      { id: 'p2', name: 'Sukari', stock_qty: 0, reorder_level: 5 },
    ])
    const out = await tools().getInventoryAlerts.execute!({ limit: 5 }, { toolCallId: 't', messages: [] })
    expect(mockedLow).toHaveBeenCalledWith(5)
    expect(out).toEqual({
      count: 2,
      items: [
        { id: 'p1', name: 'Panadol', stock_qty: 2, reorder_level: 10 },
        { id: 'p2', name: 'Sukari', stock_qty: 0, reorder_level: 5 },
      ],
    })
  })
})

describe('searchProducts tool', () => {
  it('queries with %q% and limits to 10 + filters menu items', async () => {
    mockedQuery.mockResolvedValueOnce([
      { id: 'p1', name: 'Panadol 500mg', sku: 'PCM500', barcode: null, unit: 'tablet', stock_qty: 50, selling_price: 5 },
    ])
    const out = await tools().searchProducts.execute!({ q: 'panadol' }, { toolCallId: 't', messages: [] })
    const sql = mockedQuery.mock.calls[0][0] as string
    expect(sql).toMatch(/active = 1/)
    expect(sql).toMatch(/kind/)
    expect(sql).toMatch(/LIMIT 10/)
    expect(mockedQuery.mock.calls[0][1]).toEqual(['%panadol%'])
    expect(out).toMatchObject({ count: 1 })
  })

  it('returns count:0 when nothing found', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const out = await tools().searchProducts.execute!({ q: 'xyz' }, { toolCallId: 't', messages: [] })
    expect(out).toEqual({ count: 0, items: [] })
  })
})

describe('searchCustomers tool', () => {
  it('queries by name/phone/email', async () => {
    mockedQuery.mockResolvedValueOnce([
      { id: 'c1', name: 'Mama Wanjiru', phone: '0712345678', email: null, credit_balance: 0 },
    ])
    const out = await tools().searchCustomers.execute!({ q: 'wanjiru' }, { toolCallId: 't', messages: [] })
    expect(mockedQuery.mock.calls[0][1]).toEqual(['%wanjiru%'])
    expect(out).toMatchObject({ count: 1 })
  })
})

describe('getRecentSales tool', () => {
  it('passes limit + orders by created_at desc', async () => {
    mockedQuery.mockResolvedValueOnce([
      { id: 's1', sale_number: 'S-2025-0001', total: 500, payment_status: 'paid', customer_name: null, created_at: '2025-01-01' },
    ])
    const out = await tools().getRecentSales.execute!({ limit: 5 }, { toolCallId: 't', messages: [] })
    const sql = mockedQuery.mock.calls[0][0] as string
    expect(sql).toMatch(/ORDER BY datetime\(s\.created_at\) DESC/)
    expect(mockedQuery.mock.calls[0][1]).toEqual([5])
    expect(out).toMatchObject({ count: 1 })
  })
})

describe('openDocs tool', () => {
  it('returns the docs URL with slug', async () => {
    const out = await tools().openDocs.execute!({ slug: 'kra-etims-setup' }, { toolCallId: 't', messages: [] })
    expect(out).toEqual({ ok: true, url: 'https://omnix.co.ke/docs/kra-etims-setup' })
  })

  it('returns the bare /docs URL when slug omitted', async () => {
    const out = await tools().openDocs.execute!({}, { toolCallId: 't', messages: [] })
    expect(out).toEqual({ ok: true, url: 'https://omnix.co.ke/docs' })
  })
})

describe('tool inventory', () => {
  it('exposes 7 tools', () => {
    const t = tools()
    const names = Object.keys(t)
    expect(names.sort()).toEqual([
      'getInventoryAlerts',
      'getRecentSales',
      'getTodaySales',
      'navigate',
      'openDocs',
      'searchCustomers',
      'searchProducts',
    ])
  })
})

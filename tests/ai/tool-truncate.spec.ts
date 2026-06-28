/**
 * Tests for tool-result truncation. Coverage:
 *   - truncateToolResult passes small values through
 *   - truncateToolResult shapes large values as TruncatedToolPayload
 *   - withTruncatedToolResults wraps each tool's execute
 *   - The fullResults map is keyed by toolCallId
 *   - Tools without an execute are passed through unchanged
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TOOL_RESULT_MAX_CHARS,
  truncateToolResult,
  withTruncatedToolResults,
} from '@/services/ai/tool-truncate'

describe('truncateToolResult', () => {
  it('returns null/undefined unchanged', () => {
    expect(truncateToolResult(null, 100)).toBeNull()
    expect(truncateToolResult(undefined, 100)).toBeUndefined()
  })

  it('returns a short string unchanged', () => {
    expect(truncateToolResult('hello', 100)).toBe('hello')
  })

  it('returns a short object unchanged', () => {
    const r = { ok: true, count: 3 }
    expect(truncateToolResult(r, 100)).toBe(r)
  })

  it('clips a long string keeping head + tail + marker', () => {
    const big = 'A'.repeat(5000)
    const r = truncateToolResult(big, 1000) as string
    expect(typeof r).toBe('string')
    expect(r.length).toBeLessThan(big.length)
    expect(r).toMatch(/truncated for the model/)
  })

  it('wraps a long object in a TruncatedToolPayload', () => {
    const big = { items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `n${i}` })) }
    const r = truncateToolResult(big, 500) as {
      truncated: true
      originalLength: number
      preview: string
      note: string
    }
    expect(r.truncated).toBe(true)
    expect(r.originalLength).toBeGreaterThan(500)
    expect(r.preview).toMatch(/truncated for the model/)
    expect(r.note).toContain('truncated')
  })

  it('handles circular references without throwing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: any = { name: 'a' }
    a.self = a
    // Should NOT throw; should produce a string that survives.
    expect(() => truncateToolResult(a, 100)).not.toThrow()
  })
})

describe('withTruncatedToolResults', () => {
  it('wraps execute and captures full result via toolCallId', async () => {
    const big = { rows: Array.from({ length: 500 }, (_, i) => i) }
    const bundle = withTruncatedToolResults(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bigTool: { execute: async () => big } as any,
      },
      500,
    )
    const tool = bundle.tools.bigTool as unknown as { execute: (a: unknown, o: { toolCallId: string }) => Promise<unknown> }
    const modelView = await tool.execute({}, { toolCallId: 'call-1' })
    expect(modelView).not.toBe(big) // model sees the truncated payload
    expect(bundle.fullResults.get('call-1')).toBe(big) // UI sees the original
  })

  it('passes small results through both views identically', async () => {
    const small = { ok: true }
    const bundle = withTruncatedToolResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { quickTool: { execute: async () => small } as any },
    )
    const tool = bundle.tools.quickTool as unknown as { execute: (a: unknown, o: { toolCallId: string }) => Promise<unknown> }
    const modelView = await tool.execute({}, { toolCallId: 'call-2' })
    expect(modelView).toBe(small)
    expect(bundle.fullResults.get('call-2')).toBe(small)
  })

  it('leaves tools without execute untouched', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passthrough: any = { description: 'no-exec' }
    const bundle = withTruncatedToolResults({ passthrough })
    expect(bundle.tools.passthrough).toBe(passthrough)
  })

  it('uses DEFAULT_TOOL_RESULT_MAX_CHARS when no override given', async () => {
    const big = 'x'.repeat(DEFAULT_TOOL_RESULT_MAX_CHARS + 1000)
    const bundle = withTruncatedToolResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { stringTool: { execute: async () => big } as any },
    )
    const tool = bundle.tools.stringTool as unknown as { execute: (a: unknown, o: { toolCallId: string }) => Promise<unknown> }
    const view = (await tool.execute({}, { toolCallId: 'call-3' })) as string
    expect(view.length).toBeLessThan(big.length)
  })

  it('survives a missing toolCallId without throwing', async () => {
    const bundle = withTruncatedToolResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { t: { execute: async () => 'short' } as any },
    )
    const tool = bundle.tools.t as unknown as { execute: (a: unknown, o: Record<string, unknown>) => Promise<unknown> }
    await expect(tool.execute({}, {})).resolves.toBe('short')
  })
})

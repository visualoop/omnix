/**
 * Tests for the retry/timeout primitives:
 *   - parseRetryAfter for seconds, HTTP-date, plain headers, fetch Headers
 *   - sleep resolves after the requested delay
 *   - createIdleWatchdog aborts on idle and not when kicked
 */
import { describe, it, expect, vi } from 'vitest'
import {
  STREAM_IDLE_TIMEOUT_MS,
  createIdleWatchdog,
  parseRetryAfter,
  sleep,
} from '@/services/ai/retry'

describe('parseRetryAfter — seconds form', () => {
  it('parses an integer seconds string', () => {
    expect(parseRetryAfter({ get: () => '5' })).toBe(5_000)
  })

  it('parses a fractional seconds string', () => {
    const v = parseRetryAfter({ get: () => '2.5' })
    expect(v).toBe(2_500)
  })

  it('treats 0 as zero ms', () => {
    expect(parseRetryAfter({ get: () => '0' })).toBe(0)
  })

  it('rejects a negative value', () => {
    expect(parseRetryAfter({ get: () => '-1' })).toBeNull()
  })
})

describe('parseRetryAfter — HTTP-date form', () => {
  it('returns ms until the future date', () => {
    const future = new Date(Date.now() + 30_000).toUTCString()
    const v = parseRetryAfter({ get: () => future })
    expect(v).toBeGreaterThanOrEqual(20_000)
    expect(v).toBeLessThanOrEqual(40_000)
  })

  it('clamps a past date to 0', () => {
    const past = new Date(Date.now() - 60_000).toUTCString()
    expect(parseRetryAfter({ get: () => past })).toBe(0)
  })
})

describe('parseRetryAfter — header shapes', () => {
  it('handles plain object headers (case-insensitive key)', () => {
    expect(parseRetryAfter({ 'retry-after': '3' })).toBe(3_000)
    expect(parseRetryAfter({ 'Retry-After': '3' })).toBe(3_000)
  })

  it('returns null when header is absent', () => {
    expect(parseRetryAfter({ get: () => null })).toBeNull()
    expect(parseRetryAfter({})).toBeNull()
  })

  it('returns null for garbage values', () => {
    expect(parseRetryAfter({ get: () => 'not a number or date' })).toBeNull()
  })

  it('works with native Headers', () => {
    const h = new Headers()
    h.set('retry-after', '7')
    expect(parseRetryAfter(h)).toBe(7_000)
  })
})

describe('sleep', () => {
  it('resolves after the requested ms (approx)', async () => {
    vi.useFakeTimers()
    const promise = sleep(1_000)
    vi.advanceTimersByTime(1_000)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  it('rejects when the abort signal fires', async () => {
    const ctrl = new AbortController()
    const p = sleep(60_000, ctrl.signal)
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('createIdleWatchdog', () => {
  it('aborts after the idle interval', async () => {
    vi.useFakeTimers()
    const w = createIdleWatchdog(50, 10) // tiny intervals for fast test
    expect(w.signal.aborted).toBe(false)
    // No kicks — wait long enough for the poll to detect idle.
    vi.advanceTimersByTime(200)
    expect(w.timedOut()).toBe(true)
    expect(w.signal.aborted).toBe(true)
    w.dispose()
    vi.useRealTimers()
  })

  it('does not abort when kicked frequently', async () => {
    vi.useFakeTimers()
    const w = createIdleWatchdog(100, 20)
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(40)
      w.kick()
    }
    expect(w.timedOut()).toBe(false)
    expect(w.signal.aborted).toBe(false)
    w.dispose()
    vi.useRealTimers()
  })

  it('uses STREAM_IDLE_TIMEOUT_MS as the default idle window', () => {
    expect(STREAM_IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000)
  })

  it('dispose stops the poll without throwing', () => {
    const w = createIdleWatchdog(1_000, 100)
    expect(() => w.dispose()).not.toThrow()
  })
})

/**
 * Tests for the auto-cloud-backup scheduler logic.
 *
 * `nextRunAt` is pure — easy to test. The DB-bound get/setScheduleConfig
 * are tested with a mocked db module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}))

import { nextRunAt, getScheduleConfig, setScheduleConfig } from '@/hooks/use-auto-cloud-backup'
import { query, execute } from '@/lib/db'

const mockedQuery = vi.mocked(query)
const mockedExecute = vi.mocked(execute)

beforeEach(() => {
  mockedQuery.mockReset()
  mockedExecute.mockReset()
})

describe('nextRunAt', () => {
  it('returns 0 when scheduling is disabled', () => {
    expect(nextRunAt({ enabled: false, intervalHours: 24, lastRun: 0 })).toBe(0)
    expect(nextRunAt({ enabled: false, intervalHours: 24, lastRun: 1_700_000_000_000 })).toBe(0)
  })

  it('schedules from lastRun + interval when lastRun > 0', () => {
    const last = 1_700_000_000_000
    const cfg = { enabled: true, intervalHours: 6, lastRun: last }
    expect(nextRunAt(cfg)).toBe(last + 6 * 3600 * 1000)
  })

  it('returns "due now" when lastRun is 0 (first run)', () => {
    // first-run policy: nextRunAt should resolve to <= now so the scheduler fires immediately
    const cfg = { enabled: true, intervalHours: 24, lastRun: 0 }
    expect(nextRunAt(cfg)).toBeLessThanOrEqual(Date.now())
  })

  it('honours different intervals', () => {
    const last = 1_700_000_000_000
    expect(nextRunAt({ enabled: true, intervalHours: 1, lastRun: last })).toBe(last + 3600_000)
    expect(nextRunAt({ enabled: true, intervalHours: 12, lastRun: last })).toBe(last + 12 * 3600_000)
    expect(nextRunAt({ enabled: true, intervalHours: 168, lastRun: last })).toBe(last + 168 * 3600_000)
  })
})

describe('getScheduleConfig', () => {
  it('returns defaults when no rows', async () => {
    mockedQuery.mockResolvedValueOnce([])
    const cfg = await getScheduleConfig()
    expect(cfg).toEqual({ enabled: false, intervalHours: 24, lastRun: 0 })
  })

  it('parses rows from settings table', async () => {
    mockedQuery.mockResolvedValueOnce([
      { key: 'cloud_backup_auto.enabled', value: '1' },
      { key: 'cloud_backup_auto.interval_hours', value: '6' },
      { key: 'cloud_backup_auto.last_run', value: '1700000000000' },
    ])
    const cfg = await getScheduleConfig()
    expect(cfg).toEqual({ enabled: true, intervalHours: 6, lastRun: 1_700_000_000_000 })
  })

  it('coerces enabled=0 to false', async () => {
    mockedQuery.mockResolvedValueOnce([{ key: 'cloud_backup_auto.enabled', value: '0' }])
    const cfg = await getScheduleConfig()
    expect(cfg.enabled).toBe(false)
  })

  it('falls back to interval=24 if intervalHours is unparseable', async () => {
    mockedQuery.mockResolvedValueOnce([
      { key: 'cloud_backup_auto.interval_hours', value: 'not-a-number' },
    ])
    const cfg = await getScheduleConfig()
    expect(cfg.intervalHours).toBe(24)
  })
})

describe('setScheduleConfig', () => {
  it('writes only the fields that were patched', async () => {
    mockedExecute.mockResolvedValue(undefined)
    await setScheduleConfig({ enabled: true })
    expect(mockedExecute).toHaveBeenCalledTimes(1)
    const sql = mockedExecute.mock.calls[0][0]
    expect(sql).toContain('settings')
    const params = mockedExecute.mock.calls[0][1] as unknown[]
    expect(params[0]).toBe('cloud_backup_auto.enabled')
    expect(params[1]).toBe('1')
  })

  it('writes interval + lastRun in correct order', async () => {
    mockedExecute.mockResolvedValue(undefined)
    await setScheduleConfig({ intervalHours: 12, lastRun: 1_700_000_000_000 })
    expect(mockedExecute).toHaveBeenCalledTimes(2)
    const calls = mockedExecute.mock.calls
    const params = calls.map((c) => c[1] as unknown[])
    expect(params[0]).toEqual(['cloud_backup_auto.interval_hours', '12'])
    expect(params[1]).toEqual(['cloud_backup_auto.last_run', '1700000000000'])
  })

  it('coerces enabled=false to "0"', async () => {
    mockedExecute.mockResolvedValue(undefined)
    await setScheduleConfig({ enabled: false })
    const params = mockedExecute.mock.calls[0][1] as unknown[]
    expect(params[1]).toBe('0')
  })

  it('uses INSERT … ON CONFLICT upsert (idempotent)', async () => {
    mockedExecute.mockResolvedValue(undefined)
    await setScheduleConfig({ enabled: true })
    const sql = mockedExecute.mock.calls[0][0]
    expect(sql).toMatch(/ON CONFLICT/i)
    expect(sql).toMatch(/INSERT INTO settings/i)
  })
})

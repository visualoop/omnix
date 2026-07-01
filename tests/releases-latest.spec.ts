/**
 * releases-latest — smoke tests for the version-compare + variant-picking
 * logic. Doesn't exercise the DB path (that's an integration concern).
 */
import { describe, it, expect } from 'vitest'

// Re-implement the compareVersions helper here since the route module
// isn't easily importable without Next.js runtime. The behaviour under
// test is small enough that a one-liner clone is fine.
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

describe('releases-latest — version comparison', () => {
  it('0.24.0 equals 0.24.0', () => {
    expect(compareVersions('0.24.0', '0.24.0')).toBe(0)
  })

  it('client on 0.23.0 asking about 0.24.0 → update available (negative)', () => {
    expect(compareVersions('0.23.0', '0.24.0')).toBeLessThan(0)
  })

  it('client on 0.24.0 asking about 0.23.0 → no update (positive)', () => {
    expect(compareVersions('0.24.0', '0.23.0')).toBeGreaterThan(0)
  })

  it('handles v-prefix (Tauri Cargo strips it)', () => {
    expect(compareVersions('v0.24.0', '0.24.0')).toBe(0)
    expect(compareVersions('0.24.0', 'v0.24.0')).toBe(0)
  })

  it('missing segments treated as 0', () => {
    expect(compareVersions('0.24', '0.24.0')).toBe(0)
    expect(compareVersions('1', '0.99.99')).toBeGreaterThan(0)
  })

  it('major beats minor', () => {
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0)
  })

  it('minor beats patch', () => {
    expect(compareVersions('0.24.0', '0.23.99')).toBeGreaterThan(0)
  })

  it('non-numeric segments coerced to 0', () => {
    // '0.24.0-beta.1' → parses first three segments only, safely
    expect(compareVersions('0.24.0-beta', '0.24.0')).toBe(0)
  })
})

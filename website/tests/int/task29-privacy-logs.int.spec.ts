import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Task 29 — bucket C: PII-safe logs.
 *
 * Source coverage over the acquisition / transactional email failure paths. It
 * asserts that raw email, phone, business name, notes, demo reference, and
 * payment reference are gone from console output, while a useful constant code
 * (and, where safe, the error class or provider message) stays. It also checks
 * that retry / status behaviour was not changed — errors are still thrown or
 * returned, never swallowed.
 */

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** Every console.* call site as a single logical string (arg list included). */
function consoleCalls(src: string): string[] {
  const calls: string[] = []
  const re = /console\.(?:log|warn|error|info|debug)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = re.exec(src)) !== null) {
    let depth = 0
    let i = match.index + match[0].length - 1
    for (; i < src.length; i += 1) {
      const ch = src[i]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }
    calls.push(src.slice(match.index, i + 1))
  }
  return calls
}

describe('Task 29 · email.ts logs carry no raw email or reference', () => {
  const src = read('src/lib/email.ts')
  const calls = consoleCalls(src)

  it('has console calls to inspect', () => {
    expect(calls.length).toBeGreaterThan(0)
  })

  it('never interpolates an email, recipient, or reference into a log', () => {
    for (const call of calls) {
      expect(call, call).not.toMatch(/\$\{[^}]*(email|\bto\b|reference)[^}]*\}/i)
      expect(call, call).not.toContain('input.to')
      expect(call, call).not.toContain('input.email')
      expect(call, call).not.toContain('input.reference')
      expect(call, call).not.toContain('${to}')
    }
  })

  it('keeps a useful constant event code on the skip paths', () => {
    expect(src).toContain('[email] magic-link send skipped')
    expect(src).toContain('[email] license-key delivery skipped')
    expect(src).toContain('[email] team-invite send skipped')
    expect(src).toContain('[email] demo-request delivery skipped')
    expect(src).toContain('[email] partnership enquiry captured but not delivered')
  })

  it('does not swallow send errors — throws stay in place', () => {
    expect(src).toContain('throw new Error(`Magic link send failed')
    expect(src).toContain('throw new Error(`License key send failed')
    expect(src).toContain('throw new Error(`Demo notification failed')
  })
})

describe('Task 29 · cron/daily logs use licenseId, never the recipient email', () => {
  const src = read('src/app/api/cron/daily/route.ts')
  const calls = consoleCalls(src)

  it('never logs row.email', () => {
    for (const call of calls) {
      expect(call, call).not.toContain('row.email')
      expect(call, call).not.toMatch(/\$\{row\.email\}/)
    }
  })

  it('keeps the stable licenseId + milestone in the failure logs', () => {
    expect(src).toContain('trial-${days}d reminder failed for license ${row.licenseId}')
    expect(src).toContain('maint-${days}d reminder failed for license ${row.licenseId}')
    expect(src).toContain('maint-lapsed notification failed for license ${row.licenseId}')
    expect(src).toContain('cloud-${days}d reminder failed for license ${row.licenseId}')
  })

  it('still logs failures (does not swallow them)', () => {
    expect(calls.some((c) => c.includes('console.error'))).toBe(true)
  })

  it('logs the error class name only — never the raw caught error object', () => {
    for (const call of calls) {
      // A bare trailing `, e)` passes the raw Error, whose provider message can
      // echo the recipient email; it must be narrowed to the class name.
      expect(call, call).not.toMatch(/,\s*e\s*\)/)
    }
    expect(src).toContain('e instanceof Error ? e.name')
  })
})

describe('Task 29 · demo-requests route drops the reference and the raw error object', () => {
  const src = read('src/app/api/demo-requests/route.ts')
  const calls = consoleCalls(src)

  it('does not log the demo reference or the raw error payload', () => {
    for (const call of calls) {
      expect(call, call).not.toContain('${reference}')
      expect(call, call).not.toMatch(/console\.error\([^)]*,\s*error\s*\)/)
    }
  })

  it('logs a stable code + the error class only', () => {
    expect(src).toContain("'[demo-requests] persistence failed:'")
    expect(src).toContain("'[demo-requests] notification failed:'")
    expect(src).toContain('error instanceof Error ? error.name')
  })

  it('preserves the 503 persistence contract and the durable-success behaviour', () => {
    expect(src).toContain("status: 503")
    expect(src).toContain('{ ok: true, reference }')
  })
})

describe('Task 29 · paystack payment email-failure log stays PII-free', () => {
  const src = read('src/app/api/paystack/webhook/route.ts')

  it('the purchase email-failure log is a constant with no reference or email', () => {
    expect(src).toContain("console.error('[webhook] purchase email send failed — requesting retry')")
  })
})

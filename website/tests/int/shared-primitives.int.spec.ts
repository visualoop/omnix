import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const ui = (name: string) =>
  readFileSync(join(ROOT, `src/components/ui/${name}.tsx`), 'utf8')

const button = ui('button')
const select = ui('select')
const checkbox = ui('checkbox')
const textarea = ui('textarea')
const tooltip = ui('tooltip')

describe('Working Counter shared controls', () => {
  it('provides reusable input, label, field, and feedback primitives', () => {
    for (const file of ['input.tsx', 'label.tsx', 'field.tsx', 'alert.tsx']) {
      expect(
        existsSync(join(ROOT, 'src/components/ui', file)),
        `missing shared primitive ${file}`,
      ).toBe(true)
    }
  })

  it('makes primary controls touch-safe, rounded, and responsive to press', () => {
    expect(button).toContain('active:scale-[0.97]')
    expect(button).toContain('rounded-[var(--radius-pill)]')
    expect(button).not.toContain('transition-all')
    expect(select).toContain('h-11')
    expect(textarea).toContain('min-h-28')
    expect(checkbox).toContain('size-5')
  })

  it('uses semantic invalid and disabled states rather than colour alone', () => {
    expect(ui('input')).toContain('aria-invalid')
    expect(ui('input')).toContain('disabled:cursor-not-allowed')
    expect(ui('field')).toContain('aria-describedby')
    expect(ui('field')).toContain('role="alert"')
    expect(ui('alert')).toContain('role={resolvedRole}')
  })

  it('uses origin-aware, token-backed popovers with deliberate timing', () => {
    expect(select).toContain('var(--radix-select-content-transform-origin)')
    expect(select).not.toContain('--color-bg-muted')
    expect(tooltip).toContain('delayDuration = 450')
    expect(tooltip).toContain('skipDelayDuration={200}')
    expect(tooltip).toContain('var(--radix-tooltip-content-transform-origin)')
  })

  it('does not use transition-all in shared interactive primitives', () => {
    for (const file of [
      'button',
      'select',
      'checkbox',
      'textarea',
      'tabs',
      'accordion',
      'sheet',
      'tooltip',
    ]) {
      expect(ui(file), `${file}.tsx uses transition-all`).not.toContain('transition-all')
    }
  })
})

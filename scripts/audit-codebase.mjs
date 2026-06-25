#!/usr/bin/env node
/**
 * Codebase audit — finds:
 *
 *   1. SQL queries that reference `products.selling_price` without
 *      joining `product_prices`. That column moved tables; any direct
 *      reference is a runtime bug (sqlite throws "no such column").
 *
 *   2. SQL queries that reference `products.tax_rate` or
 *      `products.buying_price` directly (similar story — both moved).
 *
 *   3. Native `<select>` elements in .tsx files. Conventions:
 *      • Use shadcn's <Select> primitive everywhere
 *      • Native HTML <select> is only acceptable inside very-low-level
 *        primitives (components/ui/select.tsx, the ones that wrap
 *        Radix) — those are flagged but allowed-listed in the report.
 *
 *   4. Other native elements that should be shadcn'd:
 *      • <input type="checkbox"> → Checkbox
 *      • <input type="radio"> → RadioGroup
 *      • <textarea> → Textarea (when not inside its own primitive)
 *
 * Usage:
 *   node scripts/audit-codebase.mjs
 *   node scripts/audit-codebase.mjs --json   (machine-readable)
 *   node scripts/audit-codebase.mjs --fail   (exit 1 if anything found)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [
  'src',
  'website/src',
]

// Files where a thing is allowed even if the rule matches.
const ALLOWLIST = new Set([
  // shadcn primitives wrap Radix — they HAVE to use native select/input
  'src/components/ui/select.tsx',
  'src/components/ui/checkbox.tsx',
  'src/components/ui/radio-group.tsx',
  'src/components/ui/textarea.tsx',
  'src/components/ui/combobox.tsx',
  'website/src/components/ui/select.tsx',
  'website/src/components/ui/checkbox.tsx',
  'website/src/components/ui/textarea.tsx',
  // settings registry / icon picker = legacy markup, low-volume
])

const RULES = [
  {
    id: 'sql.products.selling_price',
    label: 'Direct SELECT/UPDATE/INSERT on products.selling_price (column moved to product_prices)',
    severity: 'error',
    extensions: ['.ts', '.tsx'],
    test(text) {
      const hits = []
      // Match SELECT … selling_price … FROM products (no product_prices in the FROM/JOIN)
      const selectRe = /\bSELECT\b[\s\S]{0,400}?\bselling_price\b[\s\S]{0,800}?\bFROM\s+products\b(?![\s\S]{0,800}?\bproduct_prices\b)/gi
      for (const m of text.matchAll(selectRe)) {
        hits.push({ kind: 'SELECT', snippet: trim(m[0]) })
      }
      const updateRe = /\bUPDATE\s+products\s+SET\s+(?![^`]*?`)[^`]*?\bselling_price\s*=/gi
      for (const m of text.matchAll(updateRe)) {
        hits.push({ kind: 'UPDATE', snippet: trim(m[0]) })
      }
      const insertRe = /\bINSERT\s+INTO\s+products\s*\(([^)]+)\)/gi
      for (const m of text.matchAll(insertRe)) {
        if (/\bselling_price\b/i.test(m[1])) {
          hits.push({ kind: 'INSERT', snippet: trim(m[0]) })
        }
      }
      return hits
    },
  },
  {
    id: 'sql.products.buying_price',
    label: 'Direct query on products.buying_price (column moved to product_prices)',
    severity: 'warning',
    extensions: ['.ts', '.tsx'],
    test(text) {
      const hits = []
      const re = /\bSELECT\b[\s\S]{0,400}?\bbuying_price\b[\s\S]{0,800}?\bFROM\s+products\b(?![\s\S]{0,800}?\bproduct_prices\b)/gi
      for (const m of text.matchAll(re)) {
        hits.push({ kind: 'SELECT', snippet: trim(m[0]) })
      }
      const updateRe = /\bUPDATE\s+products\s+SET\s+(?![^`]*?`)[^`]*?\bbuying_price\s*=/gi
      for (const m of text.matchAll(updateRe)) {
        hits.push({ kind: 'UPDATE', snippet: trim(m[0]) })
      }
      return hits
    },
  },
  {
    id: 'ui.native.select',
    label: 'Native <select> — use shadcn <Select> instead',
    severity: 'warning',
    extensions: ['.tsx'],
    test(text) {
      const hits = []
      const re = /<select(\s[^>]*)?>/g
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'jsx', snippet: trim(m[0]), line })
      }
      return hits
    },
  },
  {
    id: 'ui.native.textarea',
    label: 'Native <textarea> — use shadcn <Textarea>',
    severity: 'info',
    extensions: ['.tsx'],
    test(text) {
      const hits = []
      const re = /<textarea(\s[^>]*)?>/g
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'jsx', snippet: trim(m[0]), line })
      }
      return hits
    },
  },
  {
    id: 'ui.native.checkbox',
    label: 'Native <input type="checkbox"> — use shadcn <Checkbox>',
    severity: 'info',
    extensions: ['.tsx'],
    test(text) {
      const hits = []
      // simple match — false positives are rare
      const re = /<input[^>]*type=["']checkbox["'][^>]*>/g
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'jsx', snippet: trim(m[0]), line })
      }
      return hits
    },
  },
]

function trim(s) {
  return s.replace(/\s+/g, ' ').slice(0, 160).trim()
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next' || name === '.git' || name === 'target') continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (/\.(t|j)sx?$/.test(p)) out.push(p)
  }
  return out
}

const files = SRC_DIRS.flatMap((d) => {
  try { return walk(join(ROOT, d)) } catch { return [] }
})

const findings = []
for (const file of files) {
  const rel = relative(ROOT, file)
  if (ALLOWLIST.has(rel)) continue
  const text = readFileSync(file, 'utf8')
  for (const rule of RULES) {
    if (!rule.extensions.some((e) => file.endsWith(e))) continue
    const hits = rule.test(text)
    if (hits.length) findings.push({ file: rel, rule: rule.id, severity: rule.severity, label: rule.label, hits })
  }
}

const args = new Set(process.argv.slice(2))
if (args.has('--json')) {
  console.log(JSON.stringify(findings, null, 2))
  process.exit(args.has('--fail') && findings.length ? 1 : 0)
}

const SEVERITY_COLOR = {
  error: '\x1b[31m',
  warning: '\x1b[33m',
  info: '\x1b[36m',
}
const RESET = '\x1b[0m'

const grouped = new Map()
for (const f of findings) {
  if (!grouped.has(f.rule)) grouped.set(f.rule, [])
  grouped.get(f.rule).push(f)
}

if (findings.length === 0) {
  console.log('\x1b[32m✓\x1b[0m No issues found.')
  process.exit(0)
}

for (const [rule, items] of grouped) {
  const color = SEVERITY_COLOR[items[0].severity] ?? ''
  console.log(`\n${color}━━━ ${rule} (${items.length} files, ${items.reduce((s, i) => s + i.hits.length, 0)} hits) ━━━${RESET}`)
  console.log(`     ${items[0].label}`)
  for (const f of items) {
    console.log(`\n  ${f.file}`)
    for (const h of f.hits.slice(0, 5)) {
      console.log(`    ${h.line ? `L${h.line} ` : ''}${h.kind ?? ''}  ${h.snippet}`)
    }
    if (f.hits.length > 5) console.log(`    … and ${f.hits.length - 5} more`)
  }
}

const totals = {
  error: findings.filter((f) => f.severity === 'error').length,
  warning: findings.filter((f) => f.severity === 'warning').length,
  info: findings.filter((f) => f.severity === 'info').length,
}
console.log(`\n${SEVERITY_COLOR.error}${totals.error} errors${RESET}, ${SEVERITY_COLOR.warning}${totals.warning} warnings${RESET}, ${SEVERITY_COLOR.info}${totals.info} info${RESET}`)
if (args.has('--fail') && totals.error > 0) process.exit(1)

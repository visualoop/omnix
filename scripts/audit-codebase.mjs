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
  {
    id: 'sql.business.settings',
    label: "Reading business identity from settings table (use getBusinessProfile() / the business table — the settings 'business.*' keys are never written)",
    severity: 'error',
    extensions: ['.ts', '.tsx'],
    test(text) {
      const hits = []
      // Match: SELECT … FROM settings WHERE key = 'business.name' (or .phone/.address/.email)
      const re = /FROM\s+settings\s+WHERE\s+key\s*=\s*['"]business\.(name|phone|address|email)['"]/gi
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'SELECT', snippet: trim(m[0]), line })
      }
      // Match: key IN ('business.name', …) lists pulling identity from settings
      const inRe = /key\s+IN\s*\([^)]*['"]business\.name['"][^)]*\)/gi
      for (const m of text.matchAll(inRe)) {
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'SELECT-IN', snippet: trim(m[0]), line })
      }
      return hits
    },
  },
  {
    // Rule shipped in v0.28.7 after a native window.confirm() slipped
    // through in the licences page and Tauri v2 blocked it with an
    // "not allowed by acl" error. Every dialog goes through the
    // imperative confirm/prompt helpers in @/components/ui/confirm-dialog.
    id: 'ui.native.dialog',
    label: 'Native window.confirm / window.alert / window.prompt — use confirm({...}) / prompt({...}) from @/components/ui/confirm-dialog',
    severity: 'error',
    extensions: ['.ts', '.tsx'],
    test(text) {
      const hits = []
      const isCommentOrImport = (m) => {
        const lineStart = text.lastIndexOf('\n', m.index) + 1
        const lineEnd = text.indexOf('\n', m.index)
        const lineText = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
        return lineText.startsWith('*') || lineText.startsWith('//') || lineText.startsWith('import ')
      }
      // window.confirm(...), window.alert(...), window.prompt(...)
      const explicitRe = /\bwindow\s*\.\s*(confirm|alert|prompt)\s*\(/g
      for (const m of text.matchAll(explicitRe)) {
        if (isCommentOrImport(m)) continue
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: `window.${m[1]}`, snippet: trim(m[0]), line })
      }
      // Bare confirm("text") / alert("text") / prompt("text") — the
      // pattern that keeps sneaking in. Detected by:
      //   - not preceded by a word char (excludes 'await confirm', 'run confirm',
      //     'sandboxAutoConfirm', 'handleConfirm', function names, etc.)
      //   - first arg starts with a string literal (not a config object)
      const bareRe = /(?<![\w.])(?:confirm|alert|prompt)\s*\(\s*["'`]/g
      for (const m of text.matchAll(bareRe)) {
        if (isCommentOrImport(m)) continue
        const line = text.slice(0, m.index).split('\n').length
        hits.push({ kind: 'bare-dialog', snippet: trim(m[0]), line })
      }
      return hits
    },
  },
  {
    // Deep-navigable pages must offer a back button so users can return
    // to the previous list / hub. Applied to every .tsx file under
    // src/pages/ that isn't a landing / hub / kiosk page.
    //
    // Rule: a page in src/pages/ that renders <h1> OR <PageHeader ...>
    // WITHOUT either (a) a <BackButton> or (b) a `back={...}` prop on
    // PageHeader is flagged. See scripts/add-back-buttons.mjs for the
    // auto-patcher — that same list of SKIP file names lives here.
    id: 'ui.page.back_button',
    label: 'Page missing a back button — deep-navigable pages must render <BackButton /> or <PageHeader back={...} />',
    severity: 'warn',
    extensions: ['.tsx'],
    test(text, filePath) {
      // Only under src/pages/
      if (!filePath.replace(/\\/g, '/').includes('/src/pages/')) return []
      // Skip landing / hub / kiosk pages — mirror scripts/add-back-buttons.mjs
      const name = filePath.split(/[\\/]/).pop() ?? ''
      const SKIP = new Set([
        'dashboard.tsx', 'login.tsx', 'customer-display.tsx', 'customer-display-queue.tsx',
        'setup.tsx', 'pos-overview.tsx', 'pos-sale.tsx', 'retail-dashboard.tsx',
        'hub-analytics.tsx', 'hub-banking.tsx', 'hub-inventory.tsx', 'hub-modules.tsx',
        'hub-people.tsx', 'hub-sales.tsx', 'reports-index.tsx', 'modules.tsx',
        'ai-workspace.tsx', 'license-activation.tsx', 'quick-add.tsx',
        'pharmacy.tsx', 'hospitality.tsx', 'hardware.tsx',
      ])
      if (SKIP.has(name)) return []
      const hits = []
      const hasBack = /<BackButton[\s/>]/.test(text) || /<PageHeader\b[\s\S]*?\bback=\{/.test(text)
      if (hasBack) return []
      // Only flag if the page actually renders an <h1> or <PageHeader>.
      const hasH1 = /^\s*<h1[\s>]/m.test(text) || /<PageHeader\b/.test(text)
      if (!hasH1) return []
      hits.push({ kind: 'no-back-button', snippet: name, line: 1 })
      return hits
    },
  },
]

/* ────────────────────────────────────────────────────────────────── *
 * Cross-file rules — run once over the whole tree, not file-by-file.
 *
 *   tauri.invoke.unknown    — invoke("foo") where Rust has no handler
 *                              registered. Catches silently-failing
 *                              command typos (e.g. "fingerprint" instead
 *                              of "get_machine_info").
 *
 *   sql.column.unknown      — explicit `table.column` references in JS
 *                              SQL templates where `column` isn't in the
 *                              schema map built from migrations. Catches
 *                              the kind of typo that hit the Patients
 *                              page (`prescriptions.issued_at` when the
 *                              column is `created_at`).
 * ────────────────────────────────────────────────────────────────── */

/** Parse the Rust invoke_handler list from src-tauri/src/lib.rs. */
function readRustCommands() {
  const path = join(ROOT, 'src-tauri/src/lib.rs')
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return new Set()
  }
  const set = new Set()
  // Match every `commands::name,` entry inside generate_handler![…].
  for (const m of text.matchAll(/commands::([a-z_][a-z0-9_]*)\s*,/g)) {
    set.add(m[1])
  }
  return set
}

/** Build a map of `table -> Set(column)` from every SQL migration file. */
function readSchemaMap() {
  const dir = join(ROOT, 'src-tauri/migrations')
  let entries
  try {
    entries = readdirSync(dir).sort()
  } catch {
    return new Map()
  }
  const tables = new Map()
  for (const name of entries) {
    if (!name.endsWith('.sql')) continue
    let sql = readFileSync(join(dir, name), 'utf8')
    // Strip line + block comments so we don't get column names like
    // "-- comment\n   subtotal" when CREATE TABLE has inline notes.
    sql = sql.replace(/--[^\n]*/g, '')
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '')
    // CREATE TABLE [IF NOT EXISTS] foo ( col1 …, col2 …, … )
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)["`]?\s*\(([^;]*?)\)\s*(?:WITHOUT\s+ROWID)?\s*;/gis)) {
      const table = m[1].toLowerCase()
      const body = m[2]
      const cols = tables.get(table) ?? new Set()
      // Each top-level comma-separated column entry — best-effort split
      // outside parentheses + skipping CHECK / FOREIGN / PRIMARY KEY rows.
      let depth = 0
      let buf = ''
      const lines = []
      for (const ch of body) {
        if (ch === '(') depth += 1
        else if (ch === ')') depth -= 1
        if (ch === ',' && depth === 0) {
          lines.push(buf.trim())
          buf = ''
        } else {
          buf += ch
        }
      }
      if (buf.trim()) lines.push(buf.trim())
      for (const line of lines) {
        if (/^(?:CONSTRAINT|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE|CHECK)\b/i.test(line)) continue
        const cm = line.match(/^["`]?([a-z_][a-z0-9_]*)["`]?\s/i)
        if (cm) cols.add(cm[1].toLowerCase())
      }
      tables.set(table, cols)
    }
    // ALTER TABLE foo ADD COLUMN [IF NOT EXISTS] col …
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+["`]?([a-z_][a-z0-9_]*)["`]?\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/gis)) {
      const table = m[1].toLowerCase()
      const col = m[2].toLowerCase()
      const cols = tables.get(table) ?? new Set()
      cols.add(col)
      tables.set(table, cols)
    }
  }
  return tables
}

function runCrossFileRules(files) {
  const findings = []
  const rustCommands = readRustCommands()
  const schema = readSchemaMap()

  // Tauri invoke validator — only check files that actually import
  // Tauri's invoke (`from "@tauri-apps/api/core"` or `tauri/api/core`).
  // The codebase also has a local AI-task dispatcher exported as
  // `invoke` from `services/ai/router.ts`; we ignore that one entirely.
  const invokeCalls = new Map() // command -> [{file, line, snippet}]
  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
    const rel = relative(ROOT, file)
    // Skip files in the website folder — those don't use Tauri.
    if (rel.startsWith('website/')) continue
    const text = readFileSync(file, 'utf8')
    // Quickly bail if this file doesn't import Tauri's invoke.
    if (!/@tauri-apps\/api\/core/.test(text)) continue
    // Match `invoke<...>("name"`, `invoke("name"`, and the cast form
    // `(invoke as …)("name"`.
    const re = /invoke(?:\s*<[^>]+>)?\s*\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi
    for (const m of text.matchAll(re)) {
      const cmd = m[1]
      const line = text.slice(0, m.index).split('\n').length
      const list = invokeCalls.get(cmd) ?? []
      list.push({ file: rel, line, snippet: trim(m[0]) })
      invokeCalls.set(cmd, list)
    }
    // Also catch the cast pattern `(invoke as …)("name", …)`.
    const castRe = /\binvoke\s+as\b[\s\S]{0,200}?\)\s*\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi
    for (const m of text.matchAll(castRe)) {
      const cmd = m[1]
      const line = text.slice(0, m.index).split('\n').length
      const list = invokeCalls.get(cmd) ?? []
      list.push({ file: rel, line, snippet: trim(m[0]) })
      invokeCalls.set(cmd, list)
    }
  }
  for (const [cmd, callers] of invokeCalls) {
    if (rustCommands.has(cmd)) continue
    // Group by file for the report
    const byFile = new Map()
    for (const c of callers) {
      const list = byFile.get(c.file) ?? []
      list.push({ kind: 'invoke', snippet: c.snippet, line: c.line })
      byFile.set(c.file, list)
    }
    for (const [file, hits] of byFile) {
      findings.push({
        file,
        rule: 'tauri.invoke.unknown',
        severity: 'error',
        label: `invoke("${cmd}") — Rust has no handler registered in src-tauri/src/lib.rs`,
        hits,
      })
    }
  }

  // SQL column validator — focused on `table.column` qualified references.
  // We don't try to parse arbitrary SQL; we only flag the explicit qualified
  // form (e.g. `prescriptions.issued_at`, `products.selling_price`) because
  // that's where typos hide. Unqualified refs in CTEs / joins are too noisy
  // to validate statically.
  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
    const rel = relative(ROOT, file)
    if (rel.startsWith('website/')) continue
    const text = readFileSync(file, 'utf8')
    // Only scan SQL template literals — and only ones that we can prove
    // are SQL because they're passed to query() / execute() / db.run().
    // Matching any backtick that happens to contain the word SELECT
    // false-positives on `<SelectItem>` JSX and Combobox prose.
    const sqlBlockRe = /\b(?:query|execute|run)\s*(?:<[^>]+>)?\s*\(\s*`([^`]*)`/gis
    for (const blockMatch of text.matchAll(sqlBlockRe)) {
      let block = blockMatch[1]
      const blockStart = (blockMatch.index ?? 0) + blockMatch[0].indexOf('`') + 1
      // Strip JS template interpolations like ${products.length} so we
      // don't lint TS expression syntax as if it were SQL.
      block = block.replace(/\$\{[^}]*\}/g, ' ')
      // Strip single-quoted SQL string literals — those often contain
      // dotted settings keys like 'business.kra_pin' or
      // 'local_licenses.active_key' that look like qualified refs.
      block = block.replace(/'(?:[^'\\]|\\.)*'/g, "''")
      // Find every `table.column` qualified reference.
      const qualRe = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi
      for (const m of block.matchAll(qualRe)) {
        const table = m[1].toLowerCase()
        const col = m[2].toLowerCase()
        // Skip CTE / aliased prefixes we won't know about (single-letter
        // alias is the convention — e.g. `p.id`, `c.name`). Validating
        // those would require parsing the FROM clause which we don't.
        if (table.length === 1) continue
        // Skip wildcards
        if (col === '*') continue
        const cols = schema.get(table)
        if (!cols) continue // unknown table — quiet (could be a view / alias)
        if (cols.has(col)) continue // valid column
        // Tolerate the SQLite ROWID virtual column
        if (col === 'rowid') continue
        const idxInText = blockStart + (m.index ?? 0)
        const line = text.slice(0, idxInText).split('\n').length
        findings.push({
          file: rel,
          rule: 'sql.column.unknown',
          severity: 'error',
          label: `SQL references ${table}.${col} but that column isn't in the schema`,
          hits: [{ kind: 'SQL', snippet: trim(`${table}.${col}`), line }],
        })
      }

      // Bonus pass: if the query has an unambiguous single-table FROM
      // (no JOINs, no aliases that aren't the table itself, no
      // sub-selects), also validate UNqualified column references
      // against that one table. Catches typos like MAX(issued_at)
      // inside `FROM prescriptions WHERE …` even though `issued_at`
      // has no table prefix.
      const fromMatch = block.match(/\bFROM\s+([a-z_][a-z0-9_]*)\b/i)
      const joinPresent = /\bJOIN\b/i.test(block)
      const subSelectPresent = /\bSELECT\b[\s\S]*\bSELECT\b/i.test(block)
      if (fromMatch && !joinPresent && !subSelectPresent) {
        const fromTable = fromMatch[1].toLowerCase()
        const cols = schema.get(fromTable)
        if (cols) {
          // Walk every `function(column)` or `WHERE column = …` ref.
          // We look for bare lowercase identifiers in positions where a
          // column is expected. Specifically: inside aggregate functions
          // (SUM/MAX/MIN/COUNT/AVG) or right after WHERE / AND / OR /
          // ORDER BY / GROUP BY.
          const candRe = /\b(?:SUM|MAX|MIN|COUNT|AVG|UPPER|LOWER|TRIM|COALESCE|CAST|date|datetime|julianday)\s*\(\s*([a-z_][a-z0-9_]*)\s*[,)]/gi
          for (const m of block.matchAll(candRe)) {
            const col = m[1].toLowerCase()
            if (col === 'rowid' || col === '*') continue
            // SQL keywords that can appear as function args
            if (['null', 'true', 'false', 'now'].includes(col)) continue
            // Also skip if `col` looks like an identifier with no schema
            // hit but might be a CTE alias or COALESCE'd value.
            if (cols.has(col)) continue
            const idxInText = blockStart + (m.index ?? 0)
            const line = text.slice(0, idxInText).split('\n').length
            findings.push({
              file: rel,
              rule: 'sql.column.unknown',
              severity: 'error',
              label: `SQL references column "${col}" (unqualified) but ${fromTable} has no such column`,
              hits: [{ kind: 'SQL', snippet: trim(`${fromTable}.${col}`), line }],
            })
          }
        }
      }
    }
  }

  return findings
}

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
    const hits = rule.test(text, file)
    if (hits.length) findings.push({ file: rel, rule: rule.id, severity: rule.severity, label: rule.label, hits })
  }
}

// Cross-file rules — Tauri invoke validator + SQL column-ref checker.
findings.push(...runCrossFileRules(files))

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

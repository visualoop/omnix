#!/usr/bin/env node
/**
 * audit-list-pages.mjs — Comprehensive audit of every page that renders a
 * list/table of records + every service that returns an array.
 *
 * For each page → service pair, reports:
 *   1. Does the SERVICE accept a `search` parameter?
 *   2. Does the service SQL include a LIMIT / OFFSET (paginated)?
 *   3. Does the PAGE render a search <Input>?
 *   4. Does the page render pagination UI (page numbers, next/prev, load-more)?
 *   5. Does the page do client-side .filter() on results? (bad — should push to SQL)
 *
 * Output: a table showing gaps so we can plan fixes systematically.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGES_DIR = "src/pages";
const SERVICES_DIR = "src/services";

// ─── Service catalogue ────────────────────────────────
function findServiceFns() {
  const out = [];
  const files = readdirSync(SERVICES_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"));
  for (const name of files) {
    const path = join(SERVICES_DIR, name);
    const src = readFileSync(path, "utf8");
    // Find every exported async function returning Promise<Array>.
    const fnRe = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)\s*:\s*Promise<(?:Array|[A-Z]\w*\[\])/g;
    for (const m of src.matchAll(fnRe)) {
      const fnName = m[1];
      const params = m[2];
      // Grab the function body (crude — from match end to next matching function)
      const start = m.index + m[0].length;
      const nextFn = src.slice(start).search(/\nexport\s+(async\s+)?function\b/);
      const end = nextFn === -1 ? src.length : start + nextFn;
      const body = src.slice(start, end);
      const hasSearch = /\bsearch\??\s*:/.test(params) || /\bq\??\s*:/.test(params);
      const hasLimit = /\bLIMIT\b/i.test(body);
      const hasWhereLike = /LIKE\s*\?/.test(body);
      out.push({
        name: fnName,
        file: name,
        hasSearch,
        hasLimit,
        hasWhereLike,
      });
    }
  }
  return out;
}

// ─── Page audit ───────────────────────────────────────
const PAGE_SKIP = new Set([
  "dashboard.tsx", "login.tsx", "setup.tsx",
  "pos-overview.tsx", "customer-display.tsx",
  "customer-display-queue.tsx", "quick-add.tsx",
]);

function auditPage(name) {
  const path = join(PAGES_DIR, name);
  const src = readFileSync(path, "utf8");

  // A "list page" is one that renders a table/list AND fetches via a service
  // that returns an array. Heuristic: has <table> or <ul> or renders .map(...
  // on an array state variable.
  const rendersList =
    /<table[\s>]/.test(src) ||
    /\.map\(\s*\(?[a-z]\w*\)?\s*=>\s*(?:<tr\b|<li\b|<div\b)/.test(src);
  if (!rendersList) return null;

  const hasSearchInput =
    /placeholder=(?:"|')[^"']*[Ss]earch/.test(src) ||
    /<Input[\s\S]*?type=(?:"|')search/.test(src);

  const hasPaginationUI =
    /Previous|Next\s*<Chev|(?:page|hasMore|loadMore)\s*[=:]/i.test(src) &&
    (/setPage|nextPage|prevPage|onNextPage|Load more/.test(src));

  const hasClientFilter =
    /\.filter\([\s\S]{0,150}?toLowerCase\(\)\.includes\(/.test(src);

  // Best-effort: what list-fn is imported from services/?
  const importedFns = new Set();
  for (const m of src.matchAll(/from\s+["']@\/services\/([^"']+)["']/g)) {
    // Peek at the same import line's braces
    const line = src.slice(src.lastIndexOf("\n", m.index), m.index + m[0].length);
    for (const name of line.matchAll(/\b(list|get|search)\w+/g)) {
      importedFns.add(name[0]);
    }
  }

  return {
    name,
    rendersList,
    hasSearchInput,
    hasPaginationUI,
    hasClientFilter,
    importedFns: Array.from(importedFns),
  };
}

// ─── Run ──────────────────────────────────────────────
const services = findServiceFns();
const svcByName = new Map(services.map((s) => [s.name, s]));

console.log("=".repeat(96));
console.log("SERVICE AUDIT — array-returning list functions");
console.log("=".repeat(96));
console.log("FILE                                     FN                            SEARCH  LIMIT   LIKE?");
for (const s of services.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(
    `${s.file.padEnd(40)} ${s.name.padEnd(30)} ${
      s.hasSearch ? "✓" : "·"
    }       ${s.hasLimit ? "✓" : "·"}       ${s.hasWhereLike ? "✓" : "·"}`,
  );
}

const pages = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".tsx") && !PAGE_SKIP.has(f));
const audited = pages.map(auditPage).filter(Boolean);

console.log();
console.log("=".repeat(96));
console.log("PAGE AUDIT — list-rendering pages: search UI + pagination UI + client-filter smell");
console.log("=".repeat(96));
console.log("PAGE                                     LIST-FNS                                SRCH  PAGE  FILT");

for (const p of audited.sort((a, b) => a.name.localeCompare(b.name))) {
  const svc = p.importedFns.filter((n) => svcByName.has(n)).slice(0, 3).join(",");
  console.log(
    `${p.name.padEnd(40)} ${(svc || "?").padEnd(40)} ${
      p.hasSearchInput ? "✓" : "·"
    }    ${p.hasPaginationUI ? "✓" : "·"}    ${p.hasClientFilter ? "✗" : "·"}`,
  );
}

// ─── Gap summary ──────────────────────────────────────
const missingSearch = audited.filter((p) => !p.hasSearchInput);
const missingPagination = audited.filter((p) => !p.hasPaginationUI);
const badFilter = audited.filter((p) => p.hasClientFilter);

console.log();
console.log("=".repeat(96));
console.log(`GAPS`);
console.log("=".repeat(96));
console.log(`Pages with NO search input          : ${missingSearch.length}`);
for (const p of missingSearch) console.log(`  ${p.name}`);
console.log();
console.log(`Pages with NO pagination UI         : ${missingPagination.length}`);
for (const p of missingPagination) console.log(`  ${p.name}`);
console.log();
console.log(`Pages doing client-side filtering   : ${badFilter.length}`);
for (const p of badFilter) console.log(`  ${p.name}  (should push to SQL)`);
console.log();
console.log(`Services with search param          : ${services.filter((s) => s.hasSearch).length} / ${services.length}`);
console.log(`Services with LIMIT clause          : ${services.filter((s) => s.hasLimit).length} / ${services.length}`);
console.log(`Services doing LIKE-based search    : ${services.filter((s) => s.hasWhereLike).length} / ${services.length}`);

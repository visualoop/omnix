#!/usr/bin/env node
/**
 * audit-routes.mjs — cross-reference every navigate() / <Link to="..."> /
 * <NavLink to="..."> against the routes actually registered in App.tsx.
 *
 * Reports:
 *  • Broken targets  — navigation to paths that don't exist
 *  • Orphan routes   — routes registered but nothing navigates to them
 *
 * Dynamic-param routes (`/foo/:id`) are matched against static prefixes
 * before the first `:`. Query-string / hash suffixes are stripped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(tsx?|jsx?)$/.test(e)) files.push(p);
  }
  return files;
}

const files = walk(SRC);

// 1. Extract every `<Route path="..." />` from App.tsx (and any Layout files).
const routes = new Set();
const appSrc = readFileSync(join(SRC, "App.tsx"), "utf8");
for (const m of appSrc.matchAll(/<Route[^>]*\spath=["']([^"']+)["']/g)) {
  routes.add(m[1]);
}
// Include nested SettingsLayout children if declared elsewhere
for (const f of files) {
  if (!/Layout|routes\.tsx$/.test(f)) continue;
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/<Route[^>]*\spath=["']([^"']+)["']/g)) {
    routes.add(m[1]);
  }
}

// Normalise: strip trailing slashes, split into static prefix
const norm = (p) => p.replace(/\/+$/, "") || "/";
const staticPrefix = (p) => {
  const i = p.indexOf(":");
  return i < 0 ? p : p.slice(0, i).replace(/\/+$/, "");
};

const registered = new Set([...routes].map(norm));
const staticRegistered = new Set([...registered].map(staticPrefix));

// 2. Extract every navigation target from anywhere in src/
const targets = new Map(); // path -> Array<file>

for (const f of files) {
  const src = readFileSync(f, "utf8");
  // navigate("...") or navigate(`...`)
  for (const m of src.matchAll(/\bnavigate\s*\(\s*["'`]([^"'`?#]+)/g)) {
    if (!m[1].startsWith("/")) continue;
    const key = norm(m[1]);
    if (!targets.has(key)) targets.set(key, []);
    targets.get(key).push(f.replace(SRC + "/", ""));
  }
  // to="/..."
  for (const m of src.matchAll(/\bto=["']([^"'?#]+)/g)) {
    if (!m[1].startsWith("/")) continue;
    const key = norm(m[1]);
    if (!targets.has(key)) targets.set(key, []);
    targets.get(key).push(f.replace(SRC + "/", ""));
  }
}

// 3. Broken targets — used but not registered (allow static-prefix match for /:id)
const broken = [];
for (const [t, sources] of targets) {
  if (registered.has(t)) continue;
  let matched = false;
  for (const r of registered) {
    const sp = staticPrefix(r);
    if (sp && t.startsWith(sp + "/")) { matched = true; break; }
    if (sp && t === sp) { matched = true; break; }
  }
  if (!matched) broken.push({ path: t, sources: [...new Set(sources)] });
}

// 4. Orphan routes — registered but nothing navigates to them
const orphans = [];
const dynamicPrefixes = new Set([...registered].map(staticPrefix));
for (const r of registered) {
  const sp = staticPrefix(r);
  if (!sp) continue;
  // Check if any target starts with sp
  let referenced = false;
  for (const t of targets.keys()) {
    if (t === sp || t.startsWith(sp + "/")) { referenced = true; break; }
  }
  if (!referenced) orphans.push(r);
}

console.log("\naudit-routes\n");
console.log(`  Registered routes  : ${registered.size}`);
console.log(`  Navigation targets : ${targets.size}`);
console.log(`  Broken targets     : ${broken.length}`);
console.log(`  Orphan routes      : ${orphans.length}\n`);

if (broken.length) {
  console.log("── Broken navigation targets (path used, no route matches) ──\n");
  for (const b of broken.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${b.path}`);
    for (const s of b.sources) console.log(`      from ${s}`);
  }
  console.log();
}
if (orphans.length) {
  console.log("── Orphan routes (registered, no navigate() / <Link>) ──\n");
  for (const o of orphans.sort()) console.log(`  ${o}`);
  console.log();
}

process.exit(broken.length ? 1 : 0);

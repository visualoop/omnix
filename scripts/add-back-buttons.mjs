#!/usr/bin/env node
/**
 * add-back-buttons.mjs — Sweeps every page under src/pages/ and:
 *
 *   1. Reports which pages lack a back-button affordance
 *   2. Optionally auto-injects one (either <BackButton /> or `back` prop on <PageHeader>)
 *
 * Usage:
 *   node scripts/add-back-buttons.mjs              # audit only
 *   node scripts/add-back-buttons.mjs --apply      # apply patches
 *
 * Rules:
 *   - Skip landing pages (dashboard, login, customer-display, setup, POS overview,
 *     retail-dashboard, hub-*, ai-workspace) — these are terminal / landing screens.
 *   - Pages using <PageHeader ...> without a `back={...}` prop → inject
 *     back={{ fallback: "<parent-route>" }}
 *   - Pages with raw <h1> at the top of the JSX → insert <BackButton /> above it.
 *
 * Fallback is derived from the file name: e.g. "product-detail.tsx" → "/inventory".
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGES_DIR = "src/pages";

// Pages that are terminal / hub / landing — don't need a back button.
const SKIP = new Set([
  "dashboard.tsx",
  "login.tsx",
  "customer-display.tsx",
  "customer-display-queue.tsx",
  "setup.tsx",
  "pos-overview.tsx",
  "pos-sale.tsx",
  "retail-dashboard.tsx",
  "hub-analytics.tsx",
  "hub-banking.tsx",
  "hub-inventory.tsx",
  "hub-modules.tsx",
  "hub-people.tsx",
  "hub-sales.tsx",
  "hub-modules.tsx",
  "reports-index.tsx",
  "modules.tsx",
  "ai-workspace.tsx",
  "license-activation.tsx",
  "quick-add.tsx",
  "pharmacy.tsx",       // hub for pharmacy
  "hospitality.tsx",    // hub for hospitality
  "hardware.tsx",       // hub for hardware
]);

// Route-to-parent map for deriving fallback URLs.
const FALLBACK_MAP = [
  { pattern: /^product-detail/, fallback: "/inventory" },
  { pattern: /^customer-detail/, fallback: "/customers" },
  { pattern: /^supplier-detail/, fallback: "/suppliers" },
  { pattern: /^employee-detail/, fallback: "/employees" },
  { pattern: /^banking-detail/, fallback: "/banking" },
  { pattern: /^bank-reconciliation/, fallback: "/banking" },
  { pattern: /^branch-detail/, fallback: "/branches" },
  { pattern: /^invoice-detail/, fallback: "/invoicing" },
  { pattern: /^invoice-new/, fallback: "/invoicing" },
  { pattern: /^sale-detail/, fallback: "/sales-history" },
  { pattern: /^patient-profile/, fallback: "/patients" },
  { pattern: /^stock-transfer/, fallback: "/stock-transfers" },
  { pattern: /^settings-/, fallback: "/settings" },
  // Files that live at /settings/* but don't start with "settings-":
  { pattern: /^currencies|^peripherals|^backup|^cloud-backup|^audit|^license|^network-settings|^payment-settings|^insurance-settings|^etims-settings/, fallback: "/settings" },
  { pattern: /^reservations/, fallback: "/hospitality" },
  { pattern: /^kitchen-display/, fallback: "/hospitality" },
  { pattern: /^room-status/, fallback: "/hospitality" },
  { pattern: /^recalls/, fallback: "/pharmacy" },
  { pattern: /^refills/, fallback: "/pharmacy" },
  { pattern: /^doctors/, fallback: "/pharmacy" },
  { pattern: /^controlled-register/, fallback: "/pharmacy" },
  { pattern: /^cold-chain/, fallback: "/pharmacy" },
  { pattern: /^claims/, fallback: "/pharmacy" },
  { pattern: /^amr-report/, fallback: "/reports" },
  { pattern: /^wastage-report/, fallback: "/reports" },
  { pattern: /^tips-report/, fallback: "/reports" },
  { pattern: /^stock-aging/, fallback: "/reports" },
  { pattern: /^inventory-reports/, fallback: "/reports" },
  { pattern: /^zreport/, fallback: "/reports" },
  { pattern: /^vat-report/, fallback: "/reports" },
  { pattern: /^analytics/, fallback: "/reports" },
  { pattern: /^trial-balance|balance-sheet|chart-of-accounts|cash-flow|period-close|fixed-assets/, fallback: "/reports" },
  { pattern: /^reorder-suggestions/, fallback: "/inventory" },
  { pattern: /^stock-take/, fallback: "/inventory" },
  { pattern: /^expiry/, fallback: "/inventory" },
  { pattern: /^stock\.tsx/, fallback: "/inventory" },
  { pattern: /^categories/, fallback: "/inventory" },
  { pattern: /^import-products/, fallback: "/inventory" },
  { pattern: /^retail-/, fallback: "/retail" },
  { pattern: /^follow-ups/, fallback: "/customers" },
  { pattern: /^sales-targets/, fallback: "/people" },
  { pattern: /^approvals/, fallback: "/" },
  { pattern: /^debit-notes/, fallback: "/suppliers" },
  { pattern: /^deliveries/, fallback: "/sales-history" },
  { pattern: /^anomalies/, fallback: "/reports" },
  { pattern: /^platform-pages/, fallback: "/" },
  { pattern: /^notifications/, fallback: "/" },
  { pattern: /^data-quality/, fallback: "/" },
  { pattern: /^etims/, fallback: "/reports" },
  { pattern: /^payroll/, fallback: "/people" },
  { pattern: /^leave/, fallback: "/people" },
  { pattern: /^attendance/, fallback: "/people" },
  { pattern: /^petty-cash/, fallback: "/banking" },
  { pattern: /^expenses/, fallback: "/banking" },
  { pattern: /^pnl/, fallback: "/reports" },
  { pattern: /^cash-register/, fallback: "/" },
  { pattern: /^purchase-orders/, fallback: "/suppliers" },
  { pattern: /^returns/, fallback: "/sales-history" },
  { pattern: /^recurring-invoices/, fallback: "/invoicing" },
];

function fallbackFor(name) {
  const m = FALLBACK_MAP.find((r) => r.pattern.test(name));
  return m?.fallback ?? "/";
}

function needsBackButton(src) {
  // Already has one via <BackButton> import? Skip.
  if (/<BackButton[\s/>]/.test(src)) return false;
  // Uses <PageHeader> but no `back` prop? Needs patching.
  if (/<PageHeader\b/.test(src) && !/\bback=\{/.test(src)) return "pageheader";
  // Has a plain <h1> in the JSX? Needs a BackButton inserted.
  if (/^\s*<h1[\s>]/m.test(src)) return "h1";
  return false;
}

function patchPageHeader(src, fallback) {
  // Insert `back={{ fallback: '<x>' }}` after the opening <PageHeader tag.
  return src.replace(
    /<PageHeader\b/,
    `<PageHeader\n        back={{ fallback: "${fallback}" }}`,
  );
}

function patchH1(src, fallback) {
  // Ensure BackButton import exists.
  let updated = src;
  if (!/from ["']@\/components\/ui\/back-button["']/.test(updated)) {
    // Insert import after the first import block.
    updated = updated.replace(
      /(import[\s\S]*?from ["'][^"']+["'];\s*)+/,
      (m) => `${m}import { BackButton } from "@/components/ui/back-button";\n`,
    );
  }
  // Insert <BackButton fallback="X" /> above the first <h1>.
  updated = updated.replace(
    /^(\s*)<h1\b/m,
    `$1<BackButton fallback="${fallback}" />\n$1<h1`,
  );
  return updated;
}

const apply = process.argv.includes("--apply");
const files = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".tsx"));

const missing = [];
const patched = [];

for (const name of files) {
  if (SKIP.has(name)) continue;
  const path = join(PAGES_DIR, name);
  const src = readFileSync(path, "utf8");
  const kind = needsBackButton(src);
  if (!kind) continue;

  const fb = fallbackFor(name);
  missing.push({ name, kind, fallback: fb });

  if (apply) {
    const updated = kind === "pageheader" ? patchPageHeader(src, fb) : patchH1(src, fb);
    writeFileSync(path, updated);
    patched.push(name);
  }
}

console.log(`\nPages needing a back button: ${missing.length}`);
for (const m of missing) {
  console.log(`  ${m.kind === "pageheader" ? "PH" : "H1"}  ${m.name}  →  fallback ${m.fallback}`);
}
if (apply) {
  console.log(`\nPatched ${patched.length} page(s).`);
} else {
  console.log(`\nRun with --apply to actually patch.`);
}

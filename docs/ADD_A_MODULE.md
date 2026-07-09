# Adding a Module to Omnix — Definitive Checklist

Omnix is built to host trade modules (Dawa, Retail, Hardware & Equipment,
Hospitality, and future ones like Salon). Core is module-ready: most
extension points are **data-driven** (permissions, hub tabs, theming,
sidebar, website). The rest are **type-safe manual edits** — TypeScript's
exhaustive `switch`es will refuse to compile until every arm is handled, so
this list is a map, not a minefield.

Work top-to-bottom. Each `⚠️` item is a compile-time-enforced touch point.

## 1. Backend / data
- [ ] `src-tauri/migrations/NNN_<module>.sql` — module tables. Register in
      `src-tauri/src/lib.rs` (`Migration { version, description, sql, kind }`).
- [ ] Services in `src/services/<module>.ts` (query/execute/transaction from
      `@/lib/db`; `crypto.randomUUID()`; permission-gate mutations).

## 2. Module registry ⚠️
- [ ] `src/stores/active-module.ts` — add id to the `ModuleId` union **and**
      an entry to `MODULE_DEFINITIONS` (name, shortName, tagline, status,
      `setupPlaceholders`). The setup wizard reads this automatically.

## 3. Variant system ⚠️ (`src/lib/variant.ts`)
- [ ] `VARIANTS` array
- [ ] `modulesAllowedForVariant` (usually `["core", "<module>"]`)
- [ ] `variantName`, `variantTagline`, `variantAccent`, `variantLicensePrefix`
- [ ] `ALL_LICENSE_PREFIXES` + `variantFromLicenseKey`
- [ ] Update `tests/variant.spec.ts` (asserts names + tagline/accent presence)

## 4. Permissions (`src/lib/permissions.ts`, `src/services/rbac.ts`)
- [ ] Add keys to the `Permission` union
- [ ] Add to the flat "all permissions" + owner/manager role grant arrays
- [ ] Add to `PERMISSION_CATALOG` (key, label, group, risk) — drives the RBAC UI
- [ ] If a new key prefix: `rbac.ts` `groupFor()` prefix mapping

## 5. Navigation + branding
- [ ] `src/components/layout/sidebar.tsx` — add `MODULE_NAV_ENTRIES[id]`
      (`to`, `icon`, `label`, `permissions`)
- [ ] `src/components/module-logos.tsx` — add a `ModuleLogo` case
- [ ] `src/lib/module-features.ts` — register the module's routes if used for
      feature gating

## 6. Hub + routing
- [ ] `src/pages/hub-modules.tsx` — a `<XHubPage>` using `HubLayout` with a
      data-driven `tabs=[…]` array (id, label, icon, component, permission)
- [ ] `src/App.tsx` — import the hub + `<Route path="/<module>">` and any
      standalone child routes

## 7. Theming (optional but recommended)
- [ ] Pick a default palette for the variant (existing palettes live in
      `src/stores/theme.ts` + `src/index.css`). Add a new `[data-theme="…"]`
      block + register in `THEMES` only if none fit.
      _(e.g. Salon/Spa → `peach` or `blossom`.)_

## 8. Cross-cutting capabilities (reuse, don't rebuild)
- [ ] Serialized units / warranty / repairs → gate on
      `moduleTracksSerials()` in `src/lib/capabilities.ts`, not the module id.
- [ ] Non-stock sale lines (services) → reuse the `completeSale` menu-item
      path rather than adding a parallel checkout.

## 9. Branded build (only for a dedicated installer)
- [ ] `vite.config.ts` — add to `validVariants`
- [ ] `src-tauri/tauri.<variant>.conf.json` — window title + productName
- [ ] CI matrix entry (build workflow)

## 10. Marketing website (`website/`)
- [ ] `website/src/config/trade-landings.ts` — hero + features + CTA
- [ ] `website/src/lib/license-modules.ts` — pricing/licence entry
- [ ] `website/src/lib/modules-seed.ts` — module directory entry
      (the `modules/[slug]` page renders from this data)

## 11. Verify (the gate — every release)
- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run`
- [ ] `node scripts/audit-codebase.mjs` (0 errors)
- [ ] `cd website && npx next build`
- [ ] README module table + version bump + `git tag`

---
**Rule of thumb:** if you're adding a *shop type* (minimart, electronics,
boutique) it's usually Retail + a capability toggle, **not** a new module.
Add a module only when the data model + workflow are genuinely different
(Pharmacy, Hospitality, Salon).

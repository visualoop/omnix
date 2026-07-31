# Post-v1 Parallel Execution Contract

**Baseline:** `74ec2cd803a1435da1418dd4f4608f5b585a2cef` (`v0.72.4` release commit)  
**Integration branch:** `program/mobile-mesh-integration`  
**Worktree root:** `/home/ubuntu/workspace/omnix-worktrees`  
**Status:** Active implementation contract

This contract coordinates the responsive application, Android client, read-only browser companion, secure branch API, offline synchronization, Private Mesh, East African market support, and release work. It supersedes conflicting scope statements in older plans.

## 1. Binding product decisions

1. Android is the only native mobile target in this program. Do not generate or ship iOS projects.
2. The Android app includes almost all permission-appropriate operations and reports, but excludes business/system Settings.
3. Android Profile includes identity, role, permissions, assigned branches, active branch, security, device, sync, mesh, version, and sign-out controls.
4. Mobile POS is a purpose-built phone/tablet composition, not a compressed desktop workspace.
5. The browser companion is strictly read-only. Its initial supported network is the branch LAN. Remote browser access requires a separately reviewed outbound gateway.
6. Browser read-only enforcement is server-side. Hiding buttons is not a security boundary.
7. Windows and Android embed WireGuard as Omnix Private Mesh. Customers do not need a WireGuard account or separate GUI application.
8. Current arbitrary remote SQL and permissive CORS are not production security boundaries. Mobile/web access uses typed commands and bounded read projections.
9. Switching the active branch changes the entire operational context. All-branches is a read-only manager analytics context.
10. Supported launch markets are Kenya, Uganda, Tanzania, and Rwanda only. Other internal profiles may remain hidden for future use.
11. Country selection drives KES/UGX/TZS/RWF, locale, tax terminology, phone/address/tax-ID placeholders, payments, receipts, PDFs, reports, and compliance gating.
12. The website must index materially useful KE/UG/TZ/RW market pages and show KES/UGX/TZS/RWF prices respectively.
13. Core business operation remains customer-owned, local SQLite, offline-first, and usable after optional annual services lapse.
14. No agent commits, pushes, rebases, merges, installs dependencies, or modifies production infrastructure without coordinator/user authorization.

## 2. Worktrees and exclusive ownership

| Worktree | Branch | Exclusive ownership |
| --- | --- | --- |
| `integration` | `program/mobile-mesh-integration` | Shared registries, dependency/config integration, merge control, global validation |
| `responsive-foundation` | `feat/responsive-foundation-branch` | Layout shell, responsive primitives, branch administration/switching UX |
| `android-platform` | `feat/android-platform-profile` | Android shell, platform adapters, Profile/Home/navigation, Android native plugin leaf files |
| `read-only-web` | `feat/read-only-web` | Browser runtime, read-only route surface, bounded report projection leaf modules and tests |
| `mobile-pos` | `feat/mobile-pos` | POS adaptive composition, cart/payment/customer/quantity/scan UI and tests |
| `mobile-core` | `feat/mobile-core-country` | Core/people/finance/report mobile adaptations and core country-format cleanup |
| `mobile-verticals` | `feat/mobile-verticals` | Dawa/Retail/Hardware/Hospitality/Salon mobile adaptations and vertical country-format cleanup |
| `command-auth` | `feat/typed-command-auth` | Typed command/read contracts, sessions, authorization, remote SQL containment, security tests |
| `sync-mesh` | `feat/sync-private-mesh` | Sync schema/engine, outbox/inbox, recovery, mesh service and WireGuard leaf modules |
| `website-release` | `feat/east-africa-website-release` | Website KE/UG/TZ/RW SEO/pricing and release workflow leaf modules/tests |

## 3. Coordinator-owned choke files

Worker worktrees must not modify these files. They create leaf modules and report the exact integration addition required.

```text
package.json
pnpm-lock.yaml
src/App.tsx
src/main.tsx
src-tauri/Cargo.toml
src-tauri/Cargo.lock
src-tauri/src/lib.rs
src-tauri/tauri.conf.json
src-tauri/capabilities/default.json
.github/workflows/ci.yml
```

The coordinator may delegate one choke file temporarily, but must record the delegation here before edits begin.

## 4. Disjoint worker ownership

### Responsive foundation

Owns:

```text
src/components/layout/**
src/components/responsive/**
src/components/ui/*responsive*
src/hooks/use-form-factor.ts
src/pages/branches.tsx
src/pages/branch-detail.tsx
src/stores/active-branch.ts
```

Must preserve desktop density while adding phone/tablet behavior. Branch cards separate **Work in this branch**, **View performance**, and **Edit details**. The active context is always visible.

### Android platform

Owns new leaf paths:

```text
src/mobile/**
src/platform/**
src/pages/mobile-*.tsx
src/components/mobile/**
src-tauri/gen/android/** (after coordinator-approved initialization)
src-tauri/mobile/**
```

Do not edit shared router or Cargo registration files. Android excludes full Settings.

### Read-only web

Owns new leaf paths:

```text
src/web/**
src/pages/web-*.tsx
src/components/web/**
src-tauri/src/read_api/**
src-tauri/src/web_companion/**
```

Every browser endpoint must be allowlisted, bounded, branch-authorized, auditable, and incapable of mutation.

### Mobile POS

Owns:

```text
src/pages/pos-sale.tsx
src/components/pos/**
src/hooks/use-pos-*.ts
src/stores/*cart*.ts
```

Coordinate before changing shared payment services. Desktop remains three-pane; tablet becomes two-pane; phone uses search/scan, product feed, sticky cart summary, cart sheet, and full-screen payment.

### Mobile core

Owns core operational pages/components allocated in its branch status report. It may replace true hardcoded country assumptions only in those owned core files. It must not edit vertical pages.

### Mobile verticals

Owns Dawa, Retail, Hardware, Hospitality, and Salon pages/components. It may replace true hardcoded country assumptions only in those files.

### Command/auth

Owns new or dedicated Rust command/auth/read-projection modules and security tests. No inline SQL in command handlers. SQL belongs in dedicated database/query modules. The existing remote SQL routes must be disabled for non-legacy trusted-LAN operation before browser/mobile exposure.

### Sync/mesh

Owns new migrations and dedicated sync/mesh modules. Migration numbers must be reserved with the coordinator before creation. Private keys use DPAPI/Android Keystore, never ordinary SQLite settings. Bind application mesh endpoints narrowly.

### Website/release

Owns `website/**` and new workflow files, but not `.github/workflows/ci.yml` until coordinator integration. Only KE/UG/TZ/RW are visible launch markets. Display currency is separate from settlement currency.

## 5. Agent discipline

Each terminal can use up to four subagents, but only one may write at a time in a worktree.

1. Auditor: read-only inventory and risk map.
2. Implementer: sole writer.
3. Test agent: adds/runs targeted tests only after implementer yields.
4. Reviewer: read-only independent review; returns `PASS` or `NEEDS_CHANGES`.

Never let concurrent agents edit the same worktree. Never use `git add .`. Preserve hooks. Do not commit or push without explicit authorization.

## 6. Shared contracts

### Form factor

```ts
type FormFactor = "phone" | "tablet" | "desktop";
```

Use capability/form-factor composition, not scattered `window.innerWidth` checks. Touch capability and viewport width are separate signals.

### Route capability

```ts
interface RouteCapability {
  desktop: boolean;
  android: "full" | "read" | "hidden";
  web: "read" | "hidden";
  requiresHub: boolean;
  permissions: string[];
  modules?: string[];
}
```

### Branch context

Operational commands require an explicit branch ID validated against the authenticated user's assignments. Business-wide master data and all-branch analytics must be declared rather than inferred.

### Country context

```ts
type LaunchCountry = "KE" | "UG" | "TZ" | "RW";
type LaunchCurrency = "KES" | "UGX" | "TZS" | "RWF";
```

One business has one immutable base country/currency after transactions exist. Branch switching cannot change currency.

### Command envelope

```ts
interface CommandEnvelope<T> {
  commandId: string;
  commandType: string;
  nodeId: string;
  userId: string;
  branchId: string;
  expectedRevision?: number;
  issuedAt: string;
  payload: T;
}
```

Command IDs are idempotency keys. The authoritative branch hub validates session, node, branch, role, module, payload, revision, and licence before a transaction.

### Read-only web

Browser sessions receive a read-only claim. Only dedicated `GET`/query projection handlers are routable. The web runtime must not contain generic query/execute methods.

## 7. Integration sequence

```text
coordination contract
→ responsive primitives and shared DTO contracts
→ Android shell + read-only browser shell + typed auth foundation
→ POS/core/vertical route adaptations
→ sync/mesh + branch enforcement + country completion
→ website pricing/SEO + release integration
→ full validation
```

Feature work may proceed in parallel against frozen interfaces. Worker branches run targeted checks; only integration runs the full suite.

## 8. Required validation

Every worker reports commands and exact output. Relevant checks include:

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run <target>
cargo test <target>
node scripts/audit-codebase.mjs
pnpm exec vite build
cd website && pnpm exec vitest run <target>
cd website && pnpm exec next build
```

Integration adds responsive viewport, Android, branch-isolation, read-only web, four-country, sync-fault, recovery, security, and release-artifact gates.

## 9. Definition of first implementation slice

The first parallel slice is complete when:

- Responsive form-factor and shell contracts exist with tests.
- Branch management exposes separate operational and edit actions.
- Android/web runtime boundaries are represented by leaf modules.
- Mobile POS composition is extracted without breaking desktop behavior.
- A pilot typed command/read projection demonstrates server-side branch authorization.
- Sync/mesh schemas and interfaces are reserved without exposing remote SQL.
- KE/UG/TZ/RW website currency types and selector tests fail correctly before implementation, then pass after it.

This document records coordination only. A worker's local edits are not integrated until independently reviewed and validated.

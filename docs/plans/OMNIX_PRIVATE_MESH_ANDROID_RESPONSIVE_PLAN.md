# Omnix Private Mesh, Multi-Branch Sync, Android, and Responsive Plan

**Status:** Proposed post-v1 platform program  
**Planning baseline:** `v0.72.4` / `74ec2cd`  
**Prepared:** 30 July 2026  
**Scope:** Desktop application, Rust backend, local SQLite architecture, Windows hub service, Android companion, responsive React UI, CI, security, recovery, and rollout.

## 1. Decision summary

Omnix can remain a customer-owned, one-time-purchase product while supporting multiple branches and remote mobile access. The target is not a hosted Omnix database. It is:

1. A Windows Omnix hub at HQ and, for transactional branches, a Windows hub at each branch.
2. A local SQLite database at every branch so sales continue with no internet.
3. An account-free **Omnix Private Mesh** using WireGuard for direct encrypted connectivity.
4. A business-owned application identity and mTLS layer above WireGuard.
5. An asynchronous Rust domain-event protocol that synchronizes branch databases.
6. A Tauri 2 Android companion that is read-only first and receives bounded offline writes only after sync correctness is proven.
7. A shared responsive system that makes the desktop application reflow safely at phone, tablet, laptop, and desktop widths, without promising that every desktop function belongs in the Android product.

The dependency order is mandatory:

```text
Scope decisions
      │
      ├── Security, Rust authorization, transaction and recovery hardening
      │        │
      │        └── Local outbox/inbox protocol → convergence proof → Private Mesh
      │                                                     │
      │                                                     ├── Branch pilot
      │                                                     └── Android reads → bounded writes
      │
      ├── Responsive primitives → route migration waves → full responsive claim
      │
      └── Desktop/mobile runtime split → Android project/CI → companion shell
```

Do not expose the current LAN API over the internet, even behind WireGuard, as the production sync design. `src-tauri/src/network/mod.rs` currently accepts arbitrary SQL through `/api/db/query` and `/api/db/execute`, uses permissive CORS, and authorizes a device token rather than the signed-in user, branch, role, module, and operation. That is a trusted-LAN prototype, not a WAN or mobile security boundary.

## 2. Scope decision required before implementation

`AGENTS.md` currently defines Omnix as desktop-only for v1, limits multi-device operation to the same LAN, and lists mobile as a non-goal. This plan is an intentional post-v1 scope change. Before implementation begins:

- Record an ADR approving Private Mesh and Android Companion as post-v1 targets.
- Keep Android as a companion, not a full desktop clone.
- Keep Windows HQ/branch machines as hubs; Android never acts as a hub.
- Preserve one-time software ownership. Customer internet, hardware, static IP, and optional relay infrastructure are customer operating costs.
- Keep the business-owned mesh identity independent of Omnix licensing and the marketing website.
- Decide whether the first CGNAT fallback is customer-owned infrastructure only or an Omnix opaque relay covered by maintenance/compliance support.
- Update `AGENTS.md` only after these product decisions are approved; do not silently contradict it in code.

## 3. Repository findings

### 3.1 Existing foundations to retain

Omnix already has useful building blocks:

- Branches, branch assignment, active branch state, and branch switching:
  - `src/services/branches.ts`
  - `src/stores/active-branch.ts`
  - `src/components/layout/branch-switcher.tsx`
- Standalone, master, and client modes:
  - `src/services/network.ts`
  - `src/pages/network-settings.tsx`
- A Rust/Axum LAN server, mDNS, pairing codes, tokens, and revocation:
  - `src-tauri/src/network/mod.rs`
  - `src-tauri/src/commands/network.rs`
- A Windows service process for keeping the current LAN server alive:
  - `src-tauri/src/bin/omnix-lan-service.rs`
- SQLite WAL tuning, a common database access layer, and transaction helper:
  - `src/lib/db.ts`
- An unwired offline HTTP-operation queue prototype:
  - `src/services/offline-queue.ts`
  - `src/hooks/use-offline-queue-drainer.ts`
  - There are currently no `enqueueOp` production callers. Its own INSERT/SELECT/UPDATE operations use the generic `query`/`execute` gateway, so client mode routes the queue itself to the unreachable master. It is therefore not locally durable during a master outage and must not be treated as a working sync foundation.
- UUID-based entities, audit features, RBAC, local licensing, backup commands, paginated list services, touch density, touch keypad, and touch text keyboard.
- Tauri's mobile entry point is present in Rust.

These foundations shorten the work, but the network and database abstractions cannot be promoted unchanged to WAN/mobile production.

### 3.2 Security and correctness gaps

- `/api/db/query` and `/api/db/execute` accept caller-provided SQL.
- `CorsLayer` allows any origin, headers, and methods.
- The device bearer token is the only remote API principal.
- The application server does not independently enforce user role, branch, module entitlement, or business operation.
- The token is stored as an application setting on the client and in recoverable form on the hub.
- `src/lib/db.ts::transaction` builds multi-statement SQL in JavaScript. Production replicated mutations need a Rust SQLx transaction that commits business data, audit, and outbox atomically.
- Client mode routes ordinary database access to the master. It does not provide branch-local operation when WAN or HQ is unavailable.
- The offline queue is currently unwired and not locally durable in client mode. Even if wired, replaying generic HTTP requests would not provide an ordered, signed, idempotent business event log. Replace it with an explicit local-only command/outbox storage boundary; do not migrate production sync by extending this queue.
- Current capabilities grant broad SQL, filesystem, HTTP, updater, process, and autostart permissions to all windows.
- `tauri.conf.json` currently has no restrictive CSP.

### 3.3 Responsive audit

A bounded static audit recorded **944 matching lines across 243 TSX files**; the same regex produces **1,062 individual occurrences** when counted with `rg -o`. This is a triage baseline, not a complete defect count. Reproduce and refresh it with `rg -n '(min-w-|max-w-|w-\[[0-9]|h-\[[0-9]|grid-cols-[2-9]|overflow-x-auto|<Table|<table|hidden (sm|md|lg):|(?:sm|md|lg|xl):hidden|fixed inset|sticky|100vh|minWidth|window\.innerWidth|useIsTouch)' src -g '*.tsx'`; use `rg -l ... | wc -l` for matching files, `rg -n ... | wc -l` for matching lines, and `rg -o ... | wc -l` for individual occurrences. Important classes of failure include:

- `AppShell` always renders a desktop sidebar and applies fixed `p-6` page padding.
- `Sidebar` supports only 200px and 52px desktop rails; there is no phone navigation sheet.
- `Topbar` has no constrained-width overflow or mobile priority model.
- `SettingsLayout` holds a 232–280px rail at every width.
- POS uses fixed 140px category and 340px cart rails.
- Banking and inventory sheets reach 600–800px fixed widths.
- Salon calendars require 640–840px minimum widths.
- Several KPI and form grids declare 3–5 columns without a one-column base.
- Many pages render raw tables without a narrow representation.
- Some overlays use viewport-fixed positioning without soft-keyboard/safe-area handling.

Existing strengths include `Drawer`, `Sheet`, responsive dialog examples, pagination, searchable comboboxes, `TouchKeypad`, `TouchTextKeyboard`, density modes, and the rules in `docs/UI_GUIDE.md`.

### 3.4 Android readiness

Tauri 2 supports Android, but this repository is not yet an Android application:

- There is no `src-tauri/gen/android` project.
- No Android build, emulator, AAB, signing, or Play workflow exists.
- `src/App.tsx` mounts desktop behavior before any platform split: F11 handling, desktop titlebar, updater, LAN autostart, alert scanner, offline queue timer, and authoritative background jobs.
- `src-tauri/src/lib.rs` registers updater, process, SQL, filesystem, and other desktop-oriented plugins before the desktop-only setup block.
- `src-tauri/capabilities/default.json` uses the desktop schema and broad permissions.
- The current route set and shell are desktop-oriented.
- Printing, cash drawers, weighing scales, Windows service control, backups, customer display windows, and updater behavior need platform-specific implementations or explicit mobile exclusions.

## 4. Target product architecture

```text
                         Business-owned Omnix mesh

              ┌──────────────── HQ ────────────────┐
              │ Windows Omnix hub                  │
              │ Local SQLite + outbox/inbox        │
              │ Mesh coordinator + snapshots       │
              │ WireGuard 10.87.0.1/32             │
              └───────────────┬────────────────────┘
                              │ encrypted direct tunnel
                ┌─────────────┼─────────────────┐
                │             │                 │
       ┌────────▼──────┐ ┌────▼──────────┐ ┌────▼─────────────┐
       │ Branch A hub  │ │ Branch B hub  │ │ Android companion │
       │ Local SQLite  │ │ Local SQLite  │ │ Scoped cache       │
       │ LAN tills     │ │ LAN tills     │ │ Read/outbox later  │
       │ 10.87.0.2/32  │ │ 10.87.0.3/32  │ │ 10.87.0.20/32     │
       └───────────────┘ └───────────────┘ └───────────────────┘
```

### 4.1 Hub topology

- HQ and branch hubs are Windows devices running a signed `omnix-mesh-service`.
- Cashier/client computers inside a branch use the branch hub over the LAN.
- A branch hub owns the branch's local commits and sync queue.
- HQ consolidates, distributes HQ-authoritative changes, stores peer cursors, and coordinates snapshots.
- Android is client-only and receives only the data allowed by its licence, user, role, and branch scope.
- Local business operation never waits for HQ, a relay, the marketing website, or the Android app.

### 4.2 Connectivity modes

**Direct mode:** WireGuard on the main hub has a public/static endpoint or usable IPv6. Only the VPN UDP port is reachable. Omnix ports bind to the WireGuard `/32`, not `0.0.0.0`.

**Same-site mode:** mDNS remains useful inside one LAN. It must not become the WAN discovery mechanism.

**CGNAT mode:** the setup wizard detects that inbound direct connections are unavailable. The customer chooses one explicit fallback:

1. Ask the ISP for a public/static IP.
2. Use a customer-owned VPS/relay.
3. Use a future Omnix opaque relay, if commercially approved.

No raw HTTP fallback, public database port, automatic UPnP exposure, or silent relay is allowed.

### 4.3 Layers of trust

WireGuard protects network transport, but the application still enforces:

- Business mesh certificate.
- Node certificate and node status.
- User session and authentication level.
- Branch scope.
- Role/permission.
- Licensed modules and branch/device allowance.
- Domain command and current entity revision.
- Protocol and schema compatibility.
- Audit context and idempotency key.

The mesh root belongs to the business. A licensing outage must not revoke business trust or prevent offline operation. Licensing supplies a separately signed entitlement document.

## 5. Offline synchronization design

### 5.1 Command and event boundary

Production business mutations move from unrestricted frontend SQL to typed Rust commands. A successful command performs one SQLx transaction:

```text
validate principal and entitlement
validate domain preconditions
apply business mutation
write audit record
append outbox event
commit
```

If any step fails, none commit.

### 5.2 Event envelope

A versioned envelope should include at least:

```text
event_id                 UUID v4
business_id              stable business identifier
origin_node_id           issuing hub
origin_branch_id         issuing branch
origin_sequence          monotonic per node
aggregate_type           sale, payment, stock_movement, product, etc.
aggregate_id             entity UUID
operation                domain event name
domain_version           payload version
protocol_version         transport contract
actor_user_id            authenticated actor
actor_role_snapshot      audit context
occurred_at               UTC ISO timestamp
hybrid_logical_clock     ordering aid, not sole authority
idempotency_key          original command key
previous_event_hash      origin-chain integrity
payload_hash             canonical payload hash
signature                node signature
payload                  domain data
```

Do not copy arbitrary SQLite rows or transport SQL statements. Events represent business facts and transitions.

### 5.3 Typed command and read-projection plane

LAN tills, desktop clients, and Android must not write replication events or submit SQL. They submit typed business commands to the authoritative hub for their active branch. The hub validates and applies the command, writes audit and outbox atomically, and returns a stable result.

Use versioned endpoints or equivalent Tauri/Rust command contracts such as:

```text
POST /command/v1/sales/complete
POST /command/v1/payments/record
POST /command/v1/stock/adjust
POST /command/v1/transfers/dispatch
POST /command/v1/transfers/receive
POST /command/v1/mobile/stock-count-line
GET  /query/v1/products?search=<bounded>&page=<n>
GET  /query/v1/stock?branch=<authorized>&search=<bounded>&page=<n>
GET  /query/v1/sales/<id>
```

Contract requirements:

- Typed request/response DTO and domain version; never SQL or table-shaped generic mutation payloads.
- Authenticated node plus user session, branch, role, module entitlement, authentication level, and command permission.
- Server-selected authoritative branch; never trust an arbitrary caller-supplied branch ID.
- Required command idempotency key. A retry returns the original result, event ID, aggregate revision, and audit correlation rather than applying twice.
- Optimistic revision/CAS for mutable aggregates and explicit domain transition checks.
- Command → SQLx business transaction → audit → outbox is one atomic boundary.
- Bounded read projections with server search, pagination, field authorization, and response limits.
- Android offline outbox stores typed commands. On reconnect it submits them to its authoritative branch hub; the hub, not the phone, issues mesh events.
- LAN clients route commands and reads to their branch hub. They do not fall back to arbitrary SQL when a command is unavailable.
- Revoked/expired user or node sessions fail closed. Retries after timeout are safe.

Add contract tests for partition, timeout after commit before response, duplicate command, stale revision, wrong branch, revoked role/node, and N/N-1 DTO compatibility. Raw-SQL retirement cannot complete until every required client workflow has a typed command/read replacement.

### 5.4 Provisional migrations

The current migration sequence ends at 098. Recheck before implementation and renumber if needed.

- `099_mesh_identity.sql`
  - business mesh metadata, node identity metadata, node status, mesh epoch; no private keys.
- `100_sync_event_log.sql`
  - outbox/event log, origin sequence, state, attempt metadata, hashes, signatures.
- `101_sync_inbox_versions.sql`
  - inbox idempotency, peer cursor, aggregate/domain revision.
- `102_sync_conflicts_dead_letters.sql`
  - visible conflicts, quarantined events, resolution audit.
- `103_sync_snapshots.sql`
  - snapshot manifests, watermarks, retained event range, install state.
- `104_command_idempotency.sql`
  - command keys, result references, expiry/retention rules.
- `105_mesh_security_hardening.sql`
  - certificate metadata, revocation, invitation hash, rotation history.

Application private keys live in Windows DPAPI/Credential Manager or Android Keystore-backed storage, never SQLite. Companion v1's WireGuard private key is owned by the official WireGuard client profile store, not the Omnix cache.

### 5.5 Replication protocol

The production protocol should use typed, bounded endpoints such as:

```text
POST /mesh/v1/enrol/request
POST /mesh/v1/enrol/complete
POST /mesh/v1/session
POST /mesh/v1/events/push
GET  /mesh/v1/events/pull?after=<cursor>&limit=<bounded>
POST /mesh/v1/events/ack
GET  /mesh/v1/snapshots/latest
GET  /mesh/v1/snapshots/<id>/chunks/<n>
POST /mesh/v1/repair/request
GET  /mesh/v1/health/authenticated
```

Requirements:

- mTLS and signed envelope verification.
- Bounded body, batch, decompressed payload, and query limits.
- Contiguous ACK cursors; never ACK across a gap.
- Retry-safe application through inbox uniqueness and command/event idempotency.
- Explicit N/N-1 protocol and schema compatibility.
- Compression limits and zip-bomb protection.
- Correlation ID across command, outbox, transport, inbox, apply, and audit.
- Snapshot checksums, signatures, schema version, business ID, branch scope, and event watermark.
- Redacted health responses; no unauthenticated business name/version disclosure.

### 5.6 Domain ownership and conflict policy

| Domain | Pilot direction | Authority and merge rule |
| --- | --- | --- |
| Products/categories | HQ → branches | HQ authoritative; branch proposals require approval later |
| Prices/tax configuration | HQ → branches | HQ authoritative, effective-dated |
| Sales/sale items | Branch → HQ | Append-only fact; duplicate blocked by event/command ID |
| Payments/refunds | Branch → HQ | Append-only; corrections are compensating events |
| Stock movements | Both, scoped | Append-only movements; never merge mutable quantity |
| Stock transfers | HQ/branches | Explicit requested → dispatched → received transitions |
| Customers | Optional pilot | UUID merge; explicit duplicate review for phone/email collisions |
| Purchase receiving | Later | Branch command with supplier/document idempotency |
| Users/RBAC | HQ → branch | Signed branch-scoped access bundles via secure credential provisioning; never ordinary business events |
| Appointments/bookings | Later | Revision/CAS and explicit workflow conflict handling |
| Equipment serial ownership | Later | Single-owner state machine; never generic last-write-wins |
| Payroll/accounting periods | Excluded initially | Separate finance authority/compliance review |
| Dawa patient/prescription | Excluded initially | Privacy and clinical domain review required |
| Controlled register | Excluded initially | Immutable regulatory workflow required |
| eTIMS/SHA credentials and authority | Excluded initially | Remain branch/device authority until dedicated design |
| API/provider secrets | Never replicated as events | Provision separately through secure local setup |

### 5.7 Branch-local authentication and authorization

A branch must authenticate and authorize staff while HQ is offline. HQ remains the policy authority, but each branch hub receives a signed, versioned access bundle through a secure provisioning channel rather than generic business events. The bundle contains only the branch's authorized users and includes user ID, username, Argon2 verifier/credential version, signed branch/role/module grants, issue/expiry times, and revocation generation. TOTP material, if offline TOTP is enabled, is encrypted specifically to the branch node and never placed in the ordinary event log.

Rules:

- Existing authorized staff can sign in and receive Rust-enforced permissions throughout the supported partition window; the pilot requires at least 72 hours.
- Access bundles and offline session leases have explicit maximum age. The UI shows when policy is stale and which owner operations are restricted.
- Local emergency revocation is immediate at that branch. HQ revocation takes effect when received; the business accepts that disconnected sites cannot receive an instant remote revocation.
- Password change, role/grant change, TOTP reset, branch transfer, and user deactivation increment credential/access generations and invalidate older sessions on receipt.
- New high-risk owner/admin operations may require a fresher signed policy than ordinary sales.
- A controlled local owner recovery procedure is documented and audited; it cannot silently mint HQ authority.
- Credential packages are encrypted at rest, excluded from support bundles, and scoped to one branch hub.

Pilot tests must prove offline login, lockout, session expiry/renewal, TOTP policy, branch assignment, Rust permission checks, local revoke, stale-policy UX, reconnect reconciliation, and password/grant propagation across a 72-hour partition.

### 5.8 Conflict handling

Conflicts must be visible work, not log messages. The UI must show:

- Entity and human identifier.
- Branch and actor.
- Local and incoming revisions.
- Why automatic application stopped.
- Allowed resolutions.
- Consequences of each resolution.
- Original event and resolution audit references.

Financial, stock, regulatory, booking, serial, and workflow conflicts must never use generic last-write-wins.

### 5.9 Snapshots, compaction, and disaster recovery

- Produce signed, encrypted, schema-versioned snapshots from a consistent SQLite backup.
- A new/rebuilt node installs a staged snapshot, verifies checksums, business and branch scope, runs `quick_check` and foreign-key validation, then replays the event tail.
- Keep event data until all required peers ACK past a snapshot watermark and retention policy permits compaction.
- Restored or promoted HQ receives a higher signed mesh epoch. Old HQ is fenced to prevent split brain.
- Enforce one active hub epoch per branch as well as one HQ epoch. A replacement branch hub either restores the original node keys, origin sequence, hash chain, ACK cursors, command-idempotency records, and unacknowledged outbox from a verified complete backup, or receives a new node ID and higher branch epoch. A new hub must never reuse an old node ID with reset sequence state.
- A stale old branch hub returning after replacement is denied by branch epoch before it can submit commands or events.
- If an old hub contains unacknowledged committed events, export them through an audited recovery tool that preserves original IDs, sequence, signatures, and idempotency keys; quarantine gaps/conflicts before apply. Do not reconnect both hubs to “let sync decide.”
- Snapshot/backup manifests include node/branch epoch, origin sequence, hash-chain head, peer ACK cursors, outbox range, and command-idempotency watermark.
- Local commits continue while transport is stopped; the outbox accumulates.
- Never delete an applied financial event to roll back. Emit a signed compensating event.

## 6. Omnix Private Mesh implementation

### 6.1 Integrated setup experience

Create **Settings → Private Mesh** with these flows:

**Create a business mesh**
- Generate business root and recovery material.
- Store the root/recovery material using a documented recovery ceremony.
- Create HQ node keys and WireGuard address.
- Test public reachability and classify NAT/CGNAT.
- Show direct, relay-required, or LAN-only state in plain language.

**Add a branch/device**
- Generate a short-lived, one-use invitation.
- Bind invitation to business, requested role, branch, node type, and expiry.
- Export an encrypted file or QR payload containing no reusable mesh-root secret.
- New node creates its own keypair and sends a CSR.
- HQ approves/signs the node certificate and records its scope.

**Operate the mesh**
- Node status, last handshake, certificate expiry, sync lag, cursor, pending events, dead letters, conflicts, snapshot state, and recovery readiness.
- Revoke, rotate, rename, pause, rebuild, and export a redacted support bundle.

### 6.2 Windows service

Refactor the concept in `omnix-lan-service.rs` into a signed `omnix-mesh-service`:

- No hard-coded `com.omnix.pos` path; resolve the actual Tauri application data directory/variant.
- Run WireGuard lifecycle and application sync transport with least privilege.
- Start automatically, survive user logout, and shut down cleanly.
- Bind application endpoints only to allowed WireGuard/LAN interfaces.
- Store keys through Windows protected storage.
- Upgrade atomically with service version compatibility checks.
- Never execute UI-supplied SQL.

### 6.3 Network acceptance criteria

- Packet capture shows encrypted traffic only.
- Port scans from public and ordinary LAN interfaces cannot reach mesh application endpoints.
- Revoked node cannot reconnect or continue pulling data.
- Cloned node identity is detected and fenced.
- Endpoint/IP change recovers without data loss.
- High latency, packet loss, relay failure, and long partitions never block local sale commits.
- Enrollment is throttled, one-use, expiring, replay-safe, and fully audited.

## 7. Responsive conversion

### 7.1 Definition of “fully responsive”

Every declared desktop route must remain operable at:

```text
320 × 568
375 × 667
414 × 896
768 × 1024
1024 × 768
1280 × 800
1440 × 900
```

The page must not create document-level horizontal scrolling. A domain canvas such as a calendar, recipe graph, or large comparison table may use an intentional horizontal region only when it is:

- Bounded inside the page.
- Keyboard focusable.
- Labelled for assistive technology.
- Accompanied by a visible scroll/alternate-view affordance.
- Replaced by a task-appropriate narrow view where possible.

Responsive does not mean shrinking desktop columns until they become unreadable. It means selecting the right representation for the task.

### 7.2 Responsive foundations

Build and test shared primitives before route edits:

- `ResponsiveAppFrame`
  - desktop rail, tablet compact rail, phone navigation sheet.
- `PageFrame`
  - safe width, responsive padding, safe areas, page scroll ownership.
- `ResponsivePageHeader`
  - title, context, primary action, and overflow actions with priority rules.
- `ActionCluster`
  - wraps or moves secondary actions into a menu without hiding the primary action.
- `FilterBar`
  - search-first desktop row; phone filter drawer with active-filter count.
- `AdaptiveDataView<T>`
  - desktop table and narrow priority-row/card representation from one model.
- `ResponsiveOverlay`
  - dialog on wide screens, bottom/full-height sheet on narrow screens, soft-keyboard aware.
- `FieldGrid`
  - one-column base; two/three columns only when minimum field width is preserved.
- `StatGrid`
  - 1/2/4 responsive layout with stable reading order.
- `ScrollableTabRail`
  - keyboard accessible, selected tab brought into view.
- Adaptive `PaginationBar`
  - compact previous/page/next on narrow widths.
- `PosWorkspace`
  - three-pane desktop, two-pane tablet, product/cart bottom-sheet phone structure.
- `AgendaCalendar`
  - list/day adapter for calendar domains on phones.

Refactor these shared roots first:

- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/topbar.tsx`
- `src/components/layout/settings-layout.tsx`
- `src/components/layout/window-titlebar.tsx`
- `src/components/layout/hub-layout.tsx`
- `src/components/layout/page-header.tsx`
- `src/components/data-list-shell.tsx`
- `src/components/shared/module-kit.tsx`
- `src/components/pagination-bar.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/sticky-table.tsx`
- `src/components/ui/combobox.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`

### 7.3 Shell behavior

**Desktop (≥1024):** retain the current Linear/Notion-grade rail, top bar, keyboard workflows, dense tables, and comfortable mode.

**Tablet (768–1023):** compact rail or overlay navigation depending on orientation; top-bar identity compresses; primary actions remain visible; tables use priority columns.

**Phone (<768):** no persistent rail. Use a top app bar plus navigation sheet. Branch/module selection moves into a labelled switcher. User, theme, notifications, and network details live in an account/status sheet. Page content owns one vertical scroll region.

Do not animate high-frequency keyboard navigation. Drawers and occasional sheets use short, reduced-motion-aware, origin-correct transitions.

### 7.4 Data table contract

Every data table and growing list remains searchable and paginated as required by `AGENTS.md`. Finite workflow collections and calendars use task-appropriate bounded views rather than artificial pagination.

- Wide: dense table, sortable columns, row actions.
- Medium: priority columns, optional detail expansion.
- Narrow: compact semantic rows/cards, preserving identity, state, one key metric, and primary action.
- Irreducible tables: focused horizontal viewport plus an accessible summary/detail alternative.
- Never simply hide critical columns without making their data available in row detail.
- Growing pickers remain searchable comboboxes; no plain select conversion.
- Empty states are procedural: explain what is missing and provide the permitted create/setup CTA rather than a dead empty table or picker.
- Preserve `docs/UI_GUIDE.md`'s stacked-row/card rule for narrow tables with many columns or numeric inputs.

### 7.5 Forms and overlays

- One-column form is the default at phone width.
- Do not preserve `grid-cols-2/3/4` without a one-column base.
- Primary action remains above the soft keyboard or in a keyboard-aware sticky footer.
- Every sheet uses `w-full` first, with a desktop maximum width only at a breakpoint.
- Dialogs that represent workflows become full-height sheets on phones.
- Respect `env(safe-area-inset-*)` and `100dvh`.
- Keep touch targets at least 44×44 CSS pixels in touch mode.
- No hover-only action or information.

### 7.6 Route migration waves

**Wave R0 — reference routes**
- Dashboard.
- Settings root and one nested settings route.
- One paginated list.
- One detail page.
- One form sheet.
- Use these to finalize primitives and test harness.

**Wave R1 — critical daily work**
- Login, setup, activation.
- POS overview, POS sale, payment, cash, quantity, customer picker, held sale, receipt.
- Inventory, customers, suppliers, sales history.
- Purchases, goods receipt, stock take, returns, stock transfers.

**Wave R2 — people, finance, compliance**
- Employees, attendance, leave, users, roles/groups.
- Banking, reconciliation, expenses, cash register, invoices, quotations.
- Claims, eTIMS queues, expiry, controlled logs and Dawa operational lists.

**Wave R3 — vertical workflows**
- Salon agenda/day calendar, booking and staff sheets.
- Hospitality rooms, bookings, kitchen, folios, menu, recipe editor.
- Hardware quotations, deliveries, accounts, equipment, service, rentals.
- Retail layby, special orders, shrinkage, pricing and variants.

**Wave R4 — specialist and administrative surfaces**
- Reports, charts, P&L, statements and exports.
- All settings pages.
- AI workspace.
- Customer display and kitchen display variants.
- Large canvases and remaining route inventory.

Each wave ends with desktop visual comparison, narrow geometry tests, keyboard/axe checks, and route-specific task smoke tests. Do not leave “temporary” desktop-only pages between waves without an explicit unsupported marker.

## 8. Android Companion

### 8.1 Product boundary

Android Companion is one Play application with module/role-aware features. It is not the Windows program placed inside a smaller WebView.

**First release:**

- Enrol and authenticate.
- Dashboard and branch summaries.
- Product, price, stock, customer, sales, order, appointment, room, and service lookup as permitted.
- Low-stock, expiry, operational, and approval alerts.
- Barcode scan for lookup.
- Last-known scoped cache with visible freshness and offline status.

**Second release candidates, one at a time:**

- Approvals.
- Stock-count lines.
- Goods-receiving drafts.
- Delivery/housekeeping/service status changes.
- Attendance/check-in.
- Appointment check-in.
- Kitchen bump/serve.

**Explicitly deferred:**

- Android hub/server.
- Full mobile POS.
- eTIMS signing authority.
- Final pharmacy dispense and controlled-register authority.
- SHA submission authority.
- Merchant payment secrets.
- Cash drawer, scale, kitchen/receipt printer control.
- Backup restore and database administration.
- Payroll/accounting authority.

### 8.2 Android WireGuard decision

**Companion v1 decision:** use the official WireGuard Android client with an Omnix-generated, revocable profile imported by QR/file. It is open source, requires no account, keeps VPN responsibility out of the first Companion AAB, and avoids claiming Android `VpnService` authority before a dedicated security and Play-policy review. Omnix detects tunnel reachability and explains how to enable or repair it, but cannot silently start another application's tunnel.

The profile is scoped to Omnix mesh `/32` routes only—never a default internet route—and contains a per-device key, endpoint, allowed IPs, keepalive policy, and no business/application secret. Rotation/revocation issues a new profile and fences the old node certificate. Setup must cover user consent, existing VPN/always-on VPN conflicts, endpoint/DNS changes, battery optimization, Doze, offline state, and profile removal after revocation.

A later ADR may approve an embedded Omnix VPN engine implemented through an audited Android `VpnService` Tauri/Kotlin plugin. That ADR must resolve WireGuard library packaging/licensing, Play VPN declarations and policy, foreground-service notification, always-on/lockdown behavior, route/DNS ownership, key storage, tunnel lifecycle across reboot/Doze/process death, coexistence with other VPNs, security review, and support responsibility. Do not begin embedded VPN work implicitly inside Companion feature work.

### 8.3 Runtime split

Refactor `src/App.tsx` before adding Android features:

```text
RuntimeBootstrap
  ├── DesktopApp
  │     ├── DesktopRouter
  │     ├── WindowTitlebar/F11
  │     ├── updater
  │     ├── LAN/mesh hub controls
  │     ├── authoritative background jobs
  │     └── desktop peripherals
  │
  └── CompanionApp
        ├── CompanionRouter
        ├── Android lifecycle/back handling
        ├── scoped cache/outbox
        ├── mobile connectivity
        └── camera/share/secure storage
```

The platform decision must occur before desktop hooks mount.

Create explicit service seams under `src/platform/`:

- `runtime.ts`
- `secure-storage.ts`
- `connectivity.ts`
- `lifecycle.ts`
- `updates.ts`
- `files.ts`
- `sharing.ts`
- `scanner.ts`
- `printing.ts`
- `peripherals.ts`
- `windows.ts`
- `discovery.ts`

Desktop and Android implementations satisfy the same narrow interfaces. Unsupported operations return typed capability results rather than failing at runtime.

### 8.4 Rust and Tauri platform split

- Run `tauri android init` only after the runtime split is in place.
- Add `src-tauri/tauri.android.conf.json` with Android-specific identifier, windows/webview behavior, security, bundle, and plugin configuration.
- Split capabilities into named desktop and Android files. Android must not inherit SQL execute/load, updater, process, autostart, arbitrary filesystem, window creation, LAN master, or peripheral permissions.
- Move desktop-only Cargo dependencies and plugin registration behind target cfg:
  - updater/process
  - autostart
  - tray icon
  - Windows service
  - desktop-only LAN/mesh hub components
  - desktop peripherals
- Confirm every retained plugin supports Android. Replace or remove unsupported plugins.
- Use Play Store updates on Android; do not use the desktop updater.
- Keep local Android data limited to scoped companion cache/outbox, not a copy of all business secrets.

### 8.5 Android native responsibilities

- Android Keystore-backed installation/node secret.
- Biometric/device credential gate where enabled.
- Android back navigation and predictive-back compatibility.
- Lifecycle/process-death restoration.
- ConnectivityManager network state and transport changes.
- WorkManager for bounded, idempotent companion-owned sync—not authoritative ERP timers.
- Camera permission and barcode scanning.
- Storage Access Framework/share sheet for permitted exports.
- Notification channels for approved operational alerts.
- Clear outcomes for reinstall, Keystore invalidation, device revocation, and app data restoration.

### 8.6 Android local data and security contract

- Store companion projections and pending typed commands in a Rust-managed local SQLite cache behind typed Tauri commands; do not grant JavaScript broad SQL load/select/execute capability.
- Encrypt sensitive cached payloads with an application data key wrapped by Android Keystore. Keep only minimal non-sensitive indexes in clear form if required for bounded search.
- Set Android backup/data-extraction rules to exclude cache, outbox, credentials, profiles, logs, and key material; Companion v1 defaults to `allowBackup=false` unless a reviewed encrypted restore design replaces it.
- Define per-domain cache retention. Purge scoped data and pending commands on logout, node revocation, business/branch re-enrolment, or failed integrity checks. Expired offline sessions may show a deliberately limited cached view but cannot submit commands.
- Apply `FLAG_SECURE`/recents redaction to screens containing sensitive customer, employee, clinical, payment, or security data as those domains are enabled. Avoid sensitive notification text.
- Redact crash reports and logs; never log command payloads, tokens, customer contacts, patient data, or mesh profiles.
- Document Keystore invalidation, device restore, reinstall, lost device, clock change, and remote-revocation behavior. Reinstall mints a new installation identity and requires re-enrolment.

### 8.7 Build and distribution

**Baseline decision:** target Android 9 / API 28 as the minimum for the first companion, subject to confirmation that the selected Tauri/plugins and current Play target-API requirements still support it at implementation time. If the minimum changes, update the device matrix and ADR together; do not leave the exit criteria inconsistent.

Pin and document:

- JDK version.
- Android SDK platform and build tools.
- NDK version.
- Gradle/Android plugin generated by the current Tauri CLI.
- Rust targets:
  - `aarch64-linux-android`
  - `armv7-linux-androideabi`
  - `i686-linux-android`
  - `x86_64-linux-android`
- Minimum API 28 decision (or its explicitly approved replacement) and the current Play target API.

CI must:

- Build/check all supported Rust ABIs.
- Build a debug APK for emulator smoke tests.
- Build a signed release AAB from protected CI secrets.
- Run `bundletool validate`.
- Inspect the merged manifest and capability set.
- Install/launch/rotate/background/restore on emulator.
- Upload to Play internal track only after release gates pass.

Release through internal → closed testing → staged production. Use Play App Signing, keep the upload key in protected CI custody, document owner access and upload-key reset/recovery, keep version code monotonic, and document desktop/product version mapping.

## 9. Phased implementation program

### Phase 0 — ADRs, baseline, and containment

**Deliverables**

- ADRs for scope, topology, pilot domains, relay policy, licensing/mesh separation, Android distribution, Companion v1's external WireGuard profile, any future embedded VPN policy, backup encryption, and legacy LAN deprecation.
- Re-baselined route, migration, capability, plugin, and command inventory.
- Kill switch preventing arbitrary-SQL LAN endpoints from WAN/mesh binding.
- Threat model and data-classification map.
- Feature flags for mesh, each sync domain, companion reads, and each mobile write workflow.

**Exit criteria**

- Existing desktop validation passes.
- Public/mesh interface tests cannot reach raw-SQL endpoints.
- Security, product, and compliance owners approve pilot scope.

### Phase 1 — Security, authorization, transactions, and recovery

**Deliverables**

- Rust-side authenticated principal with session, node, branch, role, module, and operation context.
- Reduced Tauri capabilities and restrictive CSP.
- Privileged pilot mutations implemented as Rust SQLx commands.
- Atomic business mutation + audit transaction.
- Safe SQLite online backup and staged restore.
- Secret-storage plan implemented for mesh/session/TOTP/provider credentials as applicable.

Start with sale, payment/refund, stock movement/transfer, and product/price commands because they form the first sync pilot.

**Exit criteria**

- Frontend state manipulation cannot bypass Rust authorization.
- Failure injection at every mutation step produces full commit or no effect.
- Concurrent tills cannot oversell the same branch stock.
- WAL-active backup and restore pass integrity, low-space, interrupted, and wrong-key tests.
- No mesh endpoint is enabled before this phase passes.

### Phase 2A — Responsive foundations

**Deliverables**

- Shared responsive primitives listed in section 7.
- Refactored shell, sidebar, topbar, settings layout, overlays, table model, combobox, and pagination.
- Root browser test harness with mocked Tauri/data gateways.
- Reference routes passing the full viewport matrix.

**Exit criteria**

- No document horizontal overflow on reference routes.
- Keyboard/focus behavior is correct.
- No in-scope axe-detectable WCAG A/AA violations, plus manual contrast, labels/instructions/errors, 200% text, 400% zoom/reflow, and representative screen-reader checks.
- 44×44 touch contract passes.
- Desktop screenshots and high-frequency keyboard behavior do not regress.

### Phase 2B — Android platform bootstrap

This runs in parallel with Phase 2A after Phase 0 and does not add business features.

**Deliverables**

- `DesktopApp`/`CompanionApp` split.
- Platform service seams.
- Android project, config, capability, Cargo target gating, CI and emulator harness.
- Android bootstrap screen with lifecycle, back, safe-area, connectivity, and secure installation identity.

**Exit criteria**

- All four Rust Android targets check.
- AAB validates and installs.
- No updater, autostart, tray, LAN server, raw SQL, broad filesystem, or desktop process permission appears in Android artifacts.
- Emulator survives rotate, background, process death, and offline launch.

### Phase 3 — Local event spine and convergence laboratory

**Deliverables**

- Provisional migrations 099–105, renumbered if needed.
- Atomic outbox integration for pilot commands.
- Inbox idempotency, cursor, domain revision, conflict, dead-letter, and snapshot implementation.
- Loopback/two-database fault harness before WireGuard.
- Removal of the unwired generic HTTP queue or replacement with an explicitly local-only typed-command outbox. Add a regression proving queue writes remain local while the master is unreachable; never route queue persistence through the generic remote DB gateway.

**Exit criteria**

- No outbox event exists for rolled-back mutations.
- Duplicate, reorder, gap, timeout-after-apply-before-ACK, and restart tests converge.
- Two independent databases converge after long partitions.
- Rebuild from snapshot + event tail succeeds.
- Financial totals and stock movement trails remain explainable and balanced.

### Phase 4A — Private Mesh transport

**Deliverables**

- Business mesh root, node certificates, invitations, rotation, revocation, recovery export, mesh epoch.
- WireGuard direct transport bound to private `/32` addresses.
- NAT/CGNAT classification and explicit fallback UX.
- Signed Windows mesh service.
- Private Mesh operations and conflict UI.

**Exit criteria**

- External security review passes.
- No public Omnix endpoint, cleartext fallback, wildcard CORS, or reusable pairing secret.
- Revocation and rotation work under live sync.
- High loss/outage does not affect local commit latency.

### Phase 4B — Responsive route waves

Migrate R1–R4 in independently releasable batches. Every batch preserves desktop behavior and adds narrow behavior; do not wait until the end for tests.

**Exit criteria**

- All declared routes pass their responsive contract.
- Route inventory contains no unexplained fixed-width/fixed-column exception.
- POS completes search/scan → cart → customer → payment → receipt at narrow and desktop widths.
- Tables remain searched, paginated, and semantically complete.
- Accessibility and desktop performance gates remain green.

### Phase 5 — Controlled branch pilot

**Rollout sequence**

1. Shadow outbox: emit and verify locally, no transmission.
2. Lab HQ: transmit, verify, do not apply.
3. Read-only consolidation.
4. Apply product/price downward and sales/payment/stock events upward.
5. Customer pilot with two or three branches and hands-on support.

**Exit criteria**

- Branch staff can authenticate and pass Rust-side branch/role/module authorization, and the branch sells, during a 72-hour WAN outage.
- 100,000-event backlog catches up within the agreed resource budget.
- No duplicate financial effect or lost acknowledged event.
- Conflict is visible and resolvable.
- HQ loss/promotion and branch rebuild drills pass.
- POS search remains under 50ms and local sale commit under 100ms on target hardware, independent of WAN.

### Phase 6 — Read-only Android Companion

**Deliverables**

- Enrolment, authentication, role/branch scope.
- Read-only companion route set.
- Scoped local cache, freshness/offline states, barcode lookup, lifecycle-safe refresh.
- Internal Play AAB, privacy/Data Safety draft, support and revocation procedures.

**Exit criteria**

- Android 9, Android 13, and current target device/emulator matrix passes.
- Airplane-mode launch shows safe cached data and freshness.
- TalkBack, 200% font, soft keyboard, permission denial, safe areas, tablet/phone orientations, and 44×44 targets pass.
- No secrets appear in SQLite, logs, screenshots, backups, or crash fixtures.
- Android performs no authoritative accounting, compliance, backup, hub, or updater work.

### Phase 7 — Bounded Android writes

Enable one workflow per release flag. Recommended order:

1. Approval decision.
2. Stock count line.
3. Receiving draft.
4. Delivery/housekeeping/service status.
5. Attendance or appointment check-in.
6. Kitchen bump/serve.

Each command requires local durable outbox, idempotency key, actor/device audit, revision/CAS precondition, conflict UI, revocation checks, and a branch authority rule.

**Exit criteria per workflow**

- Create offline, kill app, restart, reconnect, apply exactly once.
- Duplicate submit has one effect.
- Stale revision produces a human-readable conflict.
- Revoked role/device cannot deliver queued writes.
- Full audit correlation is available from phone to branch to HQ.
- Workflow can be remotely disabled without disabling reads or local branch operation.

### Phase 8 — Production hardening and GA

**Deliverables**

- Approved direct/relay production design.
- Protocol N/N-1 and migration fixtures.
- Certificate and entitlement rotation.
- Snapshot compaction and dead-letter repair.
- Redacted support bundles and opt-in telemetry.
- SBOM, dependency scanning, penetration test, service and Play release runbooks.
- Disaster-recovery SLOs and ownership.

**Exit criteria**

- Security review and DR exercise signed off.
- Enabled domains have explicit authority, conflict, idempotency, audit, recovery, and compliance rules.
- Windows service and Android staged upgrades preserve data and protocol compatibility.
- Relay failure returns to direct/local operation without business interruption.

## 10. Test and validation program

| Layer | Required validation | Blocking failure |
| --- | --- | --- |
| TypeScript/frontend | `pnpm exec tsc --noEmit`, Vitest, audit, Vite build | Any type/build/audit error |
| Rust | fmt, clippy, unit/integration tests, real SQLx failure injection | Partial commit, scope bypass, unsafe migration |
| Protocol | Two DBs plus fault proxy; duplicate/reorder/gap/timeout/schema/signature/property tests | Lost event, duplicate effect, divergence |
| Security | Threat-model tests, hostile origin, packet capture, invitation attacks, secret scans, pen test | Raw SQL, public endpoint, reusable secret, permission bypass |
| Recovery | WAL-active backup, low disk, corruption, interrupted restore, snapshot resume, HQ promotion | Unverified install, lost acknowledged event, split brain |
| Responsive | Playwright geometry at all target widths, keyboard, axe, zoom, themes, density, screenshots | Clipped primary task, body overflow, inaccessible action |
| Android build | Four ABI checks, APK/AAB, bundletool, manifest/capability inspection | Missing ABI, invalid bundle, desktop permission/plugin |
| Android runtime | Emulator/real device lifecycle, Doze, network handoff, OSK, back, permissions, upgrade | Data loss, duplicate authority, unusable navigation |
| Network | LAN/public/NAT/CGNAT/relay/high-loss/reboot/endpoint change | Insecure fallback, local commit blocked |
| Performance | Startup, search, local sale, large DB, 100k outbox | Offline/local performance regression |
| Compliance | Domain review, PII/PHI log scan, eTIMS/controlled identifier checks, Play privacy | Undeclared or ambiguous regulated behavior |

### 10.1 Browser responsive harness

Add root Playwright configuration for the Tauri frontend rendered with deterministic mocked platform/data adapters. Every representative test asserts:

- `document.documentElement.scrollWidth <= clientWidth` unless the page has an allowlisted internal canvas.
- Primary action is visible and operable.
- Focus never enters hidden desktop navigation.
- Opening/closing navigation, combobox, dialog, and sheet restores focus correctly.
- Tab order follows visual order.
- Soft keyboard simulation does not cover the active field or primary action.
- No in-scope axe-detectable WCAG A/AA findings; manual checks cover contrast, labels and errors, 200% text, 400% zoom/reflow, and representative NVDA/TalkBack reading order and announcements.
- Reduced motion removes nonessential spatial movement.

Static audits should report, not blindly ban, `min-w-*`, fixed widths, raw `<table>`, nonresponsive grid columns, and viewport-fixed overlays. Each remaining occurrence needs a reviewed reason.

### 10.2 Sync fault harness

The harness must inject:

- Duplicate events.
- Out-of-order delivery.
- Missing sequence/gap.
- Partial batch.
- Timeout after apply but before ACK.
- Corrupt hash/signature.
- Unsupported protocol/domain version.
- Wrong business/branch/node scope.
- Certificate expiry/revocation.
- Process kill during apply/snapshot install.
- Disk full and database lock.
- Clock changes.
- Long partition and 100k backlog.
- Old HQ returning after promotion.
- Old branch hub returning after replacement and branch-epoch fencing.
- Recovery import of an unacknowledged old-hub outbox with duplicate and gap cases.

Property tests assert convergence, idempotency, balanced finance, traceable stock, and legal workflow transitions.

## 11. CI and release changes

Add workflows or jobs for:

- Responsive Playwright matrix on pull requests touching `src/**`.
- Rust fmt/clippy and host tests in addition to current cargo tests.
- Protocol/fault tests with two temporary SQLite databases.
- Android clean build and emulator smoke.
- Signed Android AAB only on protected release workflow.
- Capability/manifest diff tests for desktop and Android.
- Migration fixtures from selected historical databases through current.
- SBOM and dependency vulnerability reports before GA.

Keep the current release gates from `AGENTS.md`:

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
node scripts/audit-codebase.mjs
pnpm exec vite build
```

Add affected Rust, protocol, responsive, and Android gates. Run the website build only when licensing, entitlement, release, or backup endpoints under `website/` change.

## 12. Rollout and rollback

### Rollout

- Add schema before using it; preserve N-1 compatibility during staged rollout.
- Feature-flag transport and every domain adapter independently.
- Keep local outbox writing in shadow mode before transmission.
- Keep transmission verification-only before apply.
- Start with internal/lab data, then one or two pilot customers.
- Use Play internal and closed tracks before staged production.
- Advance cohorts only after lag, conflict, crash, data-correctness, and support review.

Suggested flags:

```text
meshIdentityEnabled
meshTransportEnabled
meshWriteProducts
meshWriteSales
meshWritePayments
meshWriteStock
companionReadEnabled
companionWriteApprovals
companionWriteStockCount
...
```

### Rollback

- Stopping mesh transport never stops local branch commits; retain outbox for replay.
- Disable one event adapter or mobile workflow without disabling unrelated domains.
- Do not down-migrate event history after production use. Roll back binaries only while schema/protocol compatibility is proven.
- Before service/schema/mobile rollout, create and verify an encrypted snapshot and retain old DB/WAL/SHM until post-upgrade checks pass.
- Correct finance and stock with compensating events, not deletion.
- Revoke a compromised node and issue a new identity; never reuse the compromised key.
- Fence restored HQ with mesh epoch before it can sync.
- For Play failures, stop staged rollout and issue a forward-compatible hotfix; do not depend on binary downgrade.

## 13. Operations and support

The Private Mesh screen and support bundle should expose only redacted operational information:

- Hub/node versions and protocol compatibility.
- Direct/relay/LAN state.
- Last handshake and authenticated health.
- Pending event count and oldest age.
- Peer ACK cursor and lag.
- Conflict/dead-letter count.
- Last successful snapshot and verification.
- Certificate expiry/rotation state.
- Backup health.
- Correlation IDs and sanitized error categories.

Never include business payloads, passwords, licence keys, provider keys, full tokens, private keys, patient data, customer contacts, or payment references in support bundles by default.

Operational runbooks are required for:

- First mesh setup.
- CGNAT/static-IP diagnosis.
- Branch enrollment and revocation.
- Lost/stolen phone.
- Certificate expiry/rotation.
- Large backlog.
- Conflict and dead-letter repair.
- Branch rebuild, replacement epoch, stale-old-hub return, and audited recovery of any unacknowledged outbox.
- HQ promotion and fencing.
- Relay outage.
- Android reinstall/Keystore loss.
- Service and app upgrade failure.

## 14. Principal risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Privileged SQL remains in frontend | WAN/mobile authorization can be bypassed | Migrate pilot commands to Rust; remove broad SQL capability progressively |
| Shared sale path affects all verticals | POS, Salon, Hospitality, Hardware regress together | One typed command and cross-vertical contract suite |
| Events mirror database rows | Schema upgrades break replay | Domain payloads, versions, upcasters, immutable fixtures |
| Direct WireGuard fails under CGNAT | Branch cannot connect | Detect early; explicit static-IP/customer-relay/future opaque-relay choice |
| Key or recovery material is lost | Business loses mesh control | Documented recovery ceremony, encrypted export, drills, optional dual control |
| Restored HQ causes split brain | Divergent authority and duplicate commands | Signed mesh epoch, fencing, explicit promotion workflow |
| Generic merge reaches regulated data | Compliance/clinical harm | Exclude from pilot; domain-specific review and state machines |
| Android background assumptions lose work | Missing or duplicate mobile action | Native lifecycle, durable outbox, WorkManager only for idempotent delivery |
| Responsive conversion damages desktop POS | Cashier speed and scanner focus regress | Desktop baselines, keyboard/scanner tests, route waves, performance gates |
| Backup copies live WAL unsafely | Corrupt or incomplete recovery | SQLite online backup/VACUUM INTO, staged restore and integrity checks |
| Android inherits desktop capability | Excessive device access or unsupported plugin | Separate config/capabilities and manifest contract tests |
| Program is too broad for available team | Half-built insecure platform | Pilot domain cap, hard gates, parallel foundations only, explicit non-goals |

## 15. Staffing and ownership

Recommended workstreams:

- Architecture/security owner: ADRs, threat model, trust, mTLS/WireGuard, reviews.
- Rust/data engineers: domain commands, transactions, migrations, outbox/inbox, snapshots, recovery.
- Frontend/design-system engineer: responsive primitives and route waves.
- Android/Tauri engineer: runtime split, Gradle/CI, Keystore, lifecycle, connectivity, camera/share.
- QA/SRE: browser geometry, fault injection, migration fixtures, NAT lab, device matrix, rollout/runbooks.
- Product/compliance/licensing owners: companion scope, regulated domains, entitlements, privacy, relay commercial policy.

With a smaller team, preserve the sequence rather than parallelizing trust-critical work:

```text
security/correctness
→ responsive and platform foundations
→ local outbox/protocol
→ mesh transport
→ branch pilot
→ read-only Android
→ bounded Android writes
```

## 16. Explicit non-goals for the first program

- No public exposure of the current arbitrary-SQL API.
- No cloud database or required Omnix account for branch operation.
- No full peer-to-peer multi-master topology; use HQ/branch hubs.
- No Android hub, Windows service equivalent, updater, authoritative jobs, or database administration.
- No promise that all desktop routes appear in Android.
- No mobile POS, final pharmacy dispense, controlled-register authority, eTIMS authority, SHA authority, merchant secrets, printers, drawers, or scales in Companion v1.
- No pilot replication of payroll, RBAC secrets, prescriptions, controlled substances, provider credentials, or complex serial/booking state.
- No generic last-write-wins for finance, stock, regulatory, booking, serial, or workflow state.
- No automatic relay or public port exposure without an explicit customer decision.
- No version bump, release tag, or production enablement as part of planning/foundation work.

## 17. First implementation backlog

The first ten pull requests should be small enough to review independently:

1. ADRs, feature flags, threat model, route/plugin/capability inventory.
2. External-interface containment and tests for legacy raw-SQL LAN endpoints.
3. Platform detection plus `DesktopApp`/`CompanionApp` split with desktop behavior unchanged.
4. Desktop/Android platform service interfaces and no-op/unsupported typed results.
5. Responsive shell/navigation primitives and reference-page Playwright geometry harness.
6. Tauri Android init, target-gated plugins/dependencies, separate capabilities, clean emulator shell.
7. Rust authenticated command context and deny-by-default branch/role/module tests.
8. Rust SQLx sale/payment/stock transaction boundary with failure-injection tests.
9. Consistent encrypted backup/staged restore implementation and recovery tests.
10. Mesh identity/outbox migrations plus one shadow-mode pilot event emitted atomically.

Do not begin WireGuard customer networking, branch apply, or Android writes inside these initial pull requests.

## 18. Definition of done

The program is complete only when all of the following are true:

- Existing branches operate locally with zero internet and do not wait for HQ.
- Pilot events converge exactly once by effect under duplicate, reorder, restart, and long partition tests.
- Every acknowledged event is recoverable from retained events or a verified snapshot.
- Raw SQL is absent from mesh/mobile protocols and server-side authorization is the security boundary.
- WireGuard and application mTLS expose no Omnix service publicly.
- Direct, CGNAT, relay-required, revoked, conflict, lag, and recovery states are visible and actionable.
- Every desktop route meets the responsive contract at its declared width matrix.
- Android builds reproducibly, ships read-only before writes, and has no desktop-only authority or capability.
- Every enabled mobile write is durable, idempotent, conflict-visible, independently disableable, and audited.
- Security review, disaster-recovery drill, compliance review for enabled domains, support runbooks, and operational ownership are signed off.

Until those conditions hold, describe the work by its current milestone—do not market it as complete multi-branch sync, full responsiveness, or full mobile support.

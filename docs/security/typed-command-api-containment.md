# Task 19: typed command API and legacy LAN containment

## Pre-implementation legacy exposure (task baseline)

The findings below describe the interface before production registration. The implemented compatibility boundary and operator flag are documented in `docs/security/legacy-trusted-lan.md`.

The running router in `src-tauri/src/network/mod.rs` still mounts these routes in `build_router`:

| Route | Handler | Exact authority granted |
|---|---|---|
| `POST /api/db/query` | `db_query` | Accepts caller-controlled SQL plus JSON binds, calls `sqlx::query(&q.sql)`, uses `fetch_all`, and returns every materialized column/row. There is no statement allowlist, branch predicate, row cap, body cap, or query timeout. |
| `POST /api/db/execute` | `db_execute` | Accepts caller-controlled mutation SQL plus JSON binds and executes it directly. There is no table/operation allowlist, branch predicate, revision check, idempotency key, business validation, audit coupling, or outbox coupling. |

Both routes use `require_auth`, which only checks plaintext bearer-token equality against `api_tokens.token` and `revoked = 0`. It does not resolve a user, session expiry, node binding, branch assignment, role, permission, enabled module, licence, authentication level, or read-only access mode. `device_fingerprint` is collected at pairing but not checked by request authentication. Database errors are serialized back to callers.

The exposure is broader than two isolated handlers:

- `src/lib/db.ts::query` forwards every non-`network.*` client-mode read to `/api/db/query`.
- `src/lib/db.ts::execute` forwards every non-`network.*` client-mode write to `/api/db/execute`.
- `start_server` binds `0.0.0.0` and advertises the service over mDNS.
- A single `CorsLayer` wraps the complete router with `allow_methods(Any)`, `allow_headers(Any)`, and `allow_origin(Any)`. This includes health, pairing, arbitrary reads, and arbitrary writes.

Permissive CORS is not authentication, but it removes browser-origin isolation. Any origin that obtains a paired token can drive the arbitrary-SQL routes. The current router is therefore unsuitable for Android, browser, WAN, mesh, or any untrusted LAN. It must remain a temporary, operator-controlled trusted-desktop compatibility surface.

## Implemented typed leaf boundary

`src-tauri/src/command_api/` is deliberately unregistered and now provides:

- schema-versioned (`schemaVersion: 1`), unknown-field-denying Serde envelopes and DTOs;
- UUID-v4 command/request, node, user, branch, and aggregate identifiers;
- server-resolved sessions with node/user binding, expiry, revocation, access mode, authentication level, branch assignments, deny-first permission grants, scoped roles, enabled modules, and licence state;
- five mutation families: sale completion, branch inventory item upsert, branch customer upsert, purchase-order creation, and stock-movement recording, plus the original reorder-level command;
- mandatory `expectedRevision` on the real mutation set (`0` means create), with the durable repository contract responsible for comparing the current branch aggregate revision;
- SHA-256 canonical-envelope fingerprints and command-id replay/conflict semantics;
- an explicit one-transaction persistence contract covering command claim, revision check, branch-scoped business mutation, sanitized audit append, branch outbox append, and typed receipt completion;
- bounded Android inventory/open-purchase projections and till recent-sales/current-shift projections (maximum 100 rows, 256 KiB encoded page, bounded search/cursor, validated output branch);
- dedicated fixed SQL leaves under `command_api/query/`; callers bind a server-generated authorized-branch JSON array to parameter 1, and read/revision leaves join the `authorized_branches` CTE;
- branch-local password authentication that needs no WAN call, binds an approved node and assigned branch, issues only Desktop/Android user-level sessions, limits local sessions to 12 hours, requires dummy verification for unknown users, and records sanitized failures.

No handler accepts SQL, role, permission, module, authentication level, session facts, or an unrestricted branch list from JSON. Browser sessions remain read-only server-side. Stock adjustments require an elevated session.

## Schema facts and intentional integration boundary

The current schema has branch columns for sales, purchase orders, batches, and cash-register rows. It does **not** have safe branch aggregates/revisions for products, customers, stock movements, or command receipts, and it has no command outbox. Reusing global `products`, global `customers`, or legacy `stock_movements` would violate the branch contract.

Consequently, the fixed leaves target coordinator-owned migration tables/columns (`branch_inventory_items`, `branch_customers`, `branch_stock`, `stock_movements_v2`, `authenticated_sessions`, `command_ledger`, `command_outbox`, and revision columns). They must not be registered against an older database. The exact migration and registration patch is in `docs/security/task-19-coordinator-registration.md`.

## Required containment and removal sequence

1. Apply the coordinator migration and implement sqlx ports using only the fixed query leaves. Every repository must begin one SQLite transaction and satisfy `IdempotentMutation` before commit.
2. Resolve opaque access tokens to `SessionContext` entirely server-side. Existing `api_tokens` records must not be promoted to typed user sessions.
3. Mount typed command and read routers separately. Apply body, row, time, concurrency, and rate limits before JSON extraction.
4. Mount browser reads on a separate router with explicit configured origins, exact methods, and only `Authorization`/`Content-Type`; never apply `Any` CORS to a typed command router.
5. Change each `src/lib/db.ts` domain caller from SQL transport to its typed endpoint. Keep an inventory of remaining generic callers.
6. During that compatibility window, place the two legacy routes behind an explicit `LegacyTrustedLan` opt-in, a private-interface/source-address check, a distinct hashed legacy-token scope, rate/body/time limits, and metadata-only use logging. These mitigations do not make arbitrary SQL safe.
7. Once the caller inventory is zero, delete `/api/db/query`, `/api/db/execute`, `DbQuery`, `bind_json`, and generic client-mode forwarding; revoke every legacy token. This deletion is a release gate before Android/browser/WAN/mesh exposure.

## Remaining crypto and transport gaps

The leaf boundary does not yet provide a production Argon2 verifier adapter, random session-token generator, token hashing/rotation, encrypted transport, certificate/pinning strategy, HTTP/Tauri adapters, middleware limits, origin configuration, rate limiting, persistent sqlx repository implementations, or migration registration. LAN HTTP remains plaintext and the existing pairing/API tokens remain plaintext. Canonical SHA-256 fingerprints detect command-id content conflicts but are not signatures or MACs and do not authenticate the sender. These are coordinator integration gates, not optional hardening.

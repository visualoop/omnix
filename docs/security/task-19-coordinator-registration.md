# Task 19 coordinator registration patches

Do not apply only part of this handoff. The command API is intentionally unregistered until the schema, sqlx ports, session resolver, middleware, and route adapters land together.

## 1. Register the Rust module

Apply this exact `src-tauri/src/lib.rs` patch:

```diff
 mod commands;
+mod command_api;
 mod db;
 mod license;
 pub mod network;
```

Use `pub mod command_api;` instead only if the separate `omnix-lan-service` crate directly mounts the typed router. Do not expose it merely for convenience.

## 2. Reserve migration 099 and register it

Create `src-tauri/migrations/099_typed_command_api.sql` with this baseline (reconcile the number if another branch has already claimed 099):

```sql
CREATE TABLE authenticated_sessions (
  id TEXT PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL REFERENCES devices(id),
  access_mode TEXT NOT NULL CHECK (access_mode IN ('desktop','android','browser_read_only')),
  authentication_level TEXT NOT NULL CHECK (authentication_level IN ('device_paired','user','elevated')),
  branch_local INTEGER NOT NULL DEFAULT 0 CHECK (branch_local IN (0,1)),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_authenticated_sessions_user ON authenticated_sessions(user_id, expires_at);
CREATE INDEX idx_authenticated_sessions_node ON authenticated_sessions(node_id, expires_at);

CREATE TABLE command_ledger (
  command_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('processing','completed')),
  user_id TEXT NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL REFERENCES devices(id),
  session_id TEXT NOT NULL REFERENCES authenticated_sessions(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  command_type TEXT NOT NULL,
  expected_revision INTEGER NOT NULL,
  authentication_level TEXT NOT NULL,
  response_json TEXT,
  resulting_revision INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_command_ledger_processing ON command_ledger(state, created_at);

CREATE TABLE command_outbox (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE REFERENCES command_ledger(command_id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  aggregate_revision INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT
);
CREATE INDEX idx_command_outbox_pending ON command_outbox(created_at)
  WHERE published_at IS NULL;

CREATE TABLE branch_inventory_items (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  unit TEXT NOT NULL,
  buying_price_minor INTEGER NOT NULL CHECK (buying_price_minor >= 0),
  selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
  reorder_level_milli INTEGER NOT NULL CHECK (reorder_level_milli >= 0),
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, product_id),
  UNIQUE (branch_id, sku)
);
CREATE INDEX idx_branch_inventory_revision
  ON branch_inventory_items(branch_id, revision, product_id);

CREATE TABLE branch_customers (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  credit_limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, customer_id)
);
CREATE INDEX idx_branch_customers_revision
  ON branch_customers(branch_id, revision, customer_id);

CREATE TABLE branch_stock (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_milli INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, product_id)
);

CREATE TABLE stock_movements_v2 (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT REFERENCES batches(id),
  movement_kind TEXT NOT NULL,
  quantity_delta_milli INTEGER NOT NULL CHECK (quantity_delta_milli <> 0),
  reason_code TEXT NOT NULL,
  notes TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_stock_movements_v2_branch
  ON stock_movements_v2(branch_id, created_at DESC, id DESC);

ALTER TABLE sales ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cash_register ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
```

Before switching reads, backfill branch inventory/stock/customer projections in the same migration or a reviewed follow-up. Convert money/quantity to minor/milli units with explicit rounding tests; do not silently reinterpret existing REAL columns.

Then add this exact entry after migration 98 in `src-tauri/src/lib.rs`:

```diff
         Migration {
             version: 98,
             description: "Salon commission payouts (daily staff pay)",
             sql: include_str!("../migrations/098_salon_commission_payouts.sql"),
             kind: MigrationKind::Up,
         },
+        Migration {
+            version: 99,
+            description: "Typed command sessions, revisions, ledger, outbox, and branch projections",
+            sql: include_str!("../migrations/099_typed_command_api.sql"),
+            kind: MigrationKind::Up,
+        },
     ];
```

## 3. Implement and register adapters

Implement `src-tauri/src/command_api/sqlx_ports.rs` using only constants in `command_api/query/`. For every mutation, acquire one `sqlx::Transaction<Sqlite>`, claim `command_ledger.command_id`, compare fingerprint and server identity, read the branch aggregate revision, mutate with a branch predicate, insert `audit_log`, insert `command_outbox`, complete the ledger receipt, and commit once. Never call a legacy `db_execute` helper from these ports.

Implement `src-tauri/src/network/typed.rs` and mount only the paths in `command_api::route_manifest::TYPED_ROUTE_ALLOWLIST`. Each adapter must resolve an opaque token to `SessionContext` before deserializing/dispatching business data and map `CommandApiError::http_status()` to sanitized JSON.

After those files exist, apply:

```diff
 // src-tauri/src/network/mod.rs
+mod typed;
+
 pub fn build_router(state: ServerState) -> Router {
-    let cors = CorsLayer::new()
-        .allow_methods(Any)
-        .allow_headers(Any)
-        .allow_origin(Any);
-
-    Router::new()
+    let internal = Router::new()
         .route("/api/health", get(health))
         .route("/api/auth/pair", post(pair_device))
+        .merge(typed::desktop_and_android_router(state.clone()));
+
+    let browser_reads = typed::browser_read_router(state.clone())
+        .layer(typed::configured_browser_cors());
+
+    internal
+        .merge(browser_reads)
         .route(
             "/api/db/query",
-            post(db_query).layer(middleware::from_fn_with_state(state.clone(), require_auth)),
+            post(db_query).layer(typed::legacy_trusted_lan_guard(state.clone())),
         )
         .route(
             "/api/db/execute",
-            post(db_execute).layer(middleware::from_fn_with_state(state.clone(), require_auth)),
+            post(db_execute).layer(typed::legacy_trusted_lan_guard(state.clone())),
         )
         .with_state(state)
-        .layer(cors)
 }
```

The three `typed::*` functions in this patch are security boundaries, not placeholders: `configured_browser_cors` must use explicit origins/methods/headers; `browser_read_router` must have no mutation handlers; and `legacy_trusted_lan_guard` must require operator opt-in, private source address, distinct hashed legacy scope, authentication, and rate/body/time limits. If those functions are not implemented, do not apply the router patch.

## 4. Cut over and delete generic SQL

Migrate `src/lib/db.ts` domain callers endpoint-by-endpoint. When no caller sends SQL, delete the two route declarations plus `DbQuery`, `db_query`, `db_execute`, `bind_json`, generic client-mode forwarding, and legacy tokens. Do not expose Android/browser/WAN/mesh before this deletion gate.

# Read-only web companion — coordinator wiring patch

The task-owned implementation is intentionally unregistered. Do not expose it through the existing permissive `network::build_router`, `/api/db/query`, or `/api/db/execute` routes.

## 1. Rust module and dedicated listener

In `src-tauri/src/network/mod.rs`, add module declarations only (do not merge the routers):

```diff
+pub mod read_only_policy;
+pub mod read_only_web;
```

In the coordinator-owned server startup, create a **separate listener/port** for the browser companion and pass the exact externally advertised origin:

```rust
use crate::network::read_only_web::{build_read_only_web_router, ReadOnlyWebState};

let origin = format!("http://{}:{}", advertised_lan_ip, read_only_port);
let web_state = ReadOnlyWebState::new(pool.clone(), origin, business_name.clone());
let web_app = build_read_only_web_router(web_state);
// Bind web_app on read_only_port. Never `.merge()` it into build_router(state).
```

The existing wildcard/raw-SQL router must remain unreachable from this listener. Firewall/bind configuration should expose only the dedicated reporting port to browser devices.

## 2. Browser document routing

Add `web.html` as a Vite multi-page input in `vite.config.ts`:

```diff
+build: {
+  rollupOptions: {
+    input: {
+      desktop: path.resolve(__dirname, "index.html"),
+      web: path.resolve(__dirname, "web.html"),
+    },
+  },
+},
```

The dedicated Axum listener must serve the built `web.html` for `/web` and `/web/*` navigation requests plus its hashed Vite assets, `manifest.webmanifest`, `web-service-worker.js`, `web-icon-192.png`, and `web-icon-512.png`. It must not serve the desktop `index.html`.

## 3. Session issuance (desktop-authenticated action only)

Issue at least 32 random bytes, store only `SHA-256(token)` in `web_read_sessions`, and return the helper-generated header:

```rust
let header = read_only_web::session_cookie_header(&raw_token, max_age_seconds, use_https)?;
```

The issuance command must snapshot assigned branch IDs and effective report permissions after RBAC evaluation, cap expiry to eight hours, set `read_only = 1`, and audit issuance/revocation. There is deliberately no browser signup, session creation, SQL, or mutation endpoint.

## Required runtime checks after wiring

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run tests/read-only-web.spec.ts tests/read-only-web-ui.spec.tsx tests/read-only-web-runtime.spec.tsx
cargo test --manifest-path src-tauri/Cargo.toml --test read_only_policy_standalone --test read_only_web_router_standalone
node scripts/audit-codebase.mjs
pnpm exec vite build
```

Then verify on an actual phone/tablet on the same LAN: `/web` loads, install prompt is available, refresh/deep links resolve, API responses carry `Cache-Control: no-store`, cross-origin requests fail, session cookies are not readable from JavaScript, expiry hides in-memory data, and no `/api/db/*`, POS, settings, or mutation route is reachable on the dedicated port.

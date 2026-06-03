# 11 — Licensing Runbook: Purchase → Activation → Gated Run

End-to-end reference for how an Omnix licence flows from payment to a gated,
offline-capable desktop install. Covers the anti-piracy model and the three
invariants that protect revenue. (Phase H / Task 28.)

## Pricing model

Perpetual / pay-once. A licence permanently unlocks **only the modules it was
sold with** (`modules[]`), on a fixed number of devices (`max_devices`).
Monetised by paid modules, a maintenance window (compliance updates), and extra
device seats — never subscriptions.

## Lifecycle

### 1. Purchase (website — `omnix.co.ke`)
1. Customer signs up and pays via Paystack (`paystack-init.ts`, reference prefix `OMNIX-`).
2. On payment success a **License** doc is created: `licenseKey` (`OMNIX-…`),
   `modules[]` (e.g. `["core","hardware"]`), `maxMachines` (= desktop `max_devices`),
   `maintenanceUntil`, `status: active`.
3. `license-issued` email delivers the key. Key is RSA-signed (v2 payload carries
   `modules[]` + `max_devices`; v1 keys map `feat → modules` for back-compat).

### 2. Activation (desktop — `src/services/license.ts`)
1. `activateLicense(key)` verifies the RSA signature **locally** first.
2. `activateOnline(key, fingerprint)` POSTs `{licenseKey, machineId}` to
   `POST {ACTIVATION_API_BASE}/api/licenses/activate` (`VITE_OMNIX_API` || `https://omnix.co.ke`).
3. Server (`licenses-activate.ts`):
   - unknown key → 404 + `rejected_invalid`; suspended/cancelled → 403 + `rejected_revoked`;
   - known fingerprint → idempotent re-activation (token rotates), no seat consumed;
   - new fingerprint → **seat check** (below); on pass, registers machine + returns
     `{ ok, authToken, action, entitlements }`.
4. Desktop stores the row: `activation_token`, `server_validated=1`, `modules`
   (server entitlements preferred over signed-key), `max_devices`.
5. **Offline fallback**: if the server is unreachable, signed-key-only activation
   stores `server_validated=0` (pending). The app runs; Task 6 revalidation
   reconciles when back online. A `409`/`403` from the server is a **hard fail** —
   no activation.

### 3. Silent revalidation + rebind
- `LicenseGuard` calls `revalidateLicense()` once after activation confirms
  (`POST /api/licenses/validate`): refreshes modules/seats/maintenance, sets
  `server_validated`. If the licence is revoked it strips modules to `[]` and the
  guard re-locks the app.
- Self-service **rebind** (`POST /api/licenses/rebind`, customer dashboard
  → Machines → Deactivate): frees a seat so a replacement PC can activate.
  Rate-limited by a rolling window (`rebindLimitPerWindow` default 2 /
  `rebindWindowDays` default 30).

### 4. Gated run (desktop)
- **Entitlements store** (`src/stores/entitlements.ts`) is hydrated once from
  licence status — the **synchronous** source of truth for module gating.
- `isModuleEntitled(id)` gates routes (`RequireRole`), the sidebar, command
  palette, setup wizard, and the module switcher. `core` is always entitled.
- **Backend gate**: module-scoped service mutations call `assertModuleEntitled(id)`,
  which invokes the Rust command `verify_module_entitled(key, module)` —
  re-verifies the RSA signature server-side-of-the-IPC so it can't be spoofed
  from JS — plus `requirePermission(key)` (RBAC) with an audit-log write.

## Invariants (verified Task 28)

| # | Invariant | Where enforced | Verification |
|---|-----------|----------------|--------------|
| 1 | **Over-seat block** | `licenses-activate.ts`: active-machine count ≥ `maxMachines` → `409` + `rejected_seats`. Re-activation of a known fingerprint is idempotent (no false seat use). | Code-traced; `rejected_seats` audit row. |
| 2 | **Rebind cooldown** | `licenses-rebind.ts`: `usedInWindow ≥ limit` → `429` + `windowResetsAt` + `rejected_cooldown`; counter resets to 1 when the window has expired. | Code-traced rolling-window logic. |
| 3 | **Hardware-only licence keeps Hospitality locked** | Rust `verify_module_entitled` + TS `isModuleEntitled`: `'hospitality' ∉ modules` ⇒ denied. | Rust test `not_entitled_for_unlicensed_module` (embedded `HW_KEY`, `modules:["hardware"]`) passes. |

No automated desktop e2e runner exists (per AGENTS §9, none mandated yet);
invariants are verified by Rust unit tests + code trace. A live click-through
belongs to a future QA pass with a real Payload instance + signed test key.

## Version & domain hygiene (Task 28)

- `src-tauri/tauri.conf.json` version `0.2.6 → 0.2.8` (now aligned with
  `package.json` + `Cargo.toml`).
- Updater endpoints, `homepage`, and macOS `exceptionDomain` → `omnix.co.ke`
  (were `omnix.co.ke`).
- `longDescription` refreshed (hardware + hospitality; drops "salon").
- **Bundle `identifier` deliberately kept `ke.co.omnix.duka`.** It shipped in
  every tagged release (v0.2.4–v0.2.8) and the SQLite DB resolves to
  `$APPDATA/{identifier}/omnix.db`. Changing it would relocate the data dir and
  orphan every existing customer database, and break updater continuity — a
  destructive migration, out of scope for a hygiene pass. The user-facing brand
  is already Omnix via `productName`, domain, and updater. Reverse-DNS IDs are
  internal stable keys and survive rebrands by design.

### Known pre-existing issue (flagged, not changed)
`src-tauri/src/lib.rs::ensure_app_data_dir()` hardcodes `ke.co.omnix.app`,
which does **not** match the real bundle identifier `ke.co.omnix.duka`. This is
shipped behaviour that pre-dates this plan and touches the production DB path;
it should be reconciled deliberately (with a data-migration check), not folded
into a rename pass.

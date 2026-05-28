# DUKA WEBSITE — Plan 05: Telemetry SDK (Tauri Rust Side)

The desktop app must phone home so the owner sees live installs on the admin map and gets diagnostics when something breaks. This plan covers the Rust-side SDK: what's sent, how, when, with what authentication, how a user opts out, and the privacy contract.

The Tauri desktop app already exists and is feature-complete (Phases 1–8). This SDK is added as a new Rust module without disrupting any existing functionality.

---

## 1. PRINCIPLES

These are non-negotiable.

1. **No business data leaves the device.** No customer names, product names, sale amounts, prescriptions, employee details. Only counts, types, and durations.
2. **Opt-out at any time.** Settings → Privacy → "Send anonymous diagnostics" toggle. Default ON for trial, OFF unless explicitly accepted on first launch (we ask once, big modal, "Help us improve Duka with anonymous usage data?").
3. **Best-effort, never blocking.** Telemetry failures must NEVER affect the user's work. If the queue fills, drop oldest. If network is down, retry on next online check.
4. **Encrypted in transit, signed.** HTTPS only. JWT-style machine token as `Authorization: Bearer ...`.
5. **Bounded local storage.** Queue capped at 1 MB on disk. Older events drop once cap is reached.
6. **Inspectable.** A debug command `duka --telemetry-dump` prints the queue contents so a curious user can see exactly what we'd send.
7. **Geolocation is server-side only.** We send IP only because we have to. Lat/long lookup happens on the website, never embedded in the desktop binary.

---

## 2. WHAT GETS SENT

Three event categories. All payloads are structured JSON that match Payload's `TelemetryEvents` collection schema (Plan 02 §2.5).

### 2.1 Lifecycle events

```jsonc
{
  "type": "app_started",
  "session_id": "01HX...",     // ULID, generated at app launch
  "app_version": "0.2.0",
  "os": "windows",
  "os_version": "10.0.22631",   // Windows 11 build
  "arch": "x86_64",
  "active_module": "dawa",      // current module, from store
  "license_status": "trial",    // trial | active | lapsed
  "installed_at": "2026-01-15T08:00:00Z",  // first-install timestamp
  "uptime_seconds_since_install": 1234567,
  "lan_mode": "standalone"      // standalone | lan_master | lan_client
}
```

Sent on:
- `app_started` — once on launch, after license check
- `app_closed` — once on close (best-effort flush)
- `module_switched` — when user switches module in nav
- `lan_mode_changed` — switching to network mode

### 2.2 Health rollups (heartbeat)

Once every 30 minutes while the app is running. Aggregated counts of business activity. **No PII, no business specifics.**

```jsonc
{
  "type": "heartbeat",
  "session_id": "01HX...",
  "interval_minutes": 30,
  "active_module": "dawa",
  "branch_count": 2,
  "user_count": 4,                     // number of staff configured
  "products_count": 487,
  "sales_count_24h": 31,                // count only — no totals
  "lan_peer_count": 0,
  "integration_status": {
    "etims_configured": true,
    "mpesa_configured": true,
    "sha_configured": false,
    "paystack_configured": false
  },
  "last_sync_at": "2026-01-15T10:30:00Z",
  "feature_flags_seen": ["pos_v2", "stock_transfer_v2"]
}
```

Aggregates are computed locally from the app's SQLite. The aggregator has a pure function signature that is unit-tested:

```rust
pub fn collect_heartbeat(db: &Database, since: DateTime<Utc>) -> Heartbeat {
    Heartbeat {
        branch_count: db.count("SELECT COUNT(*) FROM branches WHERE deleted_at IS NULL"),
        user_count: db.count("SELECT COUNT(*) FROM users WHERE active = 1"),
        // ... all read-only counts, NEVER actual rows
    }
}
```

**Tests** (mandatory before shipping): assert no row content from the SQLite reaches the JSON. Property-based test fuzzes the database with synthetic data and checks the heartbeat output is purely numeric/categorical.

### 2.3 Errors & warnings

```jsonc
{
  "type": "crash",
  "severity": "fatal",
  "session_id": "01HX...",
  "app_version": "0.2.0",
  "message": "Failed to parse M-Pesa receipt response",
  "stack_trace": "<sanitized>",
  "module": "pharmacy::dispense::confirm_payment",
  "occurred_at": "2026-01-15T10:34:21Z",
  "local_env": {
    "os_version": "10.0.22631",
    "available_disk_gb": 47.2,
    "ram_used_pct": 23,
    "db_size_mb": 12.4,
    "online": true
  }
}
```

Severity levels (matches `TelemetryEvents.severity` enum):
- `debug` — verbose, only sent if `RUST_LOG=debug` env var set (developer mode)
- `info` — successful integrations, sales summaries — uncommon, mostly for trail
- `warn` — recoverable failures (M-Pesa STK timeout, retried OK)
- `error` — operation aborted but app still works
- `fatal` — crash; app may have died

**Sanitization rules** (applied before queueing):
- Strip any string field longer than 256 chars (likely contains user data)
- Strip any field with > 5 numeric values (likely an ID list)
- Replace any string matching email/phone/national-ID regex with `<redacted>`
- Strip any field whose key matches PII denylist: `name|phone|email|kra|nhif|sha|password|token|key|secret|customer|patient|prescription|product`

The sanitizer has its own test suite. Adding a new event type requires a sanitizer test.

### 2.4 What is NEVER sent

To make the privacy promise concrete, here's an explicit denylist:

- ❌ Product names (e.g. "Panadol 500mg")
- ❌ Sale amounts in KES
- ❌ Customer names
- ❌ Patient names
- ❌ Prescription content
- ❌ Employee names, NHIF/SHA numbers, national IDs
- ❌ Bank account numbers, M-Pesa till numbers
- ❌ KRA PIN of the business
- ❌ Receipts (any field labelled `receipt`, `invoice`, `transaction_*`)
- ❌ Any free-text user input
- ❌ Database row IDs (anything that lets us correlate two installs on the server)

If a future feature needs to send something not on this list, it goes through a code review with a written justification and the denylist is updated.

---

## 3. HOW IT'S SENT

### 3.1 Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                  Desktop app (Tauri)                    │
│  ┌─────────────┐    ┌────────────────────┐             │
│  │ App events  │───▶│ telemetry::queue   │             │
│  │ (sales, etc)│    │  (in-memory ring)  │             │
│  └─────────────┘    └─────────┬──────────┘             │
│                               │                         │
│                               ▼                         │
│                    ┌──────────────────────┐             │
│                    │ telemetry::store     │             │
│                    │ (SQLite WAL queue)   │             │
│                    └─────────┬────────────┘             │
│                              │ on tick: 60s             │
│                              ▼                          │
│                    ┌──────────────────────┐             │
│                    │ telemetry::dispatcher│─────HTTPS───▶ Payload /api/telemetry/events
│                    │ (batched, retried)   │              (machine token auth)
│                    └──────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Module layout

```
src-tauri/src/telemetry/
├── mod.rs              // public API: emit_event, set_enabled
├── event.rs            // event types, sanitizer
├── store.rs            // SQLite queue, capped at 1 MB
├── dispatcher.rs       // batched HTTPS sender with retry
├── heartbeat.rs        // 30-min rollup task
├── consent.rs          // opt-in/opt-out persistence
├── transport.rs        // HTTPS client with cert pinning
└── tests/
    ├── sanitizer_test.rs
    ├── queue_test.rs
    └── transport_test.rs
```

### 3.3 Public Rust API

```rust
// src-tauri/src/telemetry/mod.rs

use serde::Serialize;
use chrono::{DateTime, Utc};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Severity { Debug, Info, Warn, Error, Fatal }

pub trait Telemetry {
    /// Fire-and-forget. Always returns immediately. Errors are logged, not propagated.
    fn emit<T: Serialize>(&self, event_type: &str, severity: Severity, payload: &T);

    /// Enable/disable at runtime; persists to local config.
    fn set_enabled(&self, enabled: bool);

    /// Currently enabled (consented or trial-mode default).
    fn is_enabled(&self) -> bool;

    /// Force flush the queue. Useful before shutdown, app updates.
    async fn flush(&self) -> Result<(), TelemetryError>;
}

// Default implementation
pub fn default_telemetry(app: &tauri::AppHandle) -> impl Telemetry { ... }
```

Other modules call `app.state::<Telemetry>().emit(...)` instead of doing HTTP calls themselves.

### 3.4 Authentication

Each install gets a **machine token** at activation time. The token is:
- A long opaque random string (32 bytes, hex-encoded, 64 chars)
- Generated server-side when `/api/licenses/activate` is called
- Returned once, stored in OS keychain (Tauri's `tauri-plugin-stronghold`)
- Sent as `Authorization: Bearer <token>` on every telemetry POST
- Hashed at rest in the Payload `Machines.authToken` field (so DB compromise doesn't reveal valid tokens)

```rust
// Header construction
let token = stronghold::get("duka_machine_token")?;
let req = client
    .post(format!("{}/api/telemetry/events", endpoint))
    .header("Authorization", format!("Bearer {}", token))
    .header("X-Duka-Machine-Id", machine_id())
    .header("X-Duka-App-Version", app_version)
    .json(&batch);
```

Server-side: middleware validates the bearer token against `Machines.authToken` (hashed comparison). If invalid → 401, dispatcher backs off.

### 3.5 Transport rules

- **Endpoint base**: `process.env.NEXT_PUBLIC_SITE_URL` baked in at build time (not configurable post-install — prevents redirection).
- **TLS only**: Tauri's HTTP plugin enforces `https://` in production builds.
- **Timeout**: 10s per request.
- **Batching**: Up to 50 events per POST, max 256 KB body.
- **Retry**: exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s — then re-queue and try again on next tick (every 60s).
- **Circuit-breaker**: After 5 consecutive failures, dispatcher sleeps 5 min then re-tries. After 15 min total downtime, surface a one-time toast in the app: "Couldn't reach Duka servers — your data and license are unaffected, but updates may be delayed."
- **Compression**: gzip on bodies > 4 KB.

### 3.6 Local queue (SQLite)

Why SQLite and not a flat file: lets us survive crashes mid-write, query the queue for the dump command, and atomically remove sent events.

Schema:
```sql
CREATE TABLE telemetry_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,        -- serialised JSON event
  severity TEXT NOT NULL,
  enqueued_at INTEGER NOT NULL, -- unix ms
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER         -- unix ms; null = ready now
);

CREATE INDEX idx_telemetry_queue_ready
  ON telemetry_queue(next_retry_at, id);
```

Stored under user app-data dir (not in main `duka.db` to avoid accidentally backing up telemetry to cloud-backup feature).

**Cap enforcement**: on enqueue, if `pragma_page_count * page_size > 1_048_576`, delete oldest 100 rows. Hard cap.

### 3.7 Dispatcher loop

```rust
// pseudocode
loop {
    sleep(Duration::from_secs(60)).await;

    if !consent::is_enabled().await { continue; }
    if !network::is_online().await { continue; }

    let batch = store::take_batch(50, /* ready_now */ now()).await?;
    if batch.is_empty() { continue; }

    let token = stronghold::get_token().await?;
    match transport::post_events(&token, &batch).await {
        Ok(_) => store::delete_batch(&batch.ids).await?,
        Err(TransportError::Auth) => {
            log::warn!("Telemetry auth failed; pausing for 5min");
            sleep(Duration::from_secs(300)).await;
        }
        Err(TransportError::Network) => {
            store::reschedule_batch(&batch.ids, exp_backoff(batch[0].attempts)).await?;
        }
        Err(TransportError::Server) => {
            store::reschedule_batch(&batch.ids, Duration::from_secs(60)).await?;
        }
    }
}
```

Runs on a dedicated tokio task spawned at app start, killed at app close.

---

## 4. CONSENT FLOW

### 4.1 First-launch modal

On the very first app start, before the dashboard renders, show:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Help make Duka better                                     │
│                                                            │
│  Send anonymous usage data so we can fix bugs faster       │
│  and prioritise the features that matter to you?           │
│                                                            │
│  We send only:                                             │
│   ✓ App version, your OS, the module you use most          │
│   ✓ Counts (number of branches, users, sales today)        │
│   ✓ Errors and crashes                                     │
│                                                            │
│  We never send:                                            │
│   ✗ Customer names, product names, sale amounts            │
│   ✗ Anything that identifies your business                 │
│                                                            │
│  You can change this anytime in Settings → Privacy.        │
│                                                            │
│       [Don't send]              [Allow diagnostics]        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

User choice persisted to `~/.config/duka/consent.json`:
```json
{ "telemetry_enabled": true, "consented_at": "2026-01-15T08:00:00Z", "version": 1 }
```

### 4.2 Settings page

Added to existing Settings page (already exists in app):

```
┌────────────────────────────────────────────────┐
│ Privacy                                        │
│                                                │
│  Anonymous diagnostics       [●●●●○○]          │
│  Send error reports + usage  [Toggle]          │
│  counts to help improve Duka.                  │
│                                                │
│  → See what we send         [Show queue dump]  │
│  → Read privacy policy      [Open ↗]           │
└────────────────────────────────────────────────┘
```

Toggle is bound to Tauri command:
```rust
#[tauri::command]
async fn telemetry_set_enabled(enabled: bool, app: tauri::AppHandle) -> Result<()> {
    app.state::<Telemetry>().set_enabled(enabled);
    Ok(())
}
```

When disabled:
- Dispatcher loop becomes a no-op (the `consent::is_enabled` check)
- Queued events stay in SQLite (so re-enabling resumes)
- Optionally: button "Clear pending diagnostics" wipes the queue

### 4.3 "Show queue dump" UI

A modal that renders the contents of `telemetry_queue` as a syntax-highlighted JSON viewer. Copy-to-clipboard button. This is the trust mechanism — user can verify exactly what we'd send.

### 4.4 Trial vs paid behaviour

- **Trial users**: telemetry default-ON. Consent screen shown on first launch but with the box pre-checked. They can untick.
- **Paid customers**: same default-ON behaviour. Consent doesn't change at activation.
- **All customers**: can flip off any time. There is no "premium tier without telemetry" — being a paid customer doesn't reduce diagnostics either way.

(Side note: the privacy policy says we may use aggregated, de-identified usage data to improve the product. That's exactly what this gives us.)

---

## 5. TYPES OF DIAGNOSTIC ACTIONS

Beyond passive telemetry, the user (and support staff) can pull manual diagnostic dumps.

### 5.1 User-initiated "Send diagnostic" button

In Settings → Help. Clicked when contacting support:

1. Bundles the last 100 telemetry events from local queue
2. Adds 50 lines of recent app logs (tail of `~/.config/duka/logs/duka.log`)
3. Adds machine info (OS, version, disk)
4. POSTs to `/api/telemetry/events` with `manual_diagnostic` event type
5. Returns a reference ID like `DIAG-2026-01-15-A4B2C8` to show user
6. User can paste that ID into a WhatsApp message to support

Server-side: Payload creates a `TelemetryEvent` with severity='info' and a reference ID. Owner can search by ref ID in admin.

### 5.2 Owner-initiated "request dump"

Owner can mark a license in admin: "request_diagnostic = true". On next heartbeat, the desktop app sees this flag in the response and triggers an automatic dump. Useful when a customer says "it's broken" but can't navigate to the diagnostic button.

This is documented behaviour — listed in the privacy policy.

### 5.3 Crash auto-dump

When the app catches a panic (Rust `panic_hook`), it:
1. Writes the panic + stack trace to local crash log
2. Tries to send a `crash` event immediately (with a 2s timeout)
3. On next launch, reads any unsent crash log and sends it as a `crash` event with `recovered=true`

---

## 6. RATE LIMITS

To prevent a buggy desktop install from spamming the server.

Server-side (Payload):
- **Per machine token**: 1000 events/hour, 10000/day
- **Per IP**: 5000 events/hour (catches misconfigured shared IPs)
- **Body size**: 256 KB max
- **Connection rate**: 30 req/min per token

Client-side (Rust):
- Drop debug events when queue > 500 entries
- Drop info events when queue > 800 entries
- Drop warn events when queue > 1000 entries
- Errors and fatals are NEVER dropped (they push out lower-severity events instead)

When server returns 429, client respects `Retry-After` header.

---

## 7. SCHEMA EVOLUTION

How we add new event types without breaking old clients.

- Every event has a `schema_version` field, default `1`.
- New required fields → bump version.
- Server-side endpoint accepts any version it has a parser for. Older versions sit in a compatibility shim that fills in defaults.
- Client always sends its current version; never tries to send "v2 if available".
- Once all clients in the wild are on a new version (visible in Machines.currentVersion telemetry), the old shim can be deprecated.

---

## 8. IMPLEMENTATION PLAN (Rust side)

Phase order matters — each step is independently shippable.

### 8.1 Phase A: Plumbing (no events yet)
- Create `src-tauri/src/telemetry/` skeleton
- Add Cargo deps: `reqwest`, `tokio`, `serde`, `chrono`, `ulid`, `tauri-plugin-stronghold`
- Wire `Telemetry` trait + `NoopTelemetry` (used during tests)
- Add Tauri command `telemetry_set_enabled`
- Add Tauri command `telemetry_dump_queue`
- Add Settings UI toggle
- Add unit tests for sanitizer

### 8.2 Phase B: Local store
- Create SQLite table at app start
- Implement `store::enqueue` / `store::take_batch` / `store::delete_batch`
- Implement size-cap enforcement
- Tests: enqueue 10000 events, assert queue stays at cap

### 8.3 Phase C: Dispatcher (offline)
- Implement transport stub that always succeeds locally (no real HTTP)
- Spawn dispatcher task on app start
- Test: enqueue → wait → assert deleted from queue

### 8.4 Phase D: Real transport
- Wire reqwest with TLS
- Add bearer token auth (use stub token initially)
- Test against a Mock Service Worker server (`msw` running locally on dev machine — this repo already has msw in `node_modules`)

### 8.5 Phase E: Real activation flow
- Add `/api/licenses/activate` to Payload (Plan 02 §4.7 already specifies)
- Wire desktop app to call activate on first license check
- Store returned token in stronghold
- Test end-to-end: install → activate → emit event → verify it lands in Payload Telemetry collection

### 8.6 Phase F: Heartbeat aggregator
- Implement `collect_heartbeat` reading SQLite counts
- Schedule task to emit every 30 min
- Tests: synthetic DB with known data → assert counts match

### 8.7 Phase G: Crash auto-capture
- Install panic hook
- Persist panic to crash log
- On next start, drain crash log

### 8.8 Phase H: Manual diagnostic UI
- Settings → Help → "Send diagnostic" button
- Bundles + emits with ref ID
- Show ref ID in toast

### 8.9 Phase I: Owner-requested dump
- Heartbeat response includes `request_diagnostic` flag
- Client respects it and triggers Phase H bundle

Estimate: ~3 days of focused work for an experienced Rust dev. Most of the difficulty is in tests, not code.

---

## 9. PRIVACY POLICY ADDITIONS

The Pages doc at `/privacy` must include these specific statements (review by user before launch):

> ### Diagnostics and telemetry
>
> When you allow diagnostics, the Duka desktop application sends anonymous data to our servers
> to help us understand how the product is used and find bugs. We send:
>
> - The app version and channel (stable/beta)
> - Your operating system and version
> - The module you have active (Pharmacy, Retail, etc.)
> - Counts of branches, users, products, and sales — never the underlying records
> - Errors and crashes, with the file and function where they occurred
> - Network status of the integrations (M-Pesa, eTIMS, SHA) — only whether they are configured, not credentials
>
> We do **not** send:
>
> - Customer or patient names, contact info, or identification numbers
> - Product names or prescription contents
> - Sale amounts, totals, or financial figures
> - Your KRA PIN, SHA registration, or M-Pesa till
> - Anything that identifies your business beyond a randomly-generated machine ID
>
> The data is encrypted in transit (HTTPS) and stored on Cloudflare R2 / Postgres in the EU/US regions.
> Diagnostic data is retained for 12 months for crashes and 90 days for everything else, then deleted.
>
> You can opt out at any time in Settings → Privacy → Anonymous diagnostics. Existing
> diagnostics in your local queue stop being sent immediately. To erase what we already have,
> contact us using the WhatsApp number on this site and we'll delete the records associated with
> your machine within 7 days.

---

## 10. TESTING THE FULL PIPELINE

End-to-end test scenario, performed before first paid customer:

1. Fresh Windows VM. Install Duka.
2. Skip activation (trial).
3. First-launch consent modal → click "Allow".
4. Use the app for 5 minutes (create branches, log a few sales).
5. Open DevTools network tab via Tauri's debug build → confirm POSTs to `/api/telemetry/events` succeed (200) every 60s.
6. In Payload admin → TelemetryEvents → filter by machine → confirm events appear with sanitized payloads.
7. Toggle telemetry OFF in Settings.
8. Use the app for 5 more minutes.
9. Confirm no new events sent.
10. Toggle ON. Confirm queue resumes.
11. Disconnect network. Generate 100 events. Reconnect. Confirm batched send.
12. Force a panic via debug command. Restart app. Confirm crash event sent with `recovered=true`.

All 12 steps must pass before launch.

---

## 11. WHAT'S NEXT

Plan 05 done. Final plan:
- **Plan 06** — Acceptance tests + Visual Bible per page + Performance/Deployment/Admin handoff. Closes out the website spec suite.

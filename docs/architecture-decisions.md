# Architecture Decision Record — Omnix

## ADR-001: Tauri v2 over Electron

**Decision:** Use Tauri v2 as the desktop shell.

**Why:**
- 90% smaller installers (5-10MB vs 100MB+) — critical for Kenyan internet speeds
- 80% less RAM usage — matters on modest pharmacy hardware
- Rust backend gives native SQLite performance, encryption, and system access
- Built-in auto-updater and security model
- Cross-platform (Windows + Linux, macOS bonus)

**Trade-offs:**
- Relies on OS webview (Edge WebView2 on Windows, WebKitGTK on Linux)
- Smaller ecosystem than Electron
- Rust learning curve for backend logic

**Mitigations:**
- WebView2 is pre-installed on Windows 10/11 (our target)
- Community growing rapidly; Tauri 2.x is stable and well-documented
- Rust only needed for backend — frontend stays React/TypeScript

---

## ADR-002: React + Vite over Next.js for Desktop Frontend

**Decision:** Use React with Vite bundler inside Tauri. NOT Next.js.

**Why:**
- Next.js inside Tauri requires static export — loses SSR, API routes, middleware
- Vite dev server is significantly faster (instant HMR vs Next.js cold starts)
- No Node.js server needed — all backend logic lives in Rust
- Simpler build pipeline, native Tauri integration
- Smaller output bundle

**Next.js is used separately** for the marketing site (where SSR/SEO matters).

---

## ADR-003: SQLite + sqlx over Any Other Database

**Decision:** SQLite with the `sqlx` Rust crate. Encrypted via SQLCipher.

**Why:**
- Zero setup — no database server to install/manage
- File-based — simple backup (copy one file)
- Fast for single-user/few-user workloads
- Perfect for offline-first (the database IS the app state)
- SQLCipher adds transparent AES-256 encryption
- sqlx provides compile-time query verification

**Trade-offs:**
- Single-writer limitation (fine for < 10 concurrent users via LAN)
- No built-in replication (we build our own sync protocol)

---

## ADR-004: Zustand over Redux/Context for State Management

**Decision:** Use Zustand for frontend state.

**Why:**
- Minimal boilerplate (no action creators, reducers, dispatchers)
- Works outside React components (useful for IPC handlers)
- Tiny bundle size (~1KB)
- Simple devtools integration
- Supports slices pattern for modular state

---

## ADR-005: shadcn/ui over MUI/Chakra/Custom

**Decision:** shadcn/ui as the component library.

**Why:**
- Copy-paste architecture — you own the code, full customization
- Radix primitives underneath — best accessibility
- Tailwind-native — consistent with our styling approach
- Used by Linear, Vercel, and other design-forward products
- No version-lock or breaking upgrades (it's YOUR code once installed)
- Active community and growing component registry

---

## ADR-006: Single-Tier Licensing (No Standard/Pro/Enterprise)

**Decision:** One product, one price per device. No feature gating.

**Why:**
- Simpler to build, test, and support
- Target market (Kenyan pharmacies) won't pay enterprise prices
- Avoids "which features are in which tier" confusion
- Revenue scales with device count (LAN expansion)
- Can always add tiers later if market demands it

**Model:**
- Buy license → get full product for 1 device
- Need more POS stations? Buy additional device licenses
- Updates included for 1 year, then optional renewal

---

## ADR-007: LAN Sync Built Last (Phases 8-9)

**Decision:** Build single-device fully first, add LAN networking in final phases.

**Why:**
- Single-device is the simplest deployment (most pharmacies start here)
- All core features must work standalone before adding sync complexity
- Networking is hard — doing it last means the data model is stable
- Easier to test: verify single-device correctness first

**Architecture prepared from Phase 0:**
- Database schema designed for multi-device from day one (device_id columns)
- Commands structured to accept device context
- No technical debt when LAN is added

---

## ADR-008: Paystack (Not Daraja) for M-Pesa

**Decision:** Use Paystack's mobile money channel for M-Pesa STK push.

**Why:**
- Paystack handles Safaricom compliance, KYC, and settlements
- Single integration covers M-Pesa + cards (future)
- Better documentation and developer experience than Daraja
- Paystack is already licensed in Kenya
- Fallback: manual M-Pesa recording always works offline

**Trade-offs:**
- Paystack takes a fee per transaction (1.5% + KES 7)
- Requires internet for automated M-Pesa
- Pharmacy must have Paystack account

**Mitigation:**
- Cash sales are always offline/free
- Manual M-Pesa recording (enter transaction code) is free
- Only pharmacies wanting auto-confirmation need Paystack

---

## ADR-009: No Monorepo (For Now)

**Decision:** Omnix desktop app is a standalone project. Marketing site is separate.

**Why:**
- Different tech stacks (Tauri+Vite vs Next.js)
- Different deployment targets (local installer vs Vercel)
- Different development velocity (desktop is slower, more careful)
- Monorepo tooling (Turborepo, Nx) adds complexity we don't need yet
- Can always consolidate later when shared code warrants it

**Shared code strategy:**
- If shared types/logic emerge, extract to a published npm package
- For now, keep things simple and independent

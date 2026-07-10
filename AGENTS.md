# AGENTS.md — Omnix Project Rules

Every AI agent working on this project must follow these rules without exception.

---

## 0. Product Identity

- **Product:** Omnix
- **First Module:** Dawa (Pharmacy Management)
- **Architecture:** Tauri v2 desktop app + React (Vite) frontend + SQLite backend
- **Target:** Kenyan SME pharmacies (single + same-network chains)
- **Pricing:** Single tier, per-device license. No Standard/Pro/Enterprise.

---

## 1. Technology Stack (Do Not Substitute)

### Desktop App (Primary Product)
| Layer | Technology | Version |
|-------|-----------|---------|
| Shell | Tauri | v2.x |
| Frontend | React | v18+ |
| Bundler | Vite | v5+ |
| UI Components | shadcn/ui + Radix | latest |
| Styling | Tailwind CSS | v3.x |
| Icons | Lucide React | latest |
| State | Zustand | v4+ |
| Tables | @tanstack/react-table | v8+ |
| Command Palette | cmdk | latest |
| Routing | react-router-dom | v6+ |
| Animations | Framer Motion | latest |
| Validation | Zod | latest |
| Backend | Rust | stable |
| Database | SQLite via sqlx | latest |
| Encryption | AES-256 for backups (`age`); SQLite database itself relies on Windows account controls |

### Marketing/Subscription Site (Separate Repo)
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Hosting | Vercel |
| Payments | Paystack |
| CMS | Payload CMS 3.x |

### Forbidden
- Electron (use Tauri)
- Next.js inside Tauri (use Vite)
- MUI, Chakra, Ant Design (use shadcn/ui)
- Prisma inside desktop app (use sqlx in Rust)
- Any ORM on the JS side for local DB
- MongoDB (use SQLite)
- Firebase/Supabase for the desktop app

---

## 2. Architecture Rules

### Separation of Concerns
```
React (Frontend)          Rust (Backend)
─────────────────         ──────────────────
UI rendering              SQLite access
User interactions         Business logic
State management          Data validation
Component composition     File system operations
                          Machine fingerprinting
                          Encryption/hashing
                          LAN server
                          Print system
```

### IPC Bridge
- Frontend calls Rust via Tauri `invoke()` commands
- Rust commands live in `src-tauri/src/commands/`
- Every command is typed with TypeScript bindings
- Never access SQLite from JavaScript directly

### Database
- All schema changes via numbered migrations: `src-tauri/migrations/001_initial.sql`
- Never use raw SQL in command handlers — use query functions in `src-tauri/src/db/`
- All IDs are UUIDs (v4)
- All timestamps are UTC ISO 8601
- Soft-delete preferred (add `deleted_at` column)

---

## 3. UI Design Rules

### Style: Linear/Notion-grade desktop app

**DO:**
- Flat, borderless design
- Generous whitespace (8px grid)
- Collapsible sidebar navigation
- Command palette (Ctrl+K) for global search
- Keyboard shortcuts for all major actions
- Contextual slide-out panels
- Dense but breathable data tables
- Subtle micro-animations (framer-motion)
- Dark + light mode (system-aware)
- Inter font for UI text
- Monospace for numbers, codes, prices

**DO NOT:**
- Drop shadows on cards
- Gradient buttons or backgrounds
- Modal dialogs for data entry (use slide-out panels)
- Rounded corners > 8px (keep it architectural)
- Emoji icons anywhere
- Auto-playing anything
- Loading spinners > 200ms without skeleton
- Color-coding without text label backup

### Color System
- One accent color (configurable per business, default: blue-600)
- Neutral grays for structure
- Semantic colors: success (green), warning (amber), error (red)
- Never use color as the only differentiator

### Density
- Default: comfortable (40px row height in tables)
- Compact option: 32px row height
- POS screen: optimized for speed, larger touch targets

### Data tables & selection (ALWAYS — no exceptions)
- **Every data table must be searchable AND paginated.** Never render an unbounded list of rows. Add a search/filter input and pagination (or virtualized/infinite scroll) from the start — even if the current dataset is small, it will grow.
- **Never use a plain `<Select>` for lists that can grow large** (staff, customers, products, suppliers, accounts, etc.). Use a **searchable combobox** (type-to-filter). Plain selects are only acceptable for short, fixed enums (e.g. status, unit type).
- Empty states are procedural: when a picker/table has nothing to choose, show a CTA that creates the missing thing (and routes the user there), never a dead empty dropdown.
- Forms: do not cram multiple inputs/selects into a single tight row. Group related fields, give them room (labels above inputs, sensible widths), and prefer a dialog or well-spaced section over an inline strip of controls.

---

## 4. Code Conventions

### TypeScript (Frontend)
- Strict mode enabled
- No `any` types
- Named exports (no default exports)
- Components: PascalCase files, one component per file
- Hooks: `use` prefix, separate files in `hooks/`
- Stores: one file per domain in `stores/`

### Rust (Backend)
- Use `clippy` with default lints
- Error handling: `thiserror` for library errors, `anyhow` for app errors
- Commands return `Result<T, String>` for Tauri IPC
- Database queries in dedicated modules, not inline

### Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Scope by phase or module: `feat(pos): add hold/recall`

---

## 5. Offline-First Rules

- The app must work with zero internet connection at all times
- Never assume network availability for core operations
- Internet-required features (Paystack, updates, activation) must:
  - Check connectivity first
  - Show clear offline state
  - Queue operations for when internet returns (where possible)
  - Never block the UI waiting for network

---

## 6. File Organization

```
omnix/
├── src/                        # React frontend
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # shell, sidebar, topbar
│   │   ├── pos/               # POS-specific components
│   │   ├── inventory/         # inventory components
│   │   ├── pharmacy/          # Dawa module components
│   │   └── shared/            # reusable business components
│   ├── pages/                 # route pages
│   ├── hooks/                 # custom hooks
│   ├── stores/                # zustand stores
│   ├── lib/                   # utilities, constants, types
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/          # one file per domain
│   │   ├── db/                # schema, queries, migrations runner
│   │   ├── models/            # Rust structs matching DB
│   │   ├── services/          # business logic
│   │   └── licensing/         # fingerprint, validation
│   ├── migrations/            # numbered SQL files
│   └── Cargo.toml
├── docs/                      # phase plans, architecture
├── .claude/mcp.json
├── AGENTS.md
└── package.json
```

---

## 7. Performance Targets

- App startup: < 2 seconds to interactive
- POS item search: < 50ms response
- Sale completion: < 100ms (DB write)
- SQLite queries: indexed on all WHERE/JOIN columns
- Frontend bundle: < 500KB gzipped (initial load)
- Memory usage: < 150MB RAM in normal operation

---

## 8. Security Rules

- Never store passwords in plaintext (use Argon2)
- Database backups encrypted with AES-256 via age; SQLite itself relies on OS-level protection
- License file RSA-signed, validated on startup
- Tauri CSP: no inline scripts, no external loads
- API keys encrypted at rest (AES-256)
- Never log sensitive data (passwords, license keys, Paystack keys)
- Audit log for: user changes, voids, stock adjustments, login attempts

---

## 9. Testing Requirements

- Rust: unit tests for all business logic and DB queries
- React: component tests for critical flows (POS, auth)
- Integration: Tauri command tests (invoke from test harness)
- No e2e framework mandated yet — add in Phase 10

---

## 10. What NOT to Build

- No cloud database (SQLite only)
- No user registration/signup (owner creates all users locally)
- No multi-tenancy (one business per installation)
- No mobile app (desktop only, LAN browser for remote access)
- No subscription billing in the app (handled by marketing site)
- No AI features in v1
- No multi-language in v1 (English only, i18n-ready structure)

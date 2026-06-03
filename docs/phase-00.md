# Phase 0 — Tooling & Project Setup

## Goals
- Scaffold Tauri v2 + React (Vite) project
- Install all dependencies and dev tooling
- Configure AI skills and MCP servers
- Set up linting, formatting, and commit conventions

## Tasks

### 0.1 Scaffold the project
```bash
pnpm create tauri-app omnix --template react-ts --manager pnpm
```
- Tauri v2 with React + TypeScript + Vite
- Rust backend bootstrapped automatically

### 0.2 Install core dependencies (frontend)
- `shadcn/ui` — component library (init with default style)
- `@radix-ui/react-*` — headless primitives (comes with shadcn)
- `tailwindcss` + `postcss` + `autoprefixer`
- `framer-motion` — micro-interactions
- `lucide-react` — icons
- `react-router-dom` — client-side routing
- `zustand` — lightweight state management
- `@tanstack/react-table` — data tables
- `@tanstack/react-query` — async state (for LAN queries later)
- `cmdk` — command palette (Ctrl+K)
- `sonner` — toast notifications
- `vaul` — drawer component
- `date-fns` — date utilities
- `zod` — schema validation

### 0.3 Install core dependencies (Rust backend)
- `sqlx` — async SQLite with compile-time checks
- `serde` + `serde_json` — serialization
- `tauri-plugin-sql` — official Tauri SQL plugin
- `bcrypt` or `argon2` — password hashing
- `uuid` — ID generation
- `chrono` — date/time handling
- `tokio` — async runtime (comes with Tauri)

### 0.4 Configure dev tooling
- ESLint + Prettier (frontend)
- `clippy` + `rustfmt` (Rust)
- Conventional commits via `commitlint`
- Husky pre-commit hooks

### 0.5 Install AI skills & MCPs
See `docs/skills-and-mcps.md`

### 0.6 Project structure after Phase 0
```
omnix/
├── src/                    # React frontend
│   ├── components/
│   │   └── ui/            # shadcn components
│   ├── layouts/
│   ├── pages/
│   ├── hooks/
│   ├── stores/            # zustand stores
│   ├── lib/               # utilities
│   └── main.tsx
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/      # Tauri IPC commands
│   │   ├── db/            # SQLite schema + queries
│   │   ├── models/        # data models
│   │   └── services/      # business logic
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .claude/
│   └── mcp.json
├── docs/
├── AGENTS.md
└── package.json
```

## Done When
- `pnpm tauri dev` launches the app with a blank shell
- SQLite database initializes on first run
- shadcn components render correctly
- Command palette (Ctrl+K) opens empty
- All MCPs respond correctly

# Phase 1 — Core Engine

## Goals
- Authentication system (local, offline)
- Database schema foundation
- App shell with navigation
- Settings system
- Business type lock (Pharmacy on first run)

## Tasks

### 1.1 Database Schema (Core Tables)
```sql
-- Users & Auth
users (id, username, full_name, role, password_hash, pin, active, created_at)
sessions (id, user_id, device_id, started_at, expires_at)

-- Business Configuration
business (id, name, type, address, phone, email, logo, locked_at, created_at)
settings (key, value, category, updated_at)

-- Devices
devices (id, fingerprint, name, role, approved, last_seen)
```

### 1.2 Authentication
- Login with username + password (first time setup creates owner)
- Optional PIN for quick re-auth (cashier switching)
- Role-based access: Owner, Manager, Cashier, Viewer
- Session management (auto-lock after inactivity)
- All passwords hashed with Argon2 in Rust

### 1.3 App Shell UI
- Collapsible sidebar navigation (Linear-style)
- Top bar: current user, notifications, quick actions
- Command palette (Ctrl+K): search everything
- Dark + light mode toggle (system-aware default)
- Responsive layout for different screen sizes

### 1.4 First-Run Setup Wizard
1. Welcome screen
2. Business name + details
3. Select business type → Pharmacy (locked permanently)
4. Create owner account
5. Generate machine fingerprint
6. Complete → lands on dashboard

### 1.5 Settings System
- Key-value store with categories
- Business profile settings
- Display preferences (theme, density, language)
- Printer configuration
- Receipt template settings

## UI Design Principles (applies to ALL phases)
- Flat, borderless design — no drop shadows on cards
- Generous whitespace, 8px grid
- One accent color (adjustable per business)
- Keyboard shortcuts for every major action
- Dense data tables with comfortable row height
- Contextual slide-out panels (not modal popups)
- Subtle hover states and micro-animations
- Inter font for UI, system monospace for numbers/codes

## Done When
- Owner can create account on first run
- Business type locks to Pharmacy
- App shell renders with sidebar + command palette
- Multiple users can be created with roles
- Settings persist across restarts
- PIN-based quick login works

# Phase 10 — Polish & Distribution

## Goals
- Professional installer for Windows/Linux
- Auto-update system
- Onboarding wizard refinement
- Performance optimization
- Production hardening

## Tasks

### 10.1 Installer
- **Windows:** NSIS or WiX installer (.msi)
  - Desktop shortcut
  - Start menu entry
  - Uninstaller
- **Linux:** AppImage + .deb package
- Installer size target: < 15MB (Tauri advantage)
- Splash screen during first-time setup

### 10.2 Auto-Update
- Tauri's built-in updater plugin
- Update server: simple static file hosting (GitHub Releases or own server)
- Update flow:
  1. App checks for updates on startup (if internet available)
  2. Notification: "Update available (v1.2.0)"
  3. User confirms → downloads in background
  4. Installs on next restart
- Never interrupts active work
- Updates respect license `updatesUntil` date

### 10.3 Data Migration Tool
Most pharmacies switching from Excel or another POS need to import existing data:
- **Products import:** CSV/Excel template (name, barcode, category, buying price, selling price, stock qty, expiry)
- **Customers import:** CSV (name, phone, balance)
- **Suppliers import:** CSV (name, contact, phone)
- Validation: check for duplicates, missing required fields
- Preview before commit: "178 products will be imported, 3 have errors"
- Rollback: can undo import within 24 hours

### 10.4 Onboarding Polish
- Guided tour on first login (highlight key features)
- Sample data option ("Load demo pharmacy data")
- Quick-start checklist:
  - [ ] Add your first product
  - [ ] Configure receipt header
  - [ ] Make your first sale
  - [ ] Set up a price list
- Tooltip hints on first use of each feature

### 10.4 Performance Optimization
- SQLite query optimization (indexes on hot paths)
- Virtual scrolling for large product lists
- Lazy-load heavy components (reports, charts)
- Image compression for product photos
- Startup time target: < 2 seconds to interactive

### 10.5 Error Handling & Recovery
- Graceful error boundaries (never show raw stack trace)
- Database corruption recovery (restore from last backup)
- Crash reporting (opt-in, sends to your server)
- Helpful error messages with suggested actions

### 10.6 Accessibility
- Keyboard navigation throughout
- Screen reader support for critical flows
- High contrast mode option
- Font size scaling

### 10.7 Documentation
- In-app help system (searchable)
- Keyboard shortcuts reference (? key)
- PDF user manual (generated from docs)

## Done When
- Installer works cleanly on fresh Windows 10/11 and Ubuntu 22+
- Auto-update downloads and installs correctly
- Onboarding guides a new user to first sale without external help
- App starts in under 2 seconds
- No unhandled errors in normal usage
- Keyboard-only operation possible for all critical flows

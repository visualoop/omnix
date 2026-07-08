# Omnix

[![Build (Windows)](https://github.com/visualoop/omnix/actions/workflows/build.yml/badge.svg)](https://github.com/visualoop/omnix/actions/workflows/build.yml)

**Offline-first ERP platform for Kenyan SMEs.**

Omnix is built as a modular platform. Each business vertical is delivered as a module that
plugs into the same core (inventory, sales, customers, suppliers, accounting, payments, tax,
licensing, multi-device sync).

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| **Core** | ✅ Built | Inventory, POS, customers, suppliers, purchases, accounting, reports |
| **Dawa** (Pharmacy) | ✅ Built | Prescriptions, expiry, drug interactions, controlled substances, patient profiles |
| **Retail** (Soko) | ✅ Built | Variants, price lists, loyalty, promotions, layby, shelf labels |
| **Hardware & Equipment** | ✅ Built | Bulk pricing, contractor accounts, quotations, delivery notes — plus serialized equipment units, specs, per-unit warranty & rental |
| **Hospitality** | ✅ Built | Tables, KOT/kitchen, recipe costing, rooms, bookings, folios |
| **Electronics** | 🗓️ Planned | IMEI/serial tracking, warranty, repairs |
| **Salon / Spa** | 🗓️ Planned | Appointments, services, staff commissions |

The first module shipping is **Dawa** because pharmacy compliance (KRA eTIMS + SHA insurance)
is the most demanding regulatory load in Kenya — get that right and other verticals fall out
of the same engine.

## Core features (every module)

- POS with M-Pesa STK push (Paystack), cash, bank, and per-customer credit
- Full procurement: suppliers, purchase orders, goods received notes
- Inventory with batches, expiry, stock take, sale returns
- Customer management with credit limits and lifetime stats
- Accounting: expenses, P&L, cash register, receivables
- KRA eTIMS auto-signing of every sale + VAT3 return generation
- SHA + private insurance claims with member verification and copay split
- Per-machine RSA-signed licensing
- Auto-backup with restore + audit log
- Auto-update via signed GitHub Releases
- LAN multi-device sync (master/client)
- Real auth (Argon2), users with roles
- Drug interaction checks (Dawa module)
- Patient profiles with allergies (Dawa module)

## Pricing

KES 30,000 one-time license + KES 12,000/year for compliance updates.
Buy at [omnix.co.ke](https://omnix.co.ke).

## Tech

Tauri v2 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · SQLite (tauri-plugin-sql) ·
Rust (axum, sqlx, argon2, rsa).

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

CI builds Windows installers on every push. See [docs/CI_SECRETS.md](docs/CI_SECRETS.md) for
required GitHub Actions secrets.

To cut a release:
```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow builds, signs, and publishes a GitHub Release with the MSI/EXE installers
plus the `latest.json` manifest the in-app updater reads.

# Omnix — Master Build Plan

## Product Identity

- **Name:** Omnix
- **Tagline:** The operating system for your business
- **First Module:** Dawa (Pharmacy Management)
- **Target:** Single pharmacies and same-network pharmacy chains in Kenya
- **Pricing:** KES 30,000 license + KES 12,000/year maintenance (first year included)
- **Target:** Single-location pharmacies (1-5 staff), NOT chains

## Architecture Summary

- **Desktop App:** Tauri v2 + React (Vite) + SQLite
- **Admin Dashboard:** Embedded in desktop app + accessible via LAN browser
- **Marketing/Subscription Site:** Independent Next.js app (separate repo, built later)
- **LAN Networking:** Built in final phases, single-device works standalone first

## Phase Overview

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 0 | Tooling & Project Setup | Repo, dependencies, CI, skills/MCPs |
| 1 | Core Engine | Auth, DB, settings, base UI shell |
| 2 | Inventory, Pricing, Suppliers, Customers | Products, stock, pricing engine, suppliers/POs, customers/credit, tax |
| 3 | POS Engine | Billing, payments, receipts |
| 4 | Pharmacy Module (Dawa) | Prescriptions, controlled drugs, supplier management |
| 5 | Reporting & Analytics | Sales, stock, profit, expiry alerts |
| 5B | Accounting & Finance | Expenses, P&L, cash register, financial dashboard |
| 6 | Payments Integration | Paystack + M-Pesa, cash recording, custom methods |
| 6B | **KRA eTIMS Compliance** | Tax invoices, VSCU signing, QR codes (LEGALLY REQUIRED) |
| 6C | **Insurance Claims (SHA/SHIF)** | Member verification, claims, copay, tracking |
| 7 | Licensing & Security | Machine fingerprint, license validation, encryption |
| 8 | LAN Multi-Device | Server node, client sync, device management |
| 9 | Admin Dashboard | User mgmt, device control, config, reports |
| 10 | Polish & Distribution | Installer, auto-update, onboarding wizard, data migration |

See individual phase files: `docs/phase-XX.md`

## Key Design Files
- `docs/core-modules.md` — All ERP modules and the module hook system
- `docs/architecture-decisions.md` — Why we chose each technology
- `docs/ui-design-reference.md` — Visual standards and POS layout
- `docs/skills-and-mcps.md` — AI tooling setup
- `docs/phase-06b-etims.md` — KRA eTIMS tax compliance (MANDATORY)
- `docs/phase-06c-insurance.md` — SHA/SHIF insurance claims
- `docs/phase-05b-accounting.md` — Basic accounting & finance

## Competitive Positioning
- **Direct competitor:** PharmaSync (KES 5,999/month subscription, cloud-based)
- **Our advantage:** KES 30K one-time + KES 12K/year, offline-first, own your data
- **Year 1 target:** 35 pharmacies = KES 1,050,000
- **Recurring by Year 3:** KES 480K/year from renewals alone
- **Kenya market:** 12,000+ registered pharmacies, 3,000+ in Nairobi alone
- See `docs/pricing-and-business.md` for full strategy

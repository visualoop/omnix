# SokoOS

[![Build (Windows)](https://github.com/justinelut/sokoOS/actions/workflows/build.yml/badge.svg)](https://github.com/justinelut/sokoOS/actions/workflows/build.yml)

**Offline-first ERP for Kenyan SMEs.** Started with the **Dawa** module for pharmacies — KRA eTIMS compliant, SHA insurance integrated, M-Pesa via Paystack, single-tier pricing.

## Features

- **POS** with M-Pesa STK push (Paystack), insurance copay split, drug interaction warnings
- **Pharmacy module:** prescriptions, expiry alerts, controlled substances log, patient profiles with allergies
- **KRA eTIMS** auto-signing of every sale + VAT3 return generation
- **SHA + private insurance** (Jubilee, AAR, CIC, Madison, Britam, APA, UAP) — verify members, generate claims, batch submission
- **Procurement** — suppliers, purchase orders, goods received notes
- **Stock take** with variance and adjustment
- **Returns/refunds** with restock workflow
- **Multi-device LAN** sync (master/client mode with mDNS discovery)
- **Per-machine licensing** with RSA-signed keys
- **Auto-backup** with restore + audit log
- **Auto-update** signed via GitHub Releases

## Tech

Tauri v2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + SQLite (via tauri-plugin-sql) + Rust (axum, sqlx, argon2, rsa)

## Development

```bash
pnpm install
pnpm tauri dev
```

Frontend dev (no Tauri): `pnpm dev` (DB calls won't work — Tauri bridge required).

## Build

CI builds Windows installers on every push. See [docs/CI_SECRETS.md](docs/CI_SECRETS.md) for the
required GitHub Actions secrets.

To cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow will build, sign, and publish a GitHub Release with the MSI/EXE installers.

## License

Proprietary. Pricing: KES 30,000 one-time license + KES 12,000/year for compliance updates.

Visit [sokoos.co.ke](https://sokoos.co.ke) for purchase.

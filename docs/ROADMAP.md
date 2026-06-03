# Duka (formerly Omnix) — Master Roadmap

This is the index. Each line links to a plan file.
The desktop application is feature-complete (Phases 1–8). The website + ops platform is now fully planned across 6 documents and implementation can begin.

> **Brand transition**: project codename `Omnix` is being retired in favour of `Duka` (Swahili for shop). The brand name lives in a single TypeScript constant; swapping is a one-line edit.

---

## Reading order — desktop (already shipped)

1. **[00-current-state.md](./plans/00-current-state.md)** — what's shipped in v0.1.6, what works
2. **[01-native-ui-polish.md](./plans/01-native-ui-polish.md)** — every shadcn component made to feel native ✅
3. **[02-core-erp-gaps.md](./plans/02-core-erp-gaps.md)** — Kenyan SME features (branches, banking, HR, payroll) ✅
4. **[03-employees-hr.md](./plans/03-employees-hr.md)** — staff, contracts, payroll, NSSF/SHIF/PAYE ✅
5. **[04-dawa-pharmacy-completion.md](./plans/04-dawa-pharmacy-completion.md)** — Dawa production-complete ✅
6. **[05-soko-retail-module.md](./plans/05-soko-retail-module.md)** — Retail module (mini-mart, hardware, duka) ✅

## Reading order — website + ops platform (planned, ready to implement)

7. **[../website/01-mission-stack.md](./website/01-mission-stack.md)** — mission, stack, brand rules, UI direction (Linear/Stripe/Vercel anchors)
8. **[../website/02-collections-data-model.md](./website/02-collections-data-model.md)** — Payload CMS: 14 collections + 4 globals, hooks, indexes
9. **[../website/03-pages-and-dashboards.md](./website/03-pages-and-dashboards.md)** — every route, marketing pages, customer dashboard, admin extensions
10. **[../website/04-cicd-release-pipeline.md](./website/04-cicd-release-pipeline.md)** — CircleCI → R2 → Payload Releases auto-creation, Tauri auto-updater
11. **[../website/05-telemetry-sdk.md](./website/05-telemetry-sdk.md)** — Tauri Rust telemetry SDK, opt-out, privacy contract
12. **[../website/06-acceptance-visual-bible.md](./website/06-acceptance-visual-bible.md)** — visual bible, performance budgets, deployment, admin handoff, acceptance scenarios

---

## Working agreement

- No more `git push` until user explicitly approves
- No more triggering CI builds (out of GitHub Actions minutes)
- Work feature-by-feature locally; we only test by running the desktop app
- All plan files split small enough to be re-read on demand without burning context
- After each completed batch, update `docs/plans/CHANGELOG.md` with what shipped locally
- Website plans live in `docs/website/`. They are the next implementation track.

---

## Status snapshot

| Layer | State |
|---|---|
| Core ERP | ✅ 100% — branches, banking, HR, payroll, accounting all live |
| Dawa Pharmacy | ✅ 100% — production-ready, all PPB/SHA/eTIMS gaps closed |
| Retail (Soko) | ✅ 100% — mini-mart, hardware-lite, duka use cases working |
| Native UI feel | ✅ 100% — global polish landed |
| RBAC | ✅ 100% |
| Licensing + Trial | ✅ 100% |
| Multi-device LAN | ✅ 100% |
| **Website (Phase 9)** | 📋 **fully planned** — implementation pending |
| Telemetry SDK (desktop) | 📋 planned — depends on Phase 9 site being live |
| CI → Payload pipeline | 📋 planned — depends on Phase 9 site |
| Public Paystack checkout | 📋 planned — Phase 9 |
| Owner admin dashboards | 📋 planned — Phase 9 |

---

## Next action

Implementation of **Phase 9 (Website + ops platform)** can begin per the 6-document plan suite in `docs/website/`. First task: scaffold `pnpm dlx create-payload-app@latest duka-web` per Plan 01 § 1.

Phase 10 (telemetry SDK rollout to desktop) depends on Phase 9 endpoints being live and starts after the website is in production.

# Tracker task 18 — Android vertical route ownership

This worktree owns the responsive Android phone/tablet conversion of the Dawa, Retail, Hardware, Hospitality, and Salon operational routes listed below. The conversion is presentation-only: existing typed services, domain rules, permissions, compliance feature flags, branch state, offline behavior, and POS/hub authority remain the source of truth.

## Owned route inventory

| Vertical | Route or hub surface | Primary implementation | Android treatment |
| --- | --- | --- | --- |
| Dawa | Dawa prescription/dispense hub | `src/pages/pharmacy.tsx` | Searchable server-paged prescription cards below `lg`; desktop table retained; touch-safe safety/POS handoff |
| Dawa | Patients and patient detail | `src/pages/patients.tsx`, `src/pages/patient-profile.tsx` | Server-paged directory cards, responsive clinical sections, country phone examples, 44px actions |
| Dawa | Prescription detail | `src/pages/prescription-detail.tsx` | Phone line-item cards and refill/sale sections; desktop detail table retained |
| Dawa | Expiry operations | `src/pages/expiry.tsx` | Searchable server-paged batch cards, wrapped date windows, permission-aware write-off/disposal |
| Dawa | Insurance claims and batches | `src/pages/claims.tsx` | Search/filter cards, bounded batch list, full-width phone detail surface |
| Dawa | Recalls | `src/pages/recalls.tsx` | Searchable paged recall cards, role-aware closure, local disabled issue-recall placeholder |
| Dawa | Controlled register | `src/pages/controlled-register.tsx` | Country/role-gated searchable daily cards with bounded pages; statutory export keeps the full day |
| Retail | Insights and price lookup | `src/pages/retail-dashboard.tsx` | Read-only price lookup cards using existing inventory queries and active-country money formatting |
| Retail | Laybys | `src/pages/retail-laybys.tsx` | Server-paged cards, full-width detail workflow, country-enabled tenders |
| Retail | Special orders | `src/pages/retail-special-orders.tsx` | Searchable paged cards, phone sheet, country-aware contact and money fields |
| Retail | Promotions | `src/pages/promotions.tsx` | Server-paged offer cards, stacked forms, permission-aware mutation actions |
| Retail | Shrinkage | `src/pages/retail-shrinkage.tsx` | Server-paged incident cards, bounded summaries, full-width entry sheet |
| Hardware | Quotations, deliveries, contractor accounts, commissions | `src/pages/hardware.tsx` | Searchable bounded cards for each growth list; desktop tables retained |
| Hardware | Equipment, warranty, service/workshop, rentals | `src/pages/hardware.tsx` | Search/filter cards, bounded pages, touch-safe sheets/dialogs and status actions |
| Hardware | Quotation and contractor details | `src/pages/quotation-detail.tsx`, `src/pages/contractor-detail.tsx` | Phone line/ledger cards, responsive totals/KPIs, paged ledger |
| Hospitality | Tables, menu, orders, KOT/kitchen, recipes | `src/pages/hospitality.tsx` | Searchable bounded phone cards and kitchen queues; desktop tables retained |
| Hospitality | Rooms, bookings, housekeeping, folios | `src/pages/hospitality.tsx` | Phone booking agenda, room/folio cards, bounded pages, active-country payment methods |
| Hospitality | Dining area/table and room/type/menu details | `src/pages/area-detail.tsx`, `src/pages/table-detail.tsx`, `src/pages/room-detail.tsx`, `src/pages/room-type-detail.tsx`, `src/pages/menu-item-detail.tsx` | Responsive KPIs/actions, phone order cards, stacked stay/history rows and full-width editing surfaces |
| Hospitality | Full-screen KDS | `src/pages/kitchen-display.tsx` | Single-column phone tickets, responsive station columns on larger screens, wrapped 44px controls |
| Hospitality | Direct reservations and housekeeping | `src/pages/reservations.tsx`, `src/pages/room-status.tsx` | Searchable paged agenda/room cards, country phone placeholder, procedural setup CTA |
| Hospitality | Hub mapping | `src/pages/hub-modules.tsx` | Housekeeping tab uses `HospitalityHousekeepingPage`, not the generic rooms page |
| Salon | Day/week agenda and appointment workflow | `src/pages/salon.tsx` | Searchable paged phone agenda below `lg`; desktop calendar retained; full-width booking/detail workflows |
| Salon | Clients, services, staff, resources | `src/pages/salon.tsx` | Searchable bounded cards and retained desktop tables |
| Salon | Packages/memberships, commissions, staff earnings | `src/pages/salon.tsx` | Searchable/paged cards, permission-aware payouts, retained desktop reports |

Owned supporting components are `src/components/hardware/**`, `src/components/hospitality/**`, the Dawa workflow components changed under `src/components/pharmacy/**`, `src/components/shared/module-kit.tsx`, `src/components/shared/operational-context.tsx`, and `src/components/pagination-bar.tsx`. Typed server paging remains in `src/services/paged.ts`; bounded already-loaded service arrays use `src/hooks/use-client-pagination.ts` without replacing their domain services.

## Responsive and operational contract

- Growth lists are searchable and paginated: server-backed Dawa/Retail lists use `useListData`; already-loaded Hardware/Hospitality/Salon lists use `useClientPagination`. Live KDS work queues remain fully visible and scroll within their station rather than hiding active tickets behind pagination.
- Phone record views use cards/agendas below `lg`; existing desktop tables/calendars remain from `lg` upward. Forms stack on phones, sheets use the full available width, and primary/search/record controls expose a 44px target.
- Empty states explain the next procedure and expose a create/configure/navigation action when the current role can perform it.
- `OperationalContext` shows active branch and offline/sync state. It is intrinsic to `ModuleMasthead` for Hardware, Hospitality, and Salon and is explicit on standalone Dawa, Retail, and Hospitality detail routes.
- Active-country helpers provide money symbols, phone placeholders, and payment methods. `sha` and `ppb_register` continue to gate Kenya-specific clinical/statutory surfaces.
- Route/hub visibility and local action visibility use central permissions. Service-layer `requirePermission` checks remain authoritative.

## Authority invariants

The UI does not complete regulated dispensing or settlement locally. These typed handoffs remain authoritative:

- Dawa prescription: `preparePrescriptionForPosCheckout`
- Retail layby: `prepareLaybyForPosCheckout`
- Retail special order: `prepareSpecialOrderForPosCheckout`
- Hardware quotation: `prepareQuoteForPosCheckout`
- Hospitality order: `prepareOrderForPosCheckout`
- Salon appointment: `prepareAppointmentForPos`
- Salon package/membership: `preparePackageForPos`

The resulting payload is staged for the existing POS route; no alternative quick-fulfil, payment, or regulated bypass was added.

## Explicitly unowned and unchanged

`src/App.tsx`, `src/components/layout/**`, all POS pages/components, package-manager files, Cargo/Rust/Tauri files, CI workflows, and website files are outside this task and must not be modified. This worktree does not install dependencies, run a server, or perform Git history/remote operations.

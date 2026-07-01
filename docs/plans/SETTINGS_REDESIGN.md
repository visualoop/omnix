# Settings Redesign Plan

## The problem

The current settings surface has 24 items across 6-8 groups. **The "Operations" group holds 14 of them** — everything from AI keys to LAN mode to auto-print to audit log to legacy licence viewer. That group is doing too much work and the user's complaint is accurate: *everything is everywhere*.

Concrete symptoms:
- **Grouping is arbitrary.** "Operations" bundles infrastructure (LAN, backup, cloud backup), hardware config (printing, scanner, customer display, receipt), app-level features (AI, display, modules, licences), and compliance (audit log). None of these belong together.
- **Duplicates.** `/settings/license` and `/settings/licenses` both ship — the first is labelled "(legacy)" in the sidebar.
- **The `/settings` page itself does double-duty.** The Business-Profile form has the Update Checker and Autostart toggle bolted onto the bottom, which is why "Check for Updates" is discovered accidentally rather than by category.
- **No sense of "what am I about to change?"** The sidebar's group labels (Business / Access / Finance / Operations / Dawa / Retail / Hardware / Hospitality) mix conceptual buckets (Business, Finance) with implementation buckets (Operations) and vertical modules. A shop owner scanning for "how do I set up my second monitor?" has no obvious tab.

## The redesign

### Information architecture

Collapse 24 items into **7 clean tabs** — one job per tab, ordered by how often the owner touches them:

| Tab | Icon meaning | Items |
|---|---|---|
| **Business** | Who you are | Business Profile · Locations & Branches · Modules |
| **People** | Who works here | Users · Roles · Groups · Access Explorer |
| **Money** | How you get paid + taxed | Payment Methods · Tax & VAT · Price Lists · Categories · KRA eTIMS *(Kenya)* · Insurance Providers *(Dawa)* |
| **Hardware** | Physical devices connected to this PC | Printing (auto-print + drawer kick + preferred) · Receipt Template · Barcode Scanner · Customer Display |
| **Application** | This app on this computer | Display & Touch (density, target sizes) · AI Integration · Auto-start with Windows · Software Updates · Licences |
| **System** | Infrastructure + data safety | LAN Multi-device · Backup & Restore · Cloud Backup · Audit Log |
| **Module-specific** | Only shows when active | Hardware Units & Credit (hardware) · Service Charge (hospitality) |

Changes vs today:
- **Kill the "Operations" catch-all.** Its 14 items redistribute across Money / Hardware / Application / System — each item lands in the tab that matches what the shop owner is trying to do, not what the code is doing.
- **Move Categories from Operations to Money.** Categories drive pricing lists + tax rules more than they drive stock organisation.
- **Move Modules from Operations to Business.** "Which trade am I running?" is a business-identity question, not an infra one.
- **Move AutostartToggle + UpdateChecker out of the Business Profile page** and into their own entries under **Application**. That fixes the discovery problem (nobody expected "Check for Updates" to live under Business Profile) and lets the main `/settings` page be *only* the business profile.
- **Delete `/settings/license` (legacy).** Redirect it to `/settings/licenses`. Route stays alive for a release cycle to catch bookmarks.

### Visual redesign

The current editorial style (Fraunces serif masthead + mono eyebrow + hairline rules + cream paper `#FBFAF6`) is good — the problem is structural, not visual. Keep the design language. Change three things:

1. **Group tabs at the top of the sidebar.** Instead of one long scrolling list of 24 items broken by mono-caps subheadings, put 7 tabs across the top of the sidebar. Selecting a tab reveals only that group's items (usually 3-5). The current group labels stay as eyebrow-mono captions inside the panel. The sidebar becomes shorter and each tab becomes glanceable.
   - Trade-off vs full-list: users lose the "see everything at once" affordance. Compensate with a slim search input at the top of the sidebar (fuzzy-matches label + description, jumps directly to any item — same shortcut Ctrl+K opens the command palette anyway).

2. **Tab bar visual — signature move**: hairline underline on the active tab in the module-accent colour, monospace uppercase labels in the eyebrow style, no pill. A tab is a rubric, not a button. Matches the rest of the editorial masthead already in use.
   ```
   BUSINESS   PEOPLE   MONEY   HARDWARE   APPLICATION   SYSTEM
   ─────────
   ```
   Active tab: `border-b-[2px] border-[var(--color-accent)]`, text foreground.
   Inactive tab: text muted, hover foreground/[0.6].

3. **Entry rows lose their descriptions inside a tab**. Once the user is inside "Hardware", they don't need to read "Physical devices connected to this PC" on every row — they read it once at the tab header. Description text becomes the tab header caption instead. Rows show `icon + label` only, cleaner.

### Typography

- **Tab labels**: `font-mono text-[10px] uppercase tracking-[0.22em]` (same as existing eyebrow style).
- **Row labels inside a tab**: `text-[13px] font-medium` (unchanged).
- **Section masthead (right pane)**: Fraunces `text-[28px] font-medium tracking-[-0.01em]` (unchanged).
- **Group label caption above the row list**: Fraunces italic `text-[14px]` — softens the transition between tab bar and the list.

## Migration

Non-breaking. Rewrite the sidebar shell; leave every settings route path untouched so bookmarks and deep links still work. Change only:
1. `src/lib/settings-registry.ts` — regroup entries into the 7 new `SettingsGroup` values. Add a `hidden?: boolean` field to soft-hide the legacy license page.
2. `src/components/layout/settings-layout.tsx` — swap the current single-column sidebar for a `Tabs` component on top + filtered item list below. Preserve the current masthead + `<Outlet />`.
3. `src/pages/settings.tsx` — remove the `UpdateChecker` and `AutostartToggle` mounts. Split them into two new routes:
   - `/settings/updates` — mounts `UpdateChecker` (existing component, unchanged)
   - `/settings/autostart` — mounts `AutostartToggle` extracted into a proper page
4. Register those two new routes in `App.tsx`.
5. Route `/settings/license` → redirect to `/settings/licenses` via `<Navigate replace />` so old links resolve.

Any missed grouping decision falls back safely because every route path stays where it is.

## Test plan

- Manual: open every tab, click every row, confirm the right page renders. Confirm `/settings/license` redirects. Confirm mobile-narrow viewport (tab bar horizontal-scrolls, not wrapping).
- Automated: extend `tests/settings-registry.spec.ts` (or create it) to assert every registered item has a valid group and the group is in `SETTINGS_GROUPS`.

## Version target

`v0.25.0`. UI-only, no schema changes, no server changes. Ships as a single desktop release.

## What this doesn't fix

- Search across settings values (e.g. "who has permission to void a sale") — that's a separate feature.
- Contextual help on individual settings — some fields still lack a description tooltip. Follow-up work.
- The `/settings` URL landing on Business Profile — that's fine as a default, but if the user clicks "Settings" from the nav, they land inside the Business tab.

## Risks

- **Muscle memory.** Any owner who's been clicking Operations → LAN Multi-device for a month will click into "System" next. Mitigated by (a) keeping every route path stable and (b) the search input on top of the sidebar.
- **Test coverage.** The current settings shell has no tests; the redesign adds testable structure but I need to be careful the tab component doesn't hide route-level errors (e.g. permission-denied for a whole group). Assert visible groups always contains at least one item before rendering the tab.

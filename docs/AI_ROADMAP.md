# Omnix AI Roadmap — From Concierge to Intelligent Business Partner

_Author: engineering. Status: living document. Last updated with the v0.14.x line._

This document analyses the current AI implementation across the entire Omnix
codebase (50 migrations, ~70 service modules, 5 modules, ~100 pages) and lays
out how to turn Omnix AI from an in-app support concierge into an intelligent
employee that actively helps owners run and grow their business.

It is deliberately grounded in what already exists. Omnix's AI _infrastructure_
is already excellent; the gap is **reach and depth**, not plumbing. The plan
spends most of its energy on (a) a deterministic, offline analytics layer the
AI narrates, (b) giving the assistant the full read-only data surface, (c) a
confirmed write-action framework, and (d) surfacing the 14 already-registered-
but-orphaned AI features.

---

## 1. Existing AI capabilities

### 1.1 Infrastructure (mature, production-grade)

| Piece | File | What it does |
|---|---|---|
| Provider router | `src/services/ai/router.ts` | Resolves a provider+model chain for a feature, calls an OpenAI-compatible `/chat/completions`, falls through on 429/5xx, normalises the response, caches + audits. 7 providers (Groq, OpenRouter, DeepSeek, Google, OpenAI, Anthropic, custom Ollama/vLLM). |
| Streaming router | `src/services/ai/stream.ts` | `streamInvoke()` on Vercel AI SDK `streamText`; token-by-token; **client-side tool calling already works** via `fullStream` (tool-call + tool-result deltas). |
| Config | `src/services/ai/config.ts` | CRUD over `ai_providers`, `ai_features`, `ai_settings`. Per-feature toggle, privacy tier, model override. |
| Cache | `src/services/ai/cache.ts` + `ai_cache` | Deterministic prompt-hash → response, TTL (default 30d). |
| Audit | `src/services/ai/audit.ts` + `ai_calls` | Every call (success/fail) logged: redacted prompt/response, tokens, cost, latency, status. `callStats()` aggregates. |
| Redaction | `src/services/ai/redact.ts` | Regex PII scrub (KE phone, email, KRA PIN, national ID, API keys, licence keys) on **every** prompt before it leaves the device. Optional name redaction. |
| Conversations | `src/services/ai/conversations.ts` + `ai_conversations`/`ai_messages` | Persistent chat threads, resumable history. |
| System prompt | `src/services/ai/system-prompt.ts` + `knowledge.ts` | Per-variant trade-aware persona + a hand-curated product knowledge base embedded in the prompt. |
| Privacy tiers | `router.ts` `privacyAllows()` | `low`/`medium`/`high`; high needs explicit `high_tier_optin`. |

### 1.2 Features registered (`ai_features`, migration 042/043)

19 features registered. **Wired to UI (5):**

- `enrich_product` — product-name → category/unit/tax/active-ingredient. Used in `components/inventory/product-panel.tsx` via `AiButton` + `AiSuggestionDialog`.
- `normalize_import` — messy CSV headers → Omnix fields. Used in `pages/import-products.tsx`.
- `explain_etims` — KRA error code → plain English. Used in `pages/etims-queue.tsx`.
- `docs_qa` — in-app help Q&A. Used in `components/ai/AiHelpFloating.tsx`.
- `assistant_chat` — the streaming concierge panel (`AiAssistantPanel.tsx`), 7 read-only tools.

**Registered but ORPHANED — no UI calls them (14):**
`setup_assist`, `receipt_ocr`, `anomaly_narrate`, `slow_mover`, `drug_enrich`,
`hsn_suggest`, `menu_describe`, `recipe_suggest`, `bom_generate`,
`command_palette`, `draft_message`, `translate_receipt`, `zreport_summary`,
`stock_take_help`.

### 1.3 Assistant tools (`src/services/ai/tools.ts`)

7 tools, **all read-only or navigation**: `navigate`, `getTodaySales`,
`getInventoryAlerts`, `searchProducts`, `searchCustomers`, `getRecentSales`,
`openDocs`. The file explicitly notes mutations were deferred ("ship in v0.4
once we have a confirmation flow"). The confirmation flow now exists
(`AiSuggestionDialog`) but isn't yet wired to assistant write-tools.

### 1.4 Deterministic analytics that already exist (AI can narrate, no LLM math)

`src/services/reports.ts`: `getDashboardKPIs`, `getSalesByDay`, `getTopProducts`,
`getSalesByPaymentMethod`, `getStockValuation`, `getReorderList`, `getDeadStock`,
`getStockMovementsByDay`, `getSalesComparison`, `getSalesBySource`.
`retail-reports.ts`: brand performance, category mix, KPIs.
`hospitality.ts`: `restaurantReport`, `hotelReport`, `recipeCost`.
`hardware.ts`: `agedReceivables`.
`csv-automap.ts`: deterministic synonym header mapping (EN + Swahili) — the
offline fallback for `normalize_import`.
`cogs.ts`: centralised, correct COGS SQL fragment.

---

## 2. Missing opportunities

1. **No "ask your data".** The assistant can fetch today's sales and low
   stock, but cannot answer "what made the most profit this month?", "why did
   revenue fall?", "which cashier sold the most?", "which customers stopped
   buying?". The deterministic reports exist; they're just not exposed as
   tools.
2. **No write actions.** The assistant cannot draft a PO, create a quote,
   categorise a product, or merge duplicates — even with confirmation.
3. **14 orphaned features.** Real LLM value already built and registered, but
   no button anywhere triggers them.
4. **No analytics/insight engine.** Things every ERP consultant would compute —
   dead stock value, margin outliers, negative margins, slow movers, reorder
   quantities (not just the list), customer churn/RFM, supplier scorecards,
   duplicate detection, anomaly detection — don't exist as deterministic SQL.
   These are the substance the AI should _narrate_, not invent.
5. **Imports are header-mapping only.** No row-level normalisation (units,
   prices), no duplicate detection against the existing catalogue, no
   AI-assisted "learn this mapping for next time", no PDF/price-list ingestion.
6. **No dedicated AI workspace.** Everything is a 420px side panel. There's no
   place to analyse an uploaded spreadsheet/PDF, run a report, and act on it.
7. **No proactive insights.** AI only responds. No "3 things to look at today"
   on the dashboard.

---

## 3. High-impact AI improvements (the thesis)

The single highest-leverage move is a **deterministic insight layer** (`insights.ts`)
that computes business facts in SQL — offline, instant, free — and an **AI
narration layer** that explains them in plain English (and Swahili) only when
the user asks "why". This split is the core architecture decision:

> **Numbers are computed by SQL. Explanations are written by the LLM.**

This keeps Omnix honest (no hallucinated figures), fast (SQL is sub-50ms),
offline-first (insights work with no internet; narration degrades gracefully),
and cheap (LLM tokens only when a human wants prose).

On top of that: give the assistant the full read-only tool surface (so "ask
your data" works in the existing chat), then a confirmed write-tool framework
(so it can _act_ with one-tap approval), then a dedicated workspace for files.

---

## 4. Quick wins (days, not weeks — highest value/effort ratio)

These reuse existing infra and ship immediately:

- **QW1 — Insight engine v1 (`services/insights.ts`).** Deterministic SQL for:
  dead stock (value + days idle), reorder suggestions with qty (avg daily sales
  × lead-time + safety stock), margin outliers + negative margins, slow movers,
  price anomalies (z-score vs category), customer RFM + churn risk, supplier
  scorecard (on-time %, price trend, fill rate), duplicate-product detection
  (normalised-name + fuzzy), revenue movers (period-over-period deltas with the
  biggest contributing products). **No LLM. Offline. Tested.**
- **QW2 — Expand assistant tools** to expose every report + insight read-only
  (`getProfitLeaders`, `getReorderSuggestions`, `getDeadStock`, `getChurnRisk`,
  `explainRevenueChange`, `getSupplierScorecard`, `getCashierPerformance`, …).
  Instantly makes the existing chat answer the §Reports questions, grounded in
  live data.
- **QW3 — Surface orphaned narration features** where they belong:
  `zreport_summary` on `/reports/zreport`, `anomaly_narrate` + `slow_mover` on
  the dashboard/inventory, `drug_enrich` on the pharmacy product panel,
  `recipe_suggest` on hospitality recipes, `bom_generate` on hardware quotes,
  `draft_message` on customer/invoice screens. All via existing `AiButton` +
  `AiSuggestionDialog`.
- **QW4 — Proactive "Today" insights card** on the dashboard: top 3
  deterministic findings (e.g. "Amoxicillin runs out in ~4 days", "12 SKUs are
  dead stock worth KES 84k", "Yesterday's margin was 9pts below your 30-day
  average"), each with an "Ask AI why / what to do" button.

## 5. Long-term AI roadmap

- **L1 — Confirmed write-action framework.** Assistant proposes a structured
  action (draft PO, create quote, categorise N products, merge duplicates,
  schedule stock count, draft invoice); user reviews in `AiSuggestionDialog`;
  only then does it execute through the existing transactional services. Every
  action is permission-checked + audit-logged.
- **L2 — Dedicated AI Workspace (`/ai`).** Full-page: chat + report runner +
  file drop (spreadsheet/PDF/invoice/price-list analysis) + recommendation
  feed + approved-action history.
- **L3 — Import 2.0.** AI structure detection, header harmonisation (LLM on top
  of `csv-automap`), row normalisation (units/prices), duplicate detection vs
  catalogue, preview + problem explanation, **learned mappings** persisted per
  source signature.
- **L4 — Vision ingestion.** `receipt_ocr` for supplier invoices + competitor
  price lists → draft GRN / price update (confirmed).
- **L5 — Forecasting.** Ingredient demand (hospitality), medicine shortage
  prediction (pharmacy), fast-mover prediction (retail), purchasing-needs
  forecast — deterministic moving-average/seasonal baselines, AI explanation.
- **L6 — Local embeddings + RAG** over docs + the business's own data for
  semantic search and grounded answers (offline via the `custom` Ollama
  provider; embeddings cached in SQLite).
- **L7 — Per-module AI playbooks.** Pharmacist, retailer, restaurateur,
  hardware, accountant "modes" with tailored proactive insights + actions.

---

## 6. Recommended architecture

```
┌──────────────────────────────────────────────────────────────┐
│ UI surfaces                                                    │
│  AiAssistantPanel (chat)   AiButton+SuggestionDialog (inline)  │
│  /ai Workspace (full page)   Dashboard "Today" insight card    │
└───────────────┬───────────────────────────┬──────────────────┘
                │                            │
        ┌───────▼────────┐          ┌────────▼─────────┐
        │ Assistant tools │          │ Inline AI tasks  │
        │ (read + write)  │          │ (enrich, narrate)│
        └───────┬────────┘          └────────┬─────────┘
                │                            │
   ┌────────────▼───────────┐    ┌───────────▼────────────┐
   │ INSIGHT ENGINE          │    │ AI ROUTER (existing)    │
   │ services/insights.ts    │    │ invoke / streamInvoke   │
   │ deterministic SQL,      │    │ providers, cache, audit,│
   │ offline, tested, free   │    │ redaction, privacy      │
   └────────────┬───────────┘    └───────────┬────────────┘
                │                            │
        ┌───────▼────────────────────────────▼────────┐
        │ SQLite (SQLCipher) — the single source of    │
        │ truth. Numbers come from here, never the LLM.│
        └──────────────────────────────────────────────┘
```

Principles:
- **SQL computes; LLM explains.** Never let the model do arithmetic on money.
- **Reuse the router.** All LLM access goes through `invoke`/`streamInvoke` so
  caching, audit, redaction, privacy, fallback are free.
- **Tools are the action API.** Read-tools wrap `insights`/`reports`;
  write-tools wrap existing transactional services (`completeSale`,
  `createSaleReturn`, PO lifecycle, etc.) and always require confirmation.
- **Offline-first.** Insights + import header-mapping + duplicate detection
  work with zero internet. Only narration/enrichment need a provider; absence
  degrades to "numbers only".

---

## 7. Required database changes

Minimal — the schema is already rich. New/changed:

- `ai_features`: add rows for new surfaces (`ask_data`, `revenue_explainer`,
  `supplier_score_narrate`, `import_harmonize`, `action_proposer`). (INSERT OR
  IGNORE, no schema change.)
- `ai_import_mappings` (**new**): learned column mappings keyed by a source
  signature (sorted normalised headers hash) → field map JSON + hit count, for
  L3 "learn this mapping".
- `ai_actions` (**new**): audit/queue of proposed + executed write-actions
  (id, feature, proposed_json, status pending/applied/rejected, applied_by,
  applied_at, result_ref). Human-in-the-loop ledger.
- `ai_insights_cache` (**optional**): memoised expensive insight results with a
  short TTL + the parameters, so the dashboard card and chat share one compute.
- Indexes to keep insight SQL fast at scale: `sale_items(product_id)`,
  `stock_movements(product_id, created_at)`, `sales(customer_id, created_at)` —
  verify against existing indexes; add only the missing ones.

No destructive changes. All additive, via numbered migrations (next is 051).

---

## 8. Required UI changes

- **Dashboard**: a "Today / This week" proactive insight card (QW4).
- **Inline `AiButton`s** on: zreport, dashboard, inventory list, pharmacy
  product panel, hospitality recipes, hardware quote builder, customer +
  invoice screens (QW3).
- **`/ai` Workspace page** (L2): chat pane + report runner + file drop zone +
  recommendation feed + action history. New route in `App.tsx` + sidebar entry
  + command-palette entry, gated by AI-configured state.
- **Action confirmation**: reuse `AiSuggestionDialog`; add an "Apply action"
  variant that shows the exact DB effect before commit.
- **Settings → AI**: surface the new features in the existing feature toggle
  list (already data-driven from `ai_features`, so they appear automatically).

---

## 9. Performance considerations

- Insight SQL must be **indexed and bounded** (LIMIT, date windows). Target
  <50ms each on a year of data; reuse `sales_daily` rollup (migration 049) for
  long windows.
- **Cache insights** for the dashboard card (short TTL) so opening the app
  doesn't re-run 8 aggregations every time; invalidate on new sale.
- LLM calls stay **on-demand** (user clicks "explain"), never on render. The
  prompt cache (`ai_cache`) already dedupes repeated questions.
- Streaming keeps perceived latency low; tool calls run locally (SQLite) so the
  round-trip is model→tool(local)→model.
- Respect the **monthly spend cap** (`ai_settings.monthly_spend_cap_usd`) and
  `free_models_only` — insights are free; only narration spends.
- Keep prompts small: send **computed facts**, not raw tables, to the model.

---

## 10. Security considerations

- **Redaction stays mandatory** (`redactMessages`) on every prompt — extend to
  redact customer names when sending customer-history context (the redactor
  already supports `names: [...]`).
- **Permissions**: every write-tool calls `requirePermission(...)` (RBAC
  already exists, `services/rbac.ts`) before proposing _and_ before applying.
  Read-tools respect branch scoping (`getActiveBranchId`).
- **Human-in-the-loop for all writes** — no destructive or mutating action
  without explicit `AiSuggestionDialog` approval. No exceptions.
- **Audit everything**: `ai_calls` for inference, `ai_actions` for proposed/
  applied writes, plus the existing app `audit_log` for the actual mutation.
- **BYO-key, no exfiltration**: keys stay in the SQLCipher DB; Omnix takes no
  fee and proxies nothing. Data only goes to the provider the _user_ configured.
- **Offline default**: if no provider is set, AI features fail closed with a
  clear "configure in Settings → AI" message — they never silently send data.
- Treat all model output as **untrusted**: tool args are zod-validated; write
  actions are re-validated server-side against the same service guards a human
  would hit.

---

## 11. Offline vs online AI strategy

| Capability | Offline (no provider) | Online (provider configured) |
|---|---|---|
| Insights / analytics | ✅ full (SQL) | ✅ full + narration |
| Import header mapping | ✅ `csv-automap` synonyms | ✅ + LLM for unknown headers |
| Duplicate detection | ✅ deterministic fuzzy | ✅ + LLM for hard cases |
| Reorder / dead stock / churn | ✅ full | ✅ + "why / what to do" prose |
| Product enrichment | ⚠️ blank fields | ✅ LLM fill |
| Chat "ask your data" | ⚠️ shows numbers via tools, no prose | ✅ conversational |
| Recipe/BOM/menu/draft-message | ❌ needs LLM | ✅ |
| Vision (OCR) | ❌ needs vision model | ✅ (or local llava via Ollama) |

Strategy: **deterministic core always works**; LLM is an _enhancement_ layer.
Local-first power users can point the `custom` provider at Ollama for fully
offline narration + embeddings. The app never blocks on the network.

---

## 12. Prioritised implementation plan (highest business value → lowest)

| # | Item | Value | Effort | Depends |
|---|---|---|---|---|
| **P0** | Insight engine v1 (`services/insights.ts`) + tests | ★★★★★ | M | — |
| **P1** | Expand assistant read-tools over reports+insights ("ask your data") | ★★★★★ | S | P0 |
| **P2** | Surface orphaned narration features (zreport/anomaly/slow-mover/drug/recipe/bom/draft) | ★★★★☆ | S | — |
| **P3** | Dashboard proactive "Today" insight card | ★★★★☆ | S | P0 |
| **P4** | Confirmed write-action framework + first 3 actions (draft PO, create quote, categorise) | ★★★★☆ | M | P0,P1 |
| **P5** | `/ai` Workspace page (chat + reports + recommendations + action history) | ★★★★☆ | M | P1,P4 |
| **P6** | Import 2.0 (harmonise + row normalise + dup detect + learned mappings) | ★★★★☆ | L | P0 |
| **P7** | Duplicate/merge tooling across products + customers | ★★★☆☆ | M | P0 |
| **P8** | File/PDF/price-list analysis in workspace (vision + parse) | ★★★☆☆ | L | P5 |
| **P9** | Forecasting (demand, shortage, fast-mover) | ★★★☆☆ | L | P0 |
| **P10** | Local embeddings + RAG over docs + business data | ★★★☆☆ | L | — |
| **P11** | Per-module AI playbooks / proactive modes | ★★★☆☆ | M | P0,P3 |

**Execution order chosen:** P0 → P1 → P2 → P3 first (the quick wins that make
the existing chat dramatically smarter and the dashboard proactive), then P4/P5
(acting + workspace), then the longer-horizon items.

---

## Appendix A — "Ask your data" question → data source map

| User question | Backing function (deterministic) | Narrated by |
|---|---|---|
| What made the most profit this month? | `insights.profitLeaders()` | `ask_data` |
| Which products should I reorder? | `insights.reorderSuggestions()` | inline |
| Why did revenue fall? | `insights.revenueChange()` (period deltas + top contributors) | `revenue_explainer` |
| Which cashier sold the most? | `insights.cashierPerformance()` | `ask_data` |
| Which supplier gives the best margins? | `insights.supplierScorecard()` | `ask_data` |
| Which pharmacy products expire next month? | `reports`/`pharmacy` expiry query | inline |
| Which menu items make the most profit? | `hospitality` recipe cost + sales | `ask_data` |
| Which customers stopped buying? | `insights.churnRisk()` (RFM) | `ask_data` |
| What should I focus on this week? | `insights.topFindings()` | `anomaly_narrate` |

## Appendix B — Per-area feature coverage (request → plan item)

- **Inventory** (dup detect, similar products, category/supplier suggest, unit
  normalise, SKU/barcode gen, price/margin anomalies, slow/dead stock, reorder
  qty, shortage predict, PO recommend, trend explain): P0 (analytics) + P2/P6/P9.
- **Purchasing** (best supplier, price compare, needs predict, dup invoice
  detect, suspicious purchasing, buy-together): P0 (supplier scorecard) + P4
  (draft PO) + P9.
- **Retail** (explain unusual sales, cashier mistakes, suspicious refunds, price
  anomalies, promo/bundle suggest, fast-mover predict, daily perf explain):
  P0 + P3 + P9.
- **Pharmacy** (explain Rx, dup medicine, generic alt, interactions, expiry
  trend, shortage predict, organise, patient history summary, insurance docs):
  `drug_enrich` (P2) + interactions (exists) + P0 expiry/shortage + P4 (claim
  draft).
- **Hardware** (related products, quote from description, missing items, bulk
  discount, extra materials, BOM estimate): `bom_generate` (P2) + P4 (create
  quote).
- **Hospitality** (build/improve recipe, food cost, price recommend, ingredient
  shortage, menu changes, waste/turnover/kitchen analysis, staffing, profitable
  items, demand forecast): `recipe_suggest`/`menu_describe` (P2) + P0 (food cost
  already in `recipeCost`) + P9.
- **Customers** (history summary, churn, VIP, loyalty, inactive, follow-up):
  P0 (RFM/churn) + P1.
- **Suppliers** (perf/price compare, delayed deliveries, preferred, score): P0
  (supplier scorecard).
- **Finance** (explain reports/profit/expenses, abnormal txns, dup payments,
  summaries, exec summary): P0 (anomaly + dup payment detect) + P1 + P2.
- **Reports** (NL questions on live data): P1 ("ask your data").
- **Imports**: P6. **Automation**: P4. **Workspace**: P5.

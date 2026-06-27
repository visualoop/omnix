/**
 * Assistant tools — what the AI can actually DO inside Omnix.
 *
 * Each tool has:
 *   - A zod schema that the LLM uses to know the args
 *   - A handler that runs in the React app (reads SQLite via @/lib/db,
 *     navigates via react-router, etc.) and returns a JSON-serialisable
 *     result the model can summarise back to the user
 *
 * Tools are wired into Vercel AI SDK's streamText({tools: ...}). The model
 * decides when to call them; we run the handler client-side; the result
 * goes back to the model so it can phrase the answer naturally.
 *
 * Safety: every tool is read-only OR navigates the user (no destructive
 * actions). Mutations (create customer, mark sale paid, etc.) ship in v0.4
 * once we have a confirmation flow.
 */
import { tool } from "ai"
import { z } from "zod"
import { query } from "@/lib/db"

export interface ToolContext {
  /** Navigate to a route. Wrapper around react-router's navigate(string). */
  navigate: (route: string) => void
}

/** A single tool definition that's stable across renders (memoise via context). */
export function buildAssistantTools(ctx: ToolContext) {
  return {
    /* ─── Navigate ───────────────────────────────────────────────── */
    navigate: tool({
      description:
        "Navigate the user to a specific page in the Omnix app. Use this when " +
        "the user asks to 'open' / 'go to' / 'take me to' a page, or when you " +
        "want to deep-link them to where they should perform a task. " +
        "Use exact paths like '/pos', '/settings/etims', '/inventory'.",
      inputSchema: z.object({
        route: z
          .string()
          .startsWith("/")
          .describe("Absolute route path, e.g. /pos, /settings/etims, /reports."),
        reason: z.string().optional().describe("Brief reason for navigating, shown in the chat."),
      }),
      execute: async ({ route, reason }: { route: string; reason?: string }) => {
        ctx.navigate(route)
        return { ok: true, navigatedTo: route, reason: reason ?? "Opened" }
      },
    }),

    /* ─── Today's sales summary ──────────────────────────────────── */
    getTodaySales: tool({
      description:
        "Get a quick summary of today's sales: total transactions, revenue, " +
        "cash vs M-Pesa vs card breakdown, refunds, and average basket. " +
        "Use this when the user asks 'how are sales today?', 'what's my revenue today?', etc.",
      inputSchema: z.object({}).describe("No arguments — always summarises today."),
      execute: async () => {
        const { getTodaySalesSummary } = await import("@/services/pos-helpers")
        return await getTodaySalesSummary()
      },
    }),

    /* ─── Low-stock alerts ───────────────────────────────────────── */
    getInventoryAlerts: tool({
      description:
        "Get a list of products at or below their reorder level — i.e. items the " +
        "owner should reorder soon. Returns up to N items sorted by lowest stock first.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10).describe("Max items to return (default 10)."),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const { getLowStockProducts } = await import("@/services/pos-helpers")
        const items = await getLowStockProducts(limit)
        return { count: items.length, items }
      },
    }),

    /* ─── Search products ────────────────────────────────────────── */
    searchProducts: tool({
      description:
        "Search the product catalogue by name, barcode, or SKU. Returns up to 10 matches. " +
        "Use this when the user asks 'do I have X?', 'how much is panadol?', etc.",
      inputSchema: z.object({
        q: z.string().min(1).describe("Search query — name fragment, barcode, or SKU."),
      }),
      execute: async ({ q }: { q: string }) => {
        const rows = await query<{
          id: string
          name: string
          sku: string | null
          barcode: string | null
          unit: string | null
          stock_qty: number
          selling_price: number
        }>(
          `SELECT p.id, p.name, p.sku, p.barcode, p.unit,
                  COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
                  COALESCE(pp.selling_price, 0) AS selling_price
             FROM products p
             LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
            WHERE p.active = 1
              AND COALESCE(p.kind, 'physical') = 'physical'
              AND (p.name LIKE ?1 OR p.sku LIKE ?1 OR p.barcode LIKE ?1)
            ORDER BY p.name ASC
            LIMIT 10`,
          [`%${q}%`],
        )
        return { count: rows.length, items: rows }
      },
    }),

    /* ─── Search customers ───────────────────────────────────────── */
    searchCustomers: tool({
      description:
        "Search customers by name, phone, or email. Returns up to 10 matches.",
      inputSchema: z.object({
        q: z.string().min(1).describe("Search query."),
      }),
      execute: async ({ q }: { q: string }) => {
        const rows = await query<{
          id: string
          name: string
          phone: string | null
          email: string | null
          credit_balance: number
        }>(
          `SELECT id, name, phone, email,
                  COALESCE(balance, 0) AS credit_balance
             FROM customers
            WHERE active = 1
              AND (name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1)
            ORDER BY name ASC
            LIMIT 10`,
          [`%${q}%`],
        )
        return { count: rows.length, items: rows }
      },
    }),

    /* ─── Recent sales ───────────────────────────────────────────── */
    getRecentSales: tool({
      description:
        "List the most recent N sales — invoice number, total, payment status, " +
        "customer name. Useful for 'show me the last 5 sales' style questions.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const rows = await query<{
          id: string
          sale_number: string
          total: number
          payment_status: string
          customer_name: string | null
          created_at: string
        }>(
          `SELECT s.id, s.sale_number, s.total, s.payment_status,
                  c.name AS customer_name,
                  s.created_at
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
            ORDER BY datetime(s.created_at) DESC
            LIMIT ?1`,
          [limit],
        )
        return { count: rows.length, items: rows }
      },
    }),

    /* ─── Open a docs topic ──────────────────────────────────────── */
    openDocs: tool({
      description:
        "Open the public docs site at omnix.co.ke/docs (optionally a specific slug). " +
        "Use when you can't answer authoritatively and want to point them to the docs.",
      inputSchema: z.object({
        slug: z.string().optional().describe("Optional docs slug, e.g. 'kra-etims-setup'."),
      }),
      execute: async ({ slug }: { slug?: string }) => {
        const url = slug ? `https://omnix.co.ke/docs/${slug}` : "https://omnix.co.ke/docs"
        // Open in default browser via tauri-plugin-opener if available; else fall back.
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener")
          await openUrl(url)
        } catch {
          window.open(url, "_blank", "noopener,noreferrer")
        }
        return { ok: true, url }
      },
    }),

    /* ═══════════════════════════════════════════════════════════════
     * "Ask your data" — deterministic analytics tools. Every figure
     * comes from SQL (services/insights.ts + reports.ts), never the
     * model's head, so answers are always grounded in the live DB.
     * All read-only.
     * ═════════════════════════════════════════════════════════════ */

    /* ─── What should I focus on? ─────────────────────────────────── */
    getTopFindings: tool({
      description:
        "Get the most important things the owner should look at right now — the " +
        "proactive business digest. Returns ranked findings (critical→info) about " +
        "stockouts, expiring stock, dead stock, below-cost pricing, and revenue " +
        "drops. Use for 'what should I focus on this week?', 'anything I should " +
        "worry about?', 'how's the business doing?'.",
      inputSchema: z.object({}),
      execute: async () => {
        const { topFindings } = await import("@/services/insights")
        const findings = await topFindings()
        return { count: findings.length, findings }
      },
    }),

    /* ─── Reorder suggestions (with quantities) ───────────────────── */
    getReorderSuggestions: tool({
      description:
        "Get products to reorder WITH suggested order quantities, based on each " +
        "product's own sales velocity, lead time, and current stock. Returns days " +
        "of cover remaining and the usual supplier. Use for 'what should I reorder?', " +
        "'how much X should I buy?', 'what's about to run out?'.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const { reorderSuggestions } = await import("@/services/insights")
        const items = await reorderSuggestions({ limit })
        return { count: items.length, items }
      },
    }),

    /* ─── Dead stock ──────────────────────────────────────────────── */
    getDeadStock: tool({
      description:
        "Get slow/dead stock — items that haven't sold in 60+ days — with the " +
        "capital tied up at cost. Use for 'what's not selling?', 'dead stock', " +
        "'what's tying up my money?'.",
      inputSchema: z.object({
        idleDays: z.number().int().min(14).max(365).default(60),
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ idleDays, limit }: { idleDays: number; limit: number }) => {
        const { deadStock } = await import("@/services/insights")
        return await deadStock({ idleDays, limit })
      },
    }),

    /* ─── Profit leaders ──────────────────────────────────────────── */
    getProfitLeaders: tool({
      description:
        "Get the products that made the most PROFIT (not just revenue) over a " +
        "period, with margin %. Use for 'what made the most profit this month?', " +
        "'my best products', 'which lines are most profitable?'.",
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ windowDays, limit }: { windowDays: number; limit: number }) => {
        const { profitLeaders } = await import("@/services/insights")
        const items = await profitLeaders({ windowDays, limit })
        return { count: items.length, items }
      },
    }),

    /* ─── Explain a revenue change ────────────────────────────────── */
    explainRevenueChange: tool({
      description:
        "Compare revenue this period vs the previous equal period and return the " +
        "products that drove the change (top gainers + losers). Use for 'why did " +
        "revenue fall?', 'why are sales up?', 'what changed this week?'. You then " +
        "explain the WHY from these facts.",
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(90).default(7),
      }),
      execute: async ({ windowDays }: { windowDays: number }) => {
        const { revenueChange } = await import("@/services/insights")
        return await revenueChange({ windowDays })
      },
    }),

    /* ─── Margin issues ───────────────────────────────────────────── */
    getMarginIssues: tool({
      description:
        "Find products with pricing problems: sold below cost (negative margin), " +
        "zero margin, missing selling price, or very thin margins. Use for " +
        "'am I losing money on anything?', 'pricing problems', 'check my margins'.",
      inputSchema: z.object({
        thinPct: z.number().min(0).max(50).default(5),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ thinPct, limit }: { thinPct: number; limit: number }) => {
        const { marginIssues } = await import("@/services/insights")
        const items = await marginIssues({ thinPct, limit })
        return { count: items.length, items }
      },
    }),

    /* ─── Cashier performance ─────────────────────────────────────── */
    getCashierPerformance: tool({
      description:
        "Rank staff by sales over a period: count, revenue, voids, average basket. " +
        "Use for 'which cashier sold the most?', 'staff performance', 'who's " +
        "voiding a lot?'.",
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ windowDays }: { windowDays: number }) => {
        const { cashierPerformance } = await import("@/services/insights")
        const items = await cashierPerformance({ windowDays })
        return { count: items.length, items }
      },
    }),

    /* ─── Customer insights (churn / VIP) ─────────────────────────── */
    getCustomerInsights: tool({
      description:
        "Segment customers by recency/frequency/spend: vip, loyal, at_risk, " +
        "churned, new. Use for 'which customers stopped buying?', 'who are my VIPs?', " +
        "'inactive customers', 'who should I follow up with?'.",
      inputSchema: z.object({
        segment: z.enum(["vip", "loyal", "at_risk", "churned", "new", "occasional"]).optional()
          .describe("Optionally filter to one segment."),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      execute: async ({ segment, limit }: { segment?: string; limit: number }) => {
        const { customerInsights } = await import("@/services/insights")
        let items = await customerInsights({ limit: 200 })
        if (segment) items = items.filter((c) => c.segment === segment)
        return { count: items.length, items: items.slice(0, limit) }
      },
    }),

    /* ─── Supplier scorecard ──────────────────────────────────────── */
    getSupplierScorecard: tool({
      description:
        "Score suppliers on spend, on-time delivery %, and fill rate. Use for " +
        "'which supplier is most reliable?', 'supplier performance', 'who delivers " +
        "late?', 'best supplier'.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const { supplierScorecard } = await import("@/services/insights")
        const items = await supplierScorecard({ limit })
        return { count: items.length, items }
      },
    }),

    /* ─── Duplicate products ──────────────────────────────────────── */
    getDuplicateProducts: tool({
      description:
        "Find likely duplicate products (same barcode or same normalised name). " +
        "Use for 'do I have duplicates?', 'clean up my catalogue', 'duplicate " +
        "products'. Read-only — merging requires confirmation.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(25),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const { duplicateProducts } = await import("@/services/insights")
        const groups = await duplicateProducts({ limit })
        return { count: groups.length, groups }
      },
    }),

    /* ─── Expiry risk ─────────────────────────────────────────────── */
    getExpiryRisk: tool({
      description:
        "Get stock batches expiring within N days and the value at risk. Use for " +
        "'what expires soon?', 'expiring stock', 'which medicines expire next month?'.",
      inputSchema: z.object({
        withinDays: z.number().int().min(1).max(365).default(90),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ withinDays, limit }: { withinDays: number; limit: number }) => {
        const { expiryRisk } = await import("@/services/insights")
        return await expiryRisk({ withinDays, limit })
      },
    }),

    /* ═══════════════════════════════════════════════════════════════
     * Write-action PROPOSERS. These NEVER mutate. They return a
     * structured proposal that the chat UI renders in a confirmation
     * dialog; the actual change runs only after the user clicks Apply
     * (services/ai/actions.ts, permission-checked + audited). The marker
     * key `__actionProposal` is how the panel detects a proposal.
     * ═════════════════════════════════════════════════════════════ */

    /* ─── Propose: set product category ───────────────────────────── */
    proposeSetCategory: tool({
      description:
        "Propose categorising one or more products into a category. Does NOT " +
        "apply — the user must confirm. Use when the user asks to categorise, " +
        "organise, or tidy up products. First use searchProducts to get product " +
        "ids and confirm the category exists.",
      inputSchema: z.object({
        product_ids: z.array(z.string()).min(1).describe("Product ids to categorise."),
        category_id: z.string().describe("Target category id."),
        category_name: z.string().describe("Target category name (for the preview)."),
      }),
      execute: async ({ product_ids, category_id, category_name }: { product_ids: string[]; category_id: string; category_name: string }) => {
        return {
          __actionProposal: {
            id: "set_product_category",
            summary: `Categorise ${product_ids.length} product(s) as "${category_name}"`,
            payload: { id: "set_product_category", product_ids, category_id, category_name },
          },
        }
      },
    }),

    /* ─── Propose: set reorder level ──────────────────────────────── */
    proposeSetReorderLevel: tool({
      description:
        "Propose setting a product's reorder level. Does NOT apply — the user " +
        "confirms first. Use after getReorderSuggestions or when the user asks " +
        "to change when a product triggers a reorder alert.",
      inputSchema: z.object({
        product_id: z.string(),
        product_name: z.string(),
        reorder_level: z.number().int().min(0),
      }),
      execute: async ({ product_id, product_name, reorder_level }: { product_id: string; product_name: string; reorder_level: number }) => {
        return {
          __actionProposal: {
            id: "set_reorder_level",
            summary: `Set reorder level for ${product_name} to ${reorder_level}`,
            payload: { id: "set_reorder_level", product_id, product_name, reorder_level },
          },
        }
      },
    }),

    /* ─── Propose: draft a purchase order ─────────────────────────── */
    proposeDraftPurchaseOrder: tool({
      description:
        "Propose drafting a purchase order for a supplier from a list of items. " +
        "Does NOT apply — the user confirms first, and it's created as a DRAFT " +
        "(never sent). Use after getReorderSuggestions when the user wants to " +
        "reorder. Get supplier id via search... or from the suggestion's supplier.",
      inputSchema: z.object({
        supplier_id: z.string(),
        supplier_name: z.string(),
        items: z.array(z.object({
          product_id: z.string(),
          product_name: z.string(),
          quantity: z.number().positive(),
          unit_cost: z.number().min(0),
        })).min(1),
      }),
      execute: async (args: { supplier_id: string; supplier_name: string; items: Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }> }) => {
        return {
          __actionProposal: {
            id: "draft_purchase_order",
            summary: `Draft a purchase order for ${args.supplier_name} (${args.items.length} items)`,
            payload: { id: "draft_purchase_order", ...args },
          },
        }
      },
    }),
  }
}

export type AssistantTools = ReturnType<typeof buildAssistantTools>

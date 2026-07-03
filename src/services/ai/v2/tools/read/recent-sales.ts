/**
 * recent_sales — the last N sales for quick lookup / return handling.
 */
import { z } from "zod";
import { defineTool } from "../base";
import { register } from "../registry";
import { query } from "@/lib/db";

const params = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});

interface SaleRow {
  id: string;
  sale_number: number;
  total: number;
  created_at: string;
  customer: string | null;
  cashier: string | null;
}

register(defineTool<z.infer<typeof params>, { count: number }>({
  id: "recent_sales",
  description: "List the most-recent non-held sales with total, cashier, and customer",
  parameters: params,
  tier: "read",
  ui: { label: "Recent sales", icon: "Receipt" },
  async execute(args) {
    const rows = await query<SaleRow>(
      `SELECT s.id, s.sale_number, s.total, s.created_at,
              c.name AS customer,
              u.full_name AS cashier
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status != 'held'
       ORDER BY s.created_at DESC
       LIMIT ?1`,
      [args.limit],
    );
    const output = rows.length === 0
      ? "No completed sales."
      : rows.map((r) =>
          `  #${r.sale_number} · ${r.customer ?? "Walk-in"} · KES ${r.total.toFixed(2)}` +
          (r.cashier ? ` · ${r.cashier}` : ""),
        ).join("\n");
    return {
      title: `${rows.length} recent sale${rows.length === 1 ? "" : "s"}`,
      output,
      metadata: { count: rows.length },
    };
  },
}));

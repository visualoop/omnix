/**
 * find_customer — LIKE-search customers by name or phone. Returns up to 20.
 */
import { z } from "zod";
import { defineTool } from "../base";
import { register } from "../registry";
import { query } from "@/lib/db";

const params = z.object({
  q: z.string().min(1).max(80).describe("Search term — name or phone fragment"),
});

interface Row {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
}

register(defineTool<z.infer<typeof params>, { count: number }>({
  id: "find_customer",
  description: "Search customers by name or phone. Returns matches with outstanding balance.",
  parameters: params,
  tier: "read",
  ui: { label: "Find customer", icon: "User" },
  async execute(args) {
    const like = `%${args.q}%`;
    const rows = await query<Row>(
      `SELECT id, name, phone, COALESCE(current_balance, 0) AS balance
       FROM customers
       WHERE name LIKE ?1 OR COALESCE(phone, '') LIKE ?1
       ORDER BY name LIMIT 20`,
      [like],
    );
    const output = rows.length === 0
      ? `No customers match "${args.q}".`
      : rows.map((r) =>
          `  • ${r.name}${r.phone ? ` (${r.phone})` : ""}${r.balance > 0 ? ` · owes KES ${r.balance.toFixed(2)}` : ""}`,
        ).join("\n");
    return {
      title: `${rows.length} match${rows.length === 1 ? "" : "es"} for "${args.q}"`,
      output,
      metadata: { count: rows.length },
    };
  },
}));

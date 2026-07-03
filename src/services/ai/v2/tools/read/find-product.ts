/**
 * find_product — LIKE-search products by name, SKU, or barcode.
 */
import { z } from "zod";
import { defineTool } from "../base";
import { register } from "../registry";
import { query } from "@/lib/db";

const params = z.object({
  q: z.string().min(1).max(80).describe("Search term — name, SKU, or barcode fragment"),
});

interface Row {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  reorder_level: number;
  stock_qty: number;
  selling_price: number;
}

register(defineTool<z.infer<typeof params>, { count: number }>({
  id: "find_product",
  description: "Search products by name, SKU, or barcode. Returns matches with stock + price.",
  parameters: params,
  tier: "read",
  ui: { label: "Find product", icon: "Package" },
  async execute(args) {
    const like = `%${args.q}%`;
    const rows = await query<Row>(
      `SELECT p.id, p.name, p.sku, p.barcode, p.reorder_level,
              COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id), 0) AS stock_qty,
              COALESCE(pp.price, 0) AS selling_price
       FROM products p
       LEFT JOIN (SELECT product_id, selling_price AS price FROM product_prices) pp ON pp.product_id = p.id
       WHERE p.active = 1 AND (p.name LIKE ?1 OR p.sku LIKE ?1 OR COALESCE(p.barcode, '') LIKE ?1)
       ORDER BY p.name LIMIT 20`,
      [like],
    );
    const output = rows.length === 0
      ? `No products match "${args.q}".`
      : rows.map((r) => {
          const low = r.stock_qty <= r.reorder_level && r.reorder_level > 0;
          return `  • ${r.name} (${r.sku}) · ${r.stock_qty} on hand${low ? " ⚠ LOW" : ""} · KES ${r.selling_price.toFixed(2)}`;
        }).join("\n");
    return {
      title: `${rows.length} match${rows.length === 1 ? "" : "es"} for "${args.q}"`,
      output,
      metadata: { count: rows.length },
    };
  },
}));

/**
 * get_low_stock — list products whose on-hand quantity is at or below
 * the reorder level. Handy for the model to answer "what should I
 * order today?" or to draft a reorder purchase-order.
 */
import { z } from "zod";
import { defineTool } from "../base";
import { register } from "../registry";
import { getLowStockProducts } from "@/services/pos-helpers";

const params = z.object({
  limit: z.number().int().min(1).max(200).optional().default(20).describe("Max products to return"),
});

register(defineTool<z.infer<typeof params>, { count: number }>({
  id: "get_low_stock",
  description: "List products at or below reorder level, oldest short first",
  parameters: params,
  tier: "read",
  ui: { label: "Low stock lookup", icon: "Warning" },
  async execute(args) {
    const items = await getLowStockProducts(args.limit);
    const output = items.length === 0
      ? "No products are below their reorder level."
      : `${items.length} product${items.length === 1 ? " is" : "s are"} at or below reorder level:\n` +
        items.map((p) => `  • ${p.name}: ${p.stock_qty} on hand (reorder at ${p.reorder_level})`).join("\n");
    return {
      title: `${items.length} product${items.length === 1 ? "" : "s"} low`,
      output,
      metadata: { count: items.length },
    };
  },
}));

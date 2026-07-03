/**
 * get_expiring — batches whose expiry date is within a window.
 * Powers "what should I discount / write off today?" and expiry alerts.
 */
import { z } from "zod";
import { defineTool } from "../base";
import { register } from "../registry";
import { getExpiringItems } from "@/services/pharmacy";

const params = z.object({
  days: z.number().int().min(1).max(365).optional().default(90)
    .describe("Days ahead to look (default 90)"),
});

register(defineTool<z.infer<typeof params>, { count: number }>({
  id: "get_expiring",
  description: "List batches expiring within N days, closest first",
  parameters: params,
  tier: "read",
  ui: { label: "Expiry watchlist", icon: "Clock" },
  async execute(args) {
    const items = await getExpiringItems(args.days);
    const output = items.length === 0
      ? `Nothing expiring in the next ${args.days} days.`
      : `${items.length} batch${items.length === 1 ? "" : "es"} expiring within ${args.days} days:\n` +
        items.slice(0, 30).map((b) => `  • ${b.product_name} · batch ${b.batch_number ?? "(none)"} · ${b.quantity} units · expires ${b.expiry_date}`).join("\n") +
        (items.length > 30 ? `\n… and ${items.length - 30} more` : "");
    return {
      title: `${items.length} expiring in ${args.days}d`,
      output,
      metadata: { count: items.length },
    };
  },
}));

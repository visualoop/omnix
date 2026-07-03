import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import { createProduct } from "@/services/inventory";

const params = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(1).max(60),
  unit: z.string().default("pcs"),
  category_id: z.string().optional(),
  buying_price: z.number().nonnegative().default(0),
  selling_price: z.number().nonnegative(),
  reorder_level: z.number().int().nonnegative().default(0),
  barcode: z.string().optional(),
  tax_rate: z.number().nonnegative().max(30).default(0),
});

register(defineWrite<z.infer<typeof params>>({
  id: "create_product",
  description: "Create a new inventory product with pricing. Requires approval.",
  parameters: params,
  ui: { label: "Create product", icon: "Package" },
  summary: (a) => `Create product "${a.name}" (${a.sku}) at KES ${a.selling_price}`,
  detail: (a) => `Unit: ${a.unit}. Reorder at ${a.reorder_level}. Buying KES ${a.buying_price}.`,
  async run(a) {
    const id = await createProduct({
      name: a.name, sku: a.sku, unit: a.unit,
      category_id: a.category_id ?? null,
      buying_price: a.buying_price, selling_price: a.selling_price,
      reorder_level: a.reorder_level, barcode: a.barcode ?? null,
      tax_rate: a.tax_rate,
    } as any);
    return { title: `Created "${a.name}"`, output: `Product created (id: ${id}). SKU ${a.sku}, KES ${a.selling_price}.`, metadata: { id } };
  },
}));

/**
 * Retail + Hardware write tools.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import {
  upsertBrand, createLayby, createSpecialOrder, recordShrinkage,
} from "@/services/retail";
import { createQuotation as createHardwareQuote, createDeliveryNote } from "@/services/hardware";

// ─── Retail brand ──────────────────────────────────────────
register(defineWrite<{ name: string; slug?: string }>({
  id: "create_brand",
  description: "Create or update a retail brand",
  parameters: z.object({ name: z.string().min(1).max(80), slug: z.string().optional() }),
  ui: { label: "New brand", icon: "TagSimple" },
  summary: (a) => `Create brand "${a.name}"`,
  async run(a) {
    const id = await upsertBrand({ name: a.name, slug: a.slug } as any);
    return { title: `Brand ${a.name}`, output: `Brand saved (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Layby ─────────────────────────────────────────────────
const laybyItem = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});
const laybyParams = z.object({
  customer_id: z.string(),
  items: z.array(laybyItem).min(1),
  deposit_amount: z.number().nonnegative(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof laybyParams>>({
  id: "create_layby",
  description: "Create a layby (installment purchase) for a customer",
  parameters: laybyParams,
  ui: { label: "New layby", icon: "Wallet" },
  summary: (a) => `Layby for customer ${a.customer_id.slice(0, 8)} · ${a.items.length} item${a.items.length === 1 ? "" : "s"} · deposit KES ${a.deposit_amount}`,
  async run(a, ctx) {
    const id = await createLayby({
      customerId: a.customer_id, items: a.items,
      depositAmount: a.deposit_amount, expiresAt: a.expires_at,
      notes: a.notes, userId: ctx.userId,
    } as any);
    return { title: "Layby created", output: `Layby created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Special Order ─────────────────────────────────────────
const soItem = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),
  supplier_id: z.string().optional(),
});
const soParams = z.object({
  customer_id: z.string(),
  items: z.array(soItem).min(1),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deposit_amount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof soParams>>({
  id: "create_special_order",
  description: "Create a special order (custom / non-stock item request)",
  parameters: soParams,
  ui: { label: "Special order", icon: "ShoppingBag" },
  summary: (a) => `Special order for customer ${a.customer_id.slice(0, 8)} · ${a.items.length} item${a.items.length === 1 ? "" : "s"}`,
  async run(a, ctx) {
    const id = await createSpecialOrder({
      customerId: a.customer_id, items: a.items,
      neededBy: a.needed_by, depositAmount: a.deposit_amount,
      notes: a.notes, userId: ctx.userId,
    } as any);
    return { title: "Special order created", output: `Special order created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Shrinkage ─────────────────────────────────────────────
const shrinkParams = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  reason: z.enum(["theft", "damage", "expired", "count_correction", "other"]),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof shrinkParams>>({
  id: "record_shrinkage",
  description: "Record product loss (theft / damage / expiry / count correction)",
  parameters: shrinkParams,
  tier: "destructive",  // reduces stock
  ui: { label: "Record shrinkage", icon: "Warning" },
  summary: (a) => `${a.reason.replace("_", " ")}: ${a.quantity}× product ${a.product_id.slice(0, 8)}`,
  async run(a, ctx) {
    const id = await recordShrinkage({
      productId: a.product_id, quantity: a.quantity, reason: a.reason,
      notes: a.notes, userId: ctx.userId,
    } as any);
    return { title: "Shrinkage recorded", output: `Loss recorded (id: ${id}). Stock adjusted.`, metadata: { id } };
  },
}));

// ─── Hardware Quotation ────────────────────────────────────
const quoteItemZ = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax_rate: z.number().nonnegative().default(0),
  uom: z.string().optional(),
  product_id: z.string().optional(),
});
const quoteParams = z.object({
  customer_id: z.string().optional(),
  salesperson_id: z.string().optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(quoteItemZ).min(1),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof quoteParams>>({
  id: "create_hardware_quotation",
  description: "Create a hardware quotation for a customer (draft)",
  parameters: quoteParams,
  ui: { label: "New quotation", icon: "FileText" },
  summary: (a) => `Hardware quote · ${a.items.length} line${a.items.length === 1 ? "" : "s"}`,
  async run(a, ctx) {
    const id = await createHardwareQuote({
      customerId: a.customer_id ?? null,
      userId: ctx.userId,
      salespersonId: a.salesperson_id,
      validUntil: a.valid_until,
      notes: a.notes,
      items: a.items,
    });
    return { title: "Quote created", output: `Quotation created (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Delivery Note ─────────────────────────────────────────
const dnItem = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  uom: z.string().optional(),
  product_id: z.string().optional(),
});
const dnParams = z.object({
  customer_id: z.string().optional(),
  sale_id: z.string().optional(),
  address: z.string().optional(),
  items: z.array(dnItem).min(1),
});
register(defineWrite<z.infer<typeof dnParams>>({
  id: "create_delivery_note",
  description: "Create a hardware delivery note",
  parameters: dnParams,
  ui: { label: "New delivery note", icon: "Truck" },
  summary: (a) => `Delivery note · ${a.items.length} item${a.items.length === 1 ? "" : "s"}${a.address ? ` → ${a.address}` : ""}`,
  async run(a) {
    const id = await createDeliveryNote({
      customerId: a.customer_id ?? null,
      saleId: a.sale_id,
      address: a.address,
      items: a.items,
    });
    return { title: "Delivery note created", output: `Delivery note created (id: ${id}).`, metadata: { id } };
  },
}));

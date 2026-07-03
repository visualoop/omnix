/**
 * More write tools — booking check-in/out, layby payment, GRN receive,
 * stock adjust, product update.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import { adjustStock, updateProduct } from "@/services/inventory";
import { createGoodsReceipt } from "@/services/erp";
import { checkIn, checkOut } from "@/services/hospitality";
import { recordLaybyPayment } from "@/services/retail";

// ─── Booking check-in ──────────────────────────────────────
register(defineWrite<{ booking_id: string; room_id: string }>({
  id: "check_in_booking",
  description: "Check a guest into a room. Marks the booking + room as occupied.",
  parameters: z.object({ booking_id: z.string(), room_id: z.string() }),
  ui: { label: "Check in", icon: "SignIn" },
  summary: (a) => `Check-in booking ${a.booking_id.slice(0, 8)} → room ${a.room_id.slice(0, 8)}`,
  async run(a) {
    const folioId = await checkIn(a.booking_id, a.room_id);
    return { title: "Checked in", output: `Guest checked in. Folio ${folioId} opened.`, metadata: { id: folioId } };
  },
}));

// ─── Booking check-out ─────────────────────────────────────
register(defineWrite<{ booking_id: string; manager_override?: boolean }>({
  id: "check_out_booking",
  description: "Check a guest out. Requires the folio to be paid unless manager_override.",
  parameters: z.object({
    booking_id: z.string(),
    manager_override: z.boolean().optional().default(false),
  }),
  tier: "destructive",  // finalises stay + touches accounting
  ui: { label: "Check out", icon: "SignOut" },
  summary: (a) => `Check-out booking ${a.booking_id.slice(0, 8)}${a.manager_override ? " (override)" : ""}`,
  async run(a) {
    await checkOut(a.booking_id, a.manager_override);
    return { title: "Checked out", output: `Booking ${a.booking_id} closed.`, metadata: {} };
  },
}));

// ─── Layby payment ─────────────────────────────────────────
const laybyPayParams = z.object({
  layby_id: z.string(),
  amount: z.number().positive(),
  method: z.enum(["cash", "mpesa", "bank", "card"]).default("cash"),
  reference: z.string().optional(),
});
register(defineWrite<z.infer<typeof laybyPayParams>>({
  id: "record_layby_payment",
  description: "Record an installment payment against a layby",
  parameters: laybyPayParams,
  ui: { label: "Layby payment", icon: "Money" },
  summary: (a) => `Layby ${a.layby_id.slice(0, 8)} · KES ${a.amount.toFixed(2)} via ${a.method}`,
  async run(a, ctx) {
    const id = await recordLaybyPayment({
      layby_id: a.layby_id,
      amount: a.amount,
      method: a.method,
      reference: a.reference,
      userId: ctx.userId,
    } as any);
    return { title: "Payment recorded", output: `Layby payment recorded (id: ${id}).`, metadata: { id } };
  },
}));

// ─── GRN — receive from PO ─────────────────────────────────
const grnItem = z.object({
  po_item_id: z.string(),
  product_id: z.string(),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  batch_number: z.string().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const grnParams = z.object({
  po_id: z.string(),
  supplier_id: z.string(),
  invoice_number: z.string().optional(),
  items: z.array(grnItem).min(1),
});
register(defineWrite<z.infer<typeof grnParams>>({
  id: "receive_goods",
  description: "Receive goods from a purchase order. Creates a GRN + updates stock.",
  parameters: grnParams,
  ui: { label: "Receive goods", icon: "Package" },
  summary: (a) => `GRN for PO ${a.po_id.slice(0, 8)} · ${a.items.length} line${a.items.length === 1 ? "" : "s"}${a.invoice_number ? ` · invoice ${a.invoice_number}` : ""}`,
  async run(a, ctx) {
    const id = await createGoodsReceipt({
      po_id: a.po_id,
      supplier_id: a.supplier_id,
      user_id: ctx.userId,
      invoice_number: a.invoice_number,
      items: a.items,
    } as any);
    return { title: "Goods received", output: `GRN created (id: ${id}). Stock updated.`, metadata: { id } };
  },
}));

// ─── Stock adjust ──────────────────────────────────────────
const stockAdjustParams = z.object({
  product_id: z.string(),
  quantity_delta: z.number().describe("Positive to add, negative to subtract"),
  reason: z.string().min(3).max(200),
});
register(defineWrite<z.infer<typeof stockAdjustParams>>({
  id: "adjust_stock",
  description: "Adjust product stock quantity. Positive delta adds, negative subtracts.",
  parameters: stockAdjustParams,
  tier: "destructive",  // mutates on-hand
  ui: { label: "Adjust stock", icon: "ArrowsClockwise" },
  summary: (a) => `${a.quantity_delta >= 0 ? "+" : ""}${a.quantity_delta} units on product ${a.product_id.slice(0, 8)} · ${a.reason}`,
  async run(a) {
    await adjustStock(a.product_id, a.quantity_delta, a.reason);
    return { title: "Stock adjusted", output: `Adjusted product ${a.product_id.slice(0, 8)} by ${a.quantity_delta}.`, metadata: {} };
  },
}));

// ─── Update product ────────────────────────────────────────
const updateProductParams = z.object({
  id: z.string(),
  name: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  category_id: z.string().optional(),
  buying_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
  reorder_level: z.number().int().nonnegative().optional(),
  barcode: z.string().optional(),
  tax_rate: z.number().nonnegative().max(30).optional(),
});
register(defineWrite<z.infer<typeof updateProductParams>>({
  id: "update_product",
  description: "Update fields on an existing product (name / prices / reorder level / etc.)",
  parameters: updateProductParams,
  ui: { label: "Update product", icon: "Pencil" },
  summary: (a) => `Update product ${a.id.slice(0, 8)}${a.name ? ` → "${a.name}"` : ""}`,
  detail: (a) => Object.entries(a).filter(([k]) => k !== "id").map(([k, v]) => `${k}: ${v}`).join("\n"),
  async run(a) {
    await updateProduct(a.id, a as any);
    return { title: "Product updated", output: `Product ${a.id.slice(0, 8)} updated.`, metadata: { id: a.id } };
  },
}));

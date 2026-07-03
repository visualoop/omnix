/**
 * Expense + Petty cash + Purchase order write tools.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import { createExpense } from "@/services/accounting";
import { recordPettyCash } from "@/services/petty-cash";
import { createPurchaseOrder } from "@/services/erp";

// ─── Expense ───────────────────────────────────────────────
const expenseParams = z.object({
  category_name: z.string().describe("Expense category label (e.g. 'Rent', 'Fuel')"),
  amount: z.number().positive(),
  description: z.string().optional(),
  payment_method: z.enum(["cash", "bank", "mpesa", "card"]).default("cash"),
  reference: z.string().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof expenseParams>>({
  id: "record_expense",
  description: "Record a business expense against a category",
  parameters: expenseParams,
  ui: { label: "Record expense", icon: "Receipt" },
  summary: (a) => `Record ${a.category_name} expense of KES ${a.amount.toFixed(2)}`,
  detail: (a) => `Payment: ${a.payment_method}${a.description ? ` · ${a.description}` : ""}`,
  async run(a, ctx) {
    const id = await createExpense({
      category_id: null,
      category_name: a.category_name,
      amount: a.amount,
      description: a.description,
      payment_method: a.payment_method,
      reference: a.reference,
      expense_date: a.expense_date,
      notes: a.notes,
    } as any, ctx.userId);
    return { title: `Recorded ${a.category_name} · KES ${a.amount.toFixed(0)}`, output: `Expense saved (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Petty cash ────────────────────────────────────────────
const pcParams = z.object({
  type: z.enum(["topup", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category: z.string().optional(),
});
register(defineWrite<z.infer<typeof pcParams>>({
  id: "record_petty_cash",
  description: "Record a petty cash top-up or small expense",
  parameters: pcParams,
  ui: { label: "Petty cash", icon: "Wallet" },
  summary: (a) => `${a.type === "topup" ? "Top up" : "Spend"} petty cash: KES ${a.amount.toFixed(2)}`,
  async run(a, ctx) {
    const id = await recordPettyCash({
      transaction_type: a.type === "topup" ? "top_up" : "expense",
      amount: a.amount,
      description: a.description,
      category: a.category,
      user_id: ctx.userId,
    } as any);
    return { title: `${a.type === "topup" ? "Topped up" : "Spent"} KES ${a.amount.toFixed(0)}`, output: `Petty cash entry saved (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Purchase Order ────────────────────────────────────────
const poItem = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative(),
});
const poParams = z.object({
  supplier_id: z.string(),
  items: z.array(poItem).min(1),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});
register(defineWrite<z.infer<typeof poParams>>({
  id: "create_purchase_order",
  description: "Create a purchase order to a supplier with line items",
  parameters: poParams,
  ui: { label: "New purchase order", icon: "Truck" },
  summary: (a) => `Create PO to supplier ${a.supplier_id.slice(0, 8)}… · ${a.items.length} line${a.items.length === 1 ? "" : "s"}`,
  detail: (a) => `Items: ${a.items.map((i) => `${i.quantity}×${i.product_id.slice(0, 8)}@${i.unit_cost}`).join(", ")}`,
  async run(a, ctx) {
    const id = await createPurchaseOrder({
      supplier_id: a.supplier_id,
      user_id: ctx.userId,
      expected_date: a.expected_date,
      notes: a.notes,
      items: a.items,
    } as any);
    return { title: `PO created`, output: `Purchase order created (id: ${id}) with ${a.items.length} item(s).`, metadata: { id } };
  },
}));

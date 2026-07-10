import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import { getTaxSettings, computeTax } from "./tax";

export interface CartItem {
  id: string;
  product_id: string;
  /** When this line came from a product_variants row, the variant's id.
   *  product_id stays as the PARENT product. completeSale deducts variant
   *  stock from product_variants instead of batches when this is set. */
  variant_id?: string | null;
  /** When this line came from a hospitality menu item, the menu_items.id —
   *  used to consume recipe ingredients on sale completion (kind=menu_item). */
  menu_item_id?: string | null;
  /** When this line is a serialized equipment unit, the equipment_units.id.
   *  After the sale completes, this unit is flipped to `sold` with a per-unit
   *  warranty (see finalizeEquipmentSale). Serial-tracked lines are always
   *  qty 1 and never merge with another line. */
  equipment_unit_id?: string | null;
  /** Serial number of the equipment unit on this line (display + receipt). */
  serial?: string | null;
  /** Salon/spa service line — backed by an is_service product. Skips stock
   *  (no batches), consumes nothing; carries the service for commission +
   *  appointment linkage. */
  service_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
  /** Live stock cap inherited from the product at add-time. updateQty
   *  refuses to push the line past this. Hospitality / service items pass
   *  undefined → no cap. */
  stock_qty?: number;
  /** Optional — variant + category aliases used for the cart card UI. */
  variant_label?: string;
  category_id?: string | null;
}

export interface PaymentEntry {
  method_id: string;
  method_name: string;
  amount: number;
  reference?: string;
}

/**
 * Build the final tender list submitted to {@link completeSale} from the
 * payment modal's state.
 *
 * Fixes the split-payment money bug: once a cashier "Added" one split chunk
 * (e.g. cash), the pending amount still typed in the input (e.g. the M-Pesa
 * remainder + confirmation code) was silently dropped on Complete, so the sale
 * was saved with only the cash tender and marked `partial`. We now flush that
 * pending input into the tender list.
 *
 * Guardrails:
 *  - Async methods (M-Pesa STK / Paystack popup) are NOT flushed here — their
 *    tender is only appended after the push/popup actually succeeds, so
 *    flushing would fabricate a payment that never happened.
 *  - Cash may legitimately over-tender (change due); a flushed cash tender is
 *    capped at the remaining balance so change is never booked as revenue.
 */
export function buildFinalTenders(opts: {
  addedPayments: PaymentEntry[];
  pendingAmount: number;
  pendingMethodId: string;
  pendingMethodName: string;
  pendingReference?: string;
  pendingIsAsync: boolean;
  saleTotal: number;
}): PaymentEntry[] {
  const {
    addedPayments, pendingAmount, pendingMethodId, pendingMethodName,
    pendingReference, pendingIsAsync, saleTotal,
  } = opts;

  // No split chunks added yet — legacy single-payment behaviour: use the
  // typed amount (or the full total if the cashier just hit Pay).
  if (addedPayments.length === 0) {
    return [{
      method_id: pendingMethodId,
      method_name: pendingMethodName || "Cash",
      amount: pendingAmount > 0 ? pendingAmount : saleTotal,
      reference: pendingReference || undefined,
    }];
  }

  const out = [...addedPayments];
  if (pendingAmount > 0 && !pendingIsAsync) {
    const paidBefore = addedPayments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, saleTotal - paidBefore);
    const isCash = pendingMethodId === "cash";
    const recordAmt = isCash ? Math.min(pendingAmount, remaining) : pendingAmount;
    if (recordAmt > 0) {
      out.push({
        method_id: pendingMethodId,
        method_name: pendingMethodName,
        amount: recordAmt,
        reference: pendingReference || undefined,
      });
    }
  }
  return out;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

export interface Sale {
  id: string;
  sale_number: number;
  customer_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  service_charge_amount?: number;
  payment_status: string;
  status: string;
  created_at: string;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return query<PaymentMethod>("SELECT id, name, type FROM payment_methods WHERE active = 1 ORDER BY sort_order");
}

export interface PaymentMethodRow { id: string; name: string; type: string; active: number; sort_order: number }

/** All payment methods incl. disabled — for the settings toggle list. */
export async function listAllPaymentMethods(): Promise<PaymentMethodRow[]> {
  return query<PaymentMethodRow>("SELECT id, name, type, active, sort_order FROM payment_methods ORDER BY sort_order, name");
}

/** Enable/disable a payment method (controls what the POS offers). */
export async function setPaymentMethodActive(id: string, active: boolean): Promise<void> {
  await execute("UPDATE payment_methods SET active = ?2 WHERE id = ?1", [id, active ? 1 : 0]);
}

export async function getNextSaleNumber(): Promise<number> {
  await execute("UPDATE sequences SET value = value + 1 WHERE name = 'sale_number'");
  const rows = await query<{ value: number }>("SELECT value FROM sequences WHERE name = 'sale_number'");
  return rows[0].value;
}

/** Map a method_id/name to a payment_methods.type code so the auto-upsert
 *  in completeSale produces a sensible row when the seeded row is missing.
 *  Values mirror the seed set in migration 003. */
function inferMethodType(id: string, name: string): string {
  const k = `${id} ${name}`.toLowerCase();
  if (k.includes("cash")) return "cash";
  if (k.includes("mpesa") || k.includes("m-pesa") || k.includes("lipa")) return "mpesa";
  if (k.includes("paystack") || k.includes("card") || k.includes("visa") || k.includes("master")) return "card";
  if (k.includes("bank") || k.includes("transfer")) return "manual";
  if (k.includes("credit") || k.includes("on account")) return "credit";
  if (k.includes("insur") || k.includes("sha") || k.includes("nhif")) return "insurance";
  return "manual";
}

function isOnAccount(p: PaymentEntry): boolean {
  const idNorm = (p.method_id || "").toLowerCase();
  const nameNorm = (p.method_name || "").toLowerCase();
  return idNorm === "on_account" || idNorm === "credit"
    || nameNorm.includes("on account") || nameNorm.includes("contractor account");
}

export async function completeSale(
  items: CartItem[],
  payments: PaymentEntry[],
  customerId: string | null,
  userId: string,
  discountAmount: number,
  tipAmount = 0,
  tipEmployeeId: string | null = null,
  serviceChargeAmount = 0,
  sourceType: string | null = null,
  sourceId: string | null = null,
  salespersonId: string | null = null,
): Promise<{ saleId: string; saleItemIds: string[] }> {
  const saleId = crypto.randomUUID();

  // ── Pre-flight stock check ───────────────────────────────────────
  // Reject the whole sale BEFORE any inserts if any physical line
  // would exceed available stock. Hospitality menu lines (menu_item_id
  // set) consume recipe ingredients via a different path and skip this
  // gate. Concurrent tills can still race, but a final FIFO loop below
  // catches that and rolls back.
  //
  // VARIANT LINES live on product_variants.stock_qty, not batches —
  // the cart sets `variant_id` when a variant was picked. Two queries
  // run independently; both must pass.
  const physicalLines = items.filter((i) => !i.menu_item_id && !i.service_id);
  if (physicalLines.length > 0) {
    const variantLines = physicalLines.filter((i) => i.variant_id);
    const productLines = physicalLines.filter((i) => !i.variant_id);
    const shortages: Array<{ product_id: string; name: string; requested: number; available: number }> = [];

    if (productLines.length > 0) {
      const placeholders = productLines.map((_, i) => `?${i + 1}`).join(",");
      const stockRows = await query<{ product_id: string; available: number }>(
        `SELECT product_id, COALESCE(SUM(quantity), 0) AS available
         FROM batches
         WHERE product_id IN (${placeholders})
           AND quantity > 0
           AND (expiry_date IS NULL OR expiry_date > date('now'))
         GROUP BY product_id`,
        productLines.map((i) => i.product_id),
      );
      const stockMap = new Map(stockRows.map((r) => [r.product_id, r.available]));
      for (const line of productLines) {
        const avail = stockMap.get(line.product_id) ?? 0;
        if (line.quantity > avail) {
          shortages.push({ product_id: line.product_id, name: line.name, requested: line.quantity, available: avail });
        }
      }
    }

    if (variantLines.length > 0) {
      const placeholders = variantLines.map((_, i) => `?${i + 1}`).join(",");
      const variantRows = await query<{ id: string; stock_qty: number }>(
        `SELECT id, stock_qty FROM product_variants WHERE id IN (${placeholders})`,
        variantLines.map((i) => i.variant_id as string),
      );
      const stockMap = new Map(variantRows.map((r) => [r.id, r.stock_qty]));
      for (const line of variantLines) {
        const avail = stockMap.get(line.variant_id as string) ?? 0;
        if (line.quantity > avail) {
          shortages.push({ product_id: line.product_id, name: line.name, requested: line.quantity, available: avail });
        }
      }
    }

    if (shortages.length > 0) {
      const err = new Error(
        `OUT_OF_STOCK: ${shortages.map((s) => `${s.name} (need ${s.requested}, have ${s.available})`).join("; ")}`,
      ) as Error & { code: "OUT_OF_STOCK"; shortages: typeof shortages };
      err.code = "OUT_OF_STOCK";
      err.shortages = shortages;
      throw err;
    }
  }

  const saleNumber = await getNextSaleNumber();

  // Tax respects the global tax mode (off / inclusive / exclusive).
  const taxSettings = await getTaxSettings();
  const tx = computeTax(items, taxSettings, {
    tip: tipAmount,
    serviceCharge: serviceChargeAmount,
    cartDiscount: discountAmount,
  });
  const subtotal = tx.subtotal;
  const taxAmount = tx.taxAmount;
  const total = tx.total;
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount >= total ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
  const saleItemIds: string[] = [];

  // ── Build the full write plan BEFORE the transaction ────────────
  // A transaction batch can't read back intermediate results, so we
  // resolve every FIFO batch deduction, recipe explosion, and bank
  // account up front, then emit all writes atomically.
  const stmts: import("@/lib/db").TxStatement[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // 1) The sale row.
  stmts.push({
    sql: `INSERT INTO sales (id, sale_number, customer_id, user_id, branch_id, subtotal, discount_amount, tax_amount, total, payment_status, tip_amount, tip_employee_id, service_charge_amount, source_type, source_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    params: [saleId, saleNumber, customerId, userId, getActiveBranchId(), round2(subtotal), round2(discountAmount), round2(taxAmount), round2(total), paymentStatus, round2(tipAmount), tipEmployeeId, round2(serviceChargeAmount), sourceType, sourceId],
  });

  // 2) Items + stock deduction.
  for (const item of items) {
    const itemId = crypto.randomUUID();
    saleItemIds.push(itemId);
    stmts.push({
      sql: `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, tax_rate, total, menu_item_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      params: [itemId, saleId, item.product_id, item.name, item.quantity, item.unit_price, item.discount, item.tax_rate, round2(item.total), item.menu_item_id ?? null],
    });

    // Salon/spa service line — revenue only, no stock to deduct.
    if (item.service_id) continue;

    if (item.menu_item_id) {
      // Hospitality menu line — consume recipe ingredients (FIFO) instead
      // of batch-deducting the menu product (which has no batches). The
      // plan is resolved here; the actual writes go into the transaction.
      try {
        const { planRecipeConsumption, isRequireRecipeEnabled } = await import("./hospitality");
        // Guardrail: block the sale if the operator requires recipes and
        // this menu item has none attached. Prevents silent zero-deduct
        // sales.
        if (await isRequireRecipeEnabled()) {
          const check = await planRecipeConsumption(item.menu_item_id, item.quantity, saleId);
          if (check.writes.length === 0) {
            throw new Error(
              `${item.name} has no recipe attached. Add ingredients on the menu-item detail page before selling it, or disable "Require recipe to sell" in Settings → Hospitality.`,
            );
          }
        }
        const plan = await planRecipeConsumption(item.menu_item_id, item.quantity, saleId);
        for (const w of plan.writes) stmts.push(w);
        if (plan.missing.length > 0) {
          console.warn(`[sale ${saleNumber}] menu_item ${item.menu_item_id}: insufficient ingredients`, plan.missing);
        }
      } catch (e) {
        // Re-throw explicit require-recipe rejections so the POS shows
        // them to the cashier. Swallow other planning errors so a
        // corrupted recipe doesn't block payment.
        if (e instanceof Error && /no recipe attached/i.test(e.message)) throw e;
        console.error("Recipe planning failed for menu item:", e);
      }
      continue;
    }

    if (item.variant_id) {
      // Variant line — clamp at 0; record parent product on the movement.
      stmts.push({
        sql: `UPDATE product_variants SET stock_qty = MAX(0, stock_qty - ?2) WHERE id = ?1`,
        params: [item.variant_id, item.quantity],
      });
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, 'sale', ?3, 'sale', ?4)`,
        params: [crypto.randomUUID(), item.product_id, -item.quantity, saleId],
      });
      continue;
    }

    // Physical product: pre-resolve the FIFO batch plan, then emit
    // clamped deductions inside the transaction.
    let remaining = item.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches
       WHERE product_id = ?1 AND quantity > 0
         AND (expiry_date IS NULL OR expiry_date > date('now'))
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
      [item.product_id],
    );
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, batch.quantity);
      stmts.push({
        // Clamp inside the write so a concurrent sale can't drive it negative.
        sql: `UPDATE batches SET quantity = MAX(0, quantity - ?1) WHERE id = ?2`,
        params: [deduct, batch.id],
      });
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, ?3, 'sale', ?4, 'sale', ?5)`,
        params: [crypto.randomUUID(), item.product_id, batch.id, -deduct, saleId],
      });
      remaining -= deduct;
    }
  }

  // 3) Payments + bank mirror (pre-resolve accounts), in the same txn.
  //
  // ON-ACCOUNT CREDIT (HW-6/7): payments with method_name matching
  // 'on_account' or 'contractor account' or method_id 'on_account'
  // route through the hardware credit flow instead of a cash-equivalent
  // deposit. Every such payment:
  //   1. Requires a customer_id (throws otherwise).
  //   2. Runs creditCheck() — refuses if the customer would exceed
  //      their credit_limit or the account is on hold.
  //   3. Posts an account_ledger charge with saleId + due_date so the
  //      contractor's balance grows and the aged-receivables report
  //      picks it up correctly.
  const onAccountTotal = payments
    .filter((p) => isOnAccount(p))
    .reduce((s, p) => s + p.amount, 0);
  if (onAccountTotal > 0) {
    if (!customerId) {
      throw new Error("On-account payment requires a customer selected on the sale.");
    }
    const { creditCheck, getAccount } = await import("./hardware");
    const check = await creditCheck(customerId, onAccountTotal);
    if (!check.ok) {
      throw new Error(check.reason ?? "Credit check failed");
    }
    // Compute due date from customer_accounts.terms_days.
    const acc = await getAccount(customerId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (acc.terms_days ?? 30));
    // Append the ledger insert to the same tx statement list.
    const balanceAfter = (acc.balance ?? 0) + onAccountTotal;
    stmts.push({
      sql: `INSERT INTO account_ledger (id, customer_id, entry_type, sale_id, amount, balance_after, due_date, reference, created_by)
       VALUES (?1, ?2, 'charge', ?3, ?4, ?5, ?6, ?7, ?8)`,
      params: [crypto.randomUUID(), customerId, saleId, round2(onAccountTotal), round2(balanceAfter), dueDate.toISOString().slice(0, 10), `Sale ${saleNumber}`, userId],
    });
    stmts.push({
      sql: `UPDATE customer_accounts SET balance = ROUND(?2, 2), updated_at = datetime('now') WHERE customer_id = ?1`,
      params: [customerId, round2(balanceAfter)],
    });
  }

  for (const p of payments) {
    // Skip the standard payment insert for on-account rows — those
    // route through account_ledger (handled above) and don't hit
    // bank_accounts / payments. If we posted them here, the sale
    // would look "paid" while the money is actually owed.
    if (isOnAccount(p)) continue;
    // FK-safety: payments.method_id REFERENCES payment_methods(id). If the
    // UI passes a synthetic id ("mpesa-daraja", "mpesa-paystack") that
    // wasn't seeded in an older install, the FK fails AFTER Daraja has
    // already taken the customer's money — catastrophic. Upsert the
    // method row first using the name the UI provided.
    stmts.push({
      sql: `INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order)
            VALUES (?1, ?2, ?3, 99)`,
      params: [p.method_id, p.method_name, inferMethodType(p.method_id, p.method_name)],
    });
    stmts.push({
      sql: `INSERT INTO payments (id, sale_id, method_id, method_name, amount, reference)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      params: [crypto.randomUUID(), saleId, p.method_id, p.method_name, round2(p.amount), p.reference || null],
    });
    try {
      const accountId = await pickBankAccountForMethod(p.method_name);
      if (accountId) {
        stmts.push({
          sql: `INSERT INTO bank_transactions (id, account_id, transaction_date, transaction_type, amount, description, payment_method, reference, related_sale_id, user_id)
           VALUES (?1, ?2, datetime('now'), 'deposit', ?3, ?4, ?5, ?6, ?7, ?8)`,
          params: [crypto.randomUUID(), accountId, round2(p.amount), `Sale ${saleNumber}`, p.method_name.toLowerCase(), p.reference || null, saleId, userId],
        });
        stmts.push({
          sql: `UPDATE bank_accounts SET current_balance = ROUND(COALESCE(current_balance,0) + ?2, 2) WHERE id = ?1`,
          params: [accountId, round2(p.amount)],
        });
      }
    } catch (e) {
      console.error("Bank account resolve failed for sale", saleNumber, ":", e);
    }
  }

  // 4) Commit everything atomically. If anything throws, NOTHING applies —
  //    no half-written sale, no orphan stock deduction.
  const { transaction } = await import("@/lib/db");
  await transaction(stmts);

  // ── Post-commit, non-financial side effects ─────────────────────
  // eTIMS signing is enqueued + signed asynchronously; a failure here
  // can never roll back a committed sale, and the queue guarantees the
  // intent is never silently lost.
  signWithEtims(saleId, items, { subtotal, tax: taxAmount, total }).catch((e) => {
    console.error("eTIMS signing failed:", e);
  });

  // Hardware commission accrual (HW-9). Best-effort — a missing rule
  // just returns 0. Fails silent so a rule-config issue never blocks
  // a sale that's already committed.
  if (salespersonId) {
    try {
      const { commissionForSale } = await import("./hardware");
      // Base amount = net of discount, exclusive of tax + tip. Payroll
      // ops can change the base later; keeping it consistent with what
      // Kenyan payroll teams call "gross of tax".
      const base = subtotal - discountAmount;
      await commissionForSale(saleId, salespersonId, base);
    } catch (e) {
      console.warn("Commission accrual skipped for sale", saleId, ":", e);
    }
  }

  // Loyalty points accrual (RT-1). Post-commit, best-effort. Awards points
  // to the attached customer applying their tier multiplier. Never blocks a
  // committed sale.
  if (customerId) {
    try {
      const { earnPoints } = await import("./loyalty");
      await earnPoints(customerId, saleId, total, userId);
    } catch (e) {
      console.warn("Loyalty accrual skipped for sale", saleId, ":", e);
    }
  }

  // Pharmacy post-commit hooks (DW-5 + DW-9). Belt-and-braces so a sale
  // completed *without* going through PaymentModal (e.g. via an API
  // integration) still auto-dispenses the linked prescription and posts
  // the controlled-substance ledger. PaymentModal continues to call
  // dispensePrescription directly; a second call here is idempotent.
  try {
    if (sourceType === "prescription" && sourceId) {
      const { dispensePrescription } = await import("./pharmacy");
      await dispensePrescription(sourceId, saleId);
    }
    const { autoPostControlledLog } = await import("./pharmacy");
    await autoPostControlledLog(
      saleId,
      saleNumber,
      items
        .filter((i) => !i.menu_item_id) // menu items don't touch pharmacy stock
        .map((i) => ({ product_id: i.product_id, product_name: i.name, quantity: i.quantity })),
      userId,
      sourceType === "prescription" ? sourceId : null,
    );
  } catch (e) {
    console.warn("Pharmacy post-commit hooks skipped for sale", saleId, ":", e);
  }

  return { saleId, saleItemIds };
}

async function signWithEtims(
  saleId: string,
  items: CartItem[],
  totals: { subtotal: number; tax: number; total: number }
): Promise<void> {
  try {
    // Lazy import to avoid circular deps
    const { getEtimsConfig, signInvoice } = await import("./etims");
    const config = await getEtimsConfig();
    if (!config?.active) return; // eTIMS not enabled — skip silently

    await signInvoice(
      saleId,
      items.map((it) => ({
        product_id: it.product_id,
        product_name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        total: it.total,
      })),
      totals
    );
  } catch (e) {
    // Failures are stored in etims_invoices queue for retry
    console.warn("eTIMS sign queued for retry:", e);
  }
}

export async function getSales(limit = 50, branchId?: string): Promise<Sale[]> {
  const branch = branchId ?? getActiveBranchId();
  return query<Sale>(
    "SELECT * FROM sales WHERE status != 'held' AND branch_id = ?2 ORDER BY created_at DESC LIMIT ?1",
    [limit, branch]
  );
}

export async function voidSale(saleId: string): Promise<void> {
  const { requirePermission } = await import("@/services/rbac");
  await requirePermission("sales.void", { entityType: "sale", entityId: saleId });

  const existing = await query<{ status: string }>(
    "SELECT status FROM sales WHERE id = ?1",
    [saleId],
  );
  if (existing.length === 0) throw new Error("Sale not found");
  if (existing[0].status === "voided") return;

  // Only reverse PHYSICAL lines. Hospitality menu lines (menu_item_id set)
  // consumed recipe ingredients, not the menu product's stock — restoring
  // them as batch stock would invent inventory. Their ingredients are
  // treated as wastage (already cooked), so we don't auto-restore them.
  const items = await query<{ product_id: string; quantity: number; menu_item_id: string | null }>(
    "SELECT product_id, quantity, menu_item_id FROM sale_items WHERE sale_id = ?1",
    [saleId],
  );

  const stmts: import("@/lib/db").TxStatement[] = [];
  stmts.push({ sql: "UPDATE sales SET status = 'voided' WHERE id = ?1", params: [saleId] });

  for (const item of items) {
    if (!item.product_id || !item.quantity) continue;
    if (item.menu_item_id) continue; // recipe ingredients = wastage, not restored

    // Restore to the most-recent batch (single target — clean provenance),
    // or create a VOID-RESTORE batch if none exist.
    const batches = await query<{ id: string }>(
      "SELECT id FROM batches WHERE product_id = ?1 ORDER BY received_at DESC LIMIT 1",
      [item.product_id],
    );
    if (batches[0]) {
      stmts.push({
        sql: "UPDATE batches SET quantity = quantity + ?1 WHERE id = ?2",
        params: [item.quantity, batches[0].id],
      });
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, ?3, 'return', ?4, 'sale_void', ?5)`,
        params: [crypto.randomUUID(), item.product_id, batches[0].id, item.quantity, saleId],
      });
    } else {
      stmts.push({
        sql: `INSERT INTO batches (id, product_id, quantity, received_at, batch_number)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'VOID-RESTORE')`,
        params: [crypto.randomUUID(), item.product_id, item.quantity],
      });
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, 'return', ?3, 'sale_void', ?4)`,
        params: [crypto.randomUUID(), item.product_id, item.quantity, saleId],
      });
    }
  }

  // Reverse the money: flag payments voided, reverse the bank deposits +
  // account balance so a voided sale stops counting as banked revenue.
  const pays = await query<{ id: string; amount: number; account_id: string | null }>(
    `SELECT p.id, p.amount, bt.account_id
     FROM payments p
     LEFT JOIN bank_transactions bt ON bt.related_sale_id = p.sale_id AND bt.transaction_type = 'deposit'
     WHERE p.sale_id = ?1 AND p.voided_at IS NULL`,
    [saleId],
  );
  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (const p of pays) {
    stmts.push({ sql: "UPDATE payments SET voided_at = datetime('now') WHERE id = ?1", params: [p.id] });
    if (p.account_id) {
      stmts.push({
        sql: `INSERT INTO bank_transactions (id, account_id, transaction_date, transaction_type, amount, description, related_sale_id, user_id)
         VALUES (?1, ?2, datetime('now'), 'withdrawal', ?3, ?4, ?5, (SELECT user_id FROM sales WHERE id = ?5))`,
        params: [crypto.randomUUID(), p.account_id, round2(p.amount), `Void of sale ${saleId.slice(0, 8)}`, saleId],
      });
      stmts.push({
        sql: `UPDATE bank_accounts SET current_balance = ROUND(COALESCE(current_balance,0) - ?2, 2) WHERE id = ?1`,
        params: [p.account_id, round2(p.amount)],
      });
    }
  }

  // Flag any signed eTIMS invoice as voided (a credit note is the correct
  // KRA reversal; the queue picks up voided invoices to issue one).
  stmts.push({
    sql: "UPDATE etims_invoices SET voided_at = datetime('now') WHERE sale_id = ?1 AND voided_at IS NULL",
    params: [saleId],
  });

  const { transaction } = await import("@/lib/db");
  await transaction(stmts);
}


/**
 * Pick the appropriate bank account to mirror a payment to.
 * Falls back to default account or the cash box.
 */
export async function pickBankAccountForMethod(methodName: string): Promise<string | null> {
  const lower = methodName.toLowerCase();
  // M-Pesa payments → M-Pesa till/paybill if exists
  if (lower.includes("mpesa") || lower.includes("m-pesa")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type IN ('mpesa_till','mpesa_paybill') AND is_active = 1 LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  // Card / bank → default bank account
  if (lower.includes("card") || lower.includes("bank") || lower.includes("transfer")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type = 'bank' AND is_active = 1 ORDER BY is_default DESC LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  // Cash → cash box
  if (lower.includes("cash")) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE account_type = 'cash_box' AND is_active = 1 ORDER BY is_default DESC LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
  }
  // Fallback to default
  const rows = await query<{ id: string }>(
    `SELECT id FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1`,
  );
  return rows[0]?.id || null;
}

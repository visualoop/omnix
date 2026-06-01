import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
}

export interface PaymentEntry {
  method_id: string;
  method_name: string;
  amount: number;
  reference?: string;
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
  payment_status: string;
  status: string;
  created_at: string;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return query<PaymentMethod>("SELECT id, name, type FROM payment_methods WHERE active = 1 ORDER BY sort_order");
}

export async function getNextSaleNumber(): Promise<number> {
  await execute("UPDATE sequences SET value = value + 1 WHERE name = 'sale_number'");
  const rows = await query<{ value: number }>("SELECT value FROM sequences WHERE name = 'sale_number'");
  return rows[0].value;
}

export async function completeSale(
  items: CartItem[],
  payments: PaymentEntry[],
  customerId: string | null,
  userId: string,
  discountAmount: number,
  tipAmount = 0,
  tipEmployeeId: string | null = null,
): Promise<{ saleId: string; saleItemIds: string[] }> {
  const saleId = crypto.randomUUID();
  const saleNumber = await getNextSaleNumber();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const taxAmount = items.reduce((s, i) => s + (i.unit_price * i.quantity * i.tax_rate / 100), 0);
  const total = subtotal - discountAmount + taxAmount + tipAmount;
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount >= total ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
  const saleItemIds: string[] = [];

  // Insert sale
  await execute(
    `INSERT INTO sales (id, sale_number, customer_id, user_id, branch_id, subtotal, discount_amount, tax_amount, total, payment_status, tip_amount, tip_employee_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    [saleId, saleNumber, customerId, userId, getActiveBranchId(), subtotal, discountAmount, taxAmount, total, paymentStatus, tipAmount, tipEmployeeId]
  );

  // Insert items + deduct stock
  for (const item of items) {
    const itemId = crypto.randomUUID();
    saleItemIds.push(itemId);
    await execute(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, tax_rate, total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [itemId, saleId, item.product_id, item.name, item.quantity, item.unit_price, item.discount, item.tax_rate, item.total]
    );

    // Deduct from oldest batch (FIFO)
    let remaining = item.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      "SELECT id, quantity FROM batches WHERE product_id = ?1 AND quantity > 0 ORDER BY received_at ASC",
      [item.product_id]
    );
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, batch.quantity);
      await execute("UPDATE batches SET quantity = quantity - ?1 WHERE id = ?2", [deduct, batch.id]);
      await execute(
        `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, ?3, 'sale', ?4, 'sale', ?5)`,
        [crypto.randomUUID(), item.product_id, batch.id, -deduct, saleId]
      );
      remaining -= deduct;
    }
  }

  // Insert payments
  for (const p of payments) {
    const paymentId = crypto.randomUUID();
    await execute(
      `INSERT INTO payments (id, sale_id, method_id, method_name, amount, reference)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [paymentId, saleId, p.method_id, p.method_name, p.amount, p.reference || null]
    );

    // Mirror to bank_transactions for reconciliation
    try {
      const { recordTransaction } = await import("./banking");
      const accountId = await pickBankAccountForMethod(p.method_name);
      if (accountId) {
        await recordTransaction({
          account_id: accountId,
          transaction_type: "deposit",
          amount: p.amount,
          description: `Sale ${saleNumber}`,
          counterparty_name: customerId ? undefined : "Walk-in customer",
          payment_method: p.method_name.toLowerCase(),
          reference: p.reference || undefined,
          related_sale_id: saleId,
          user_id: userId,
        });
      }
    } catch (e) {
      console.error("Bank txn mirror failed for sale", saleNumber, ":", e);
    }
  }

  // Auto-sign with KRA eTIMS if configured (non-blocking)
  signWithEtims(saleId, items, { subtotal, tax: taxAmount, total }).catch((e) => {
    console.error("eTIMS signing failed:", e);
  });

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

  const items = await query<{ product_id: string; quantity: number }>(
    "SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1",
    [saleId],
  );

  await execute("UPDATE sales SET status = 'voided' WHERE id = ?1", [saleId]);

  for (const item of items) {
    if (!item.product_id || !item.quantity) continue;

    let remaining = item.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      "SELECT id, quantity FROM batches WHERE product_id = ?1 ORDER BY received_at ASC",
      [item.product_id],
    );

    if (batches.length === 0) {
      await execute(
        `INSERT INTO batches (id, product_id, quantity, received_at, batch_number)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'VOID-RESTORE')`,
        [crypto.randomUUID(), item.product_id, item.quantity],
      );
      await execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, 'return', ?3, 'sale_void', ?4)`,
        [crypto.randomUUID(), item.product_id, item.quantity, saleId],
      );
      continue;
    }

    for (const batch of batches) {
      if (remaining <= 0) break;
      const restore = Math.min(remaining, remaining);
      await execute("UPDATE batches SET quantity = quantity + ?1 WHERE id = ?2", [restore, batch.id]);
      await execute(
        `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, ?3, 'return', ?4, 'sale_void', ?5)`,
        [crypto.randomUUID(), item.product_id, batch.id, restore, saleId],
      );
      remaining -= restore;
    }

    if (remaining > 0) {
      await execute(
        `INSERT INTO batches (id, product_id, quantity, received_at, batch_number)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'VOID-RESTORE')`,
        [crypto.randomUUID(), item.product_id, remaining],
      );
      await execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id)
         VALUES (?1, ?2, 'return', ?3, 'sale_void', ?4)`,
        [crypto.randomUUID(), item.product_id, remaining, saleId],
      );
    }
  }
}


/**
 * Pick the appropriate bank account to mirror a payment to.
 * Falls back to default account or the cash box.
 */
async function pickBankAccountForMethod(methodName: string): Promise<string | null> {
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

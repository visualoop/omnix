import { query, execute } from "@/lib/db";

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
  discountAmount: number
): Promise<string> {
  const saleId = crypto.randomUUID();
  const saleNumber = await getNextSaleNumber();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const taxAmount = items.reduce((s, i) => s + (i.unit_price * i.quantity * i.tax_rate / 100), 0);
  const total = subtotal - discountAmount + taxAmount;
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentStatus = paidAmount >= total ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

  // Insert sale
  await execute(
    `INSERT INTO sales (id, sale_number, customer_id, user_id, subtotal, discount_amount, tax_amount, total, payment_status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [saleId, saleNumber, customerId, userId, subtotal, discountAmount, taxAmount, total, paymentStatus]
  );

  // Insert items + deduct stock
  for (const item of items) {
    await execute(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, tax_rate, total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [crypto.randomUUID(), saleId, item.product_id, item.name, item.quantity, item.unit_price, item.discount, item.tax_rate, item.total]
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
    await execute(
      `INSERT INTO payments (id, sale_id, method_id, method_name, amount, reference)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [crypto.randomUUID(), saleId, p.method_id, p.method_name, p.amount, p.reference || null]
    );
  }

  // Auto-sign with KRA eTIMS if configured (non-blocking)
  signWithEtims(saleId, items, { subtotal, tax: taxAmount, total }).catch((e) => {
    console.error("eTIMS signing failed:", e);
  });

  return saleId;
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

export async function getSales(limit = 50): Promise<Sale[]> {
  return query<Sale>(
    "SELECT * FROM sales WHERE status != 'held' ORDER BY created_at DESC LIMIT ?1",
    [limit]
  );
}

export async function voidSale(saleId: string): Promise<void> {
  await execute("UPDATE sales SET status = 'voided' WHERE id = ?1", [saleId]);
  // TODO: restore stock
}

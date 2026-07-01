import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

// ============================================================
// Suppliers
// ============================================================

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  balance_owed: number;
  notes: string | null;
  active: number;
  created_at: string;
}

export async function listSuppliers(activeOnly = true): Promise<Supplier[]> {
  const sql = activeOnly
    ? "SELECT * FROM suppliers WHERE active = 1 ORDER BY name"
    : "SELECT * FROM suppliers ORDER BY name";
  return query<Supplier>(sql);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const rows = await query<Supplier>("SELECT * FROM suppliers WHERE id = ?1", [id]);
  return rows[0] || null;
}

export async function upsertSupplier(input: Partial<Supplier> & { name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE suppliers SET name=?1, contact_person=?2, phone=?3, email=?4, address=?5,
         payment_terms=?6, notes=?7, active=COALESCE(?8, active) WHERE id=?9`,
      [input.name, input.contact_person || null, input.phone || null, input.email || null,
       input.address || null, input.payment_terms || null, input.notes || null,
       input.active === undefined ? null : input.active, input.id]
    );
  } else {
    await execute(
      `INSERT INTO suppliers (id, name, contact_person, phone, email, address, payment_terms, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [id, input.name, input.contact_person || null, input.phone || null, input.email || null,
       input.address || null, input.payment_terms || null, input.notes || null]
    );
  }
  return id;
}

export async function deactivateSupplier(id: string): Promise<void> {
  await execute("UPDATE suppliers SET active = 0 WHERE id = ?1", [id]);
}

// ============================================================
// Customers
// ============================================================

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_group_id: string | null;
  credit_limit: number;
  balance: number;          // amount owed to us (positive = customer owes us)
  notes: string | null;
  active: number;
  created_at: string;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  if (search?.trim()) {
    return query<Customer>(
      `SELECT * FROM customers WHERE active = 1 AND (name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1)
       ORDER BY name LIMIT 100`,
      [`%${search.trim()}%`]
    );
  }
  return query<Customer>("SELECT * FROM customers WHERE active = 1 ORDER BY name LIMIT 200");
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const rows = await query<Customer>("SELECT * FROM customers WHERE id = ?1", [id]);
  return rows[0] || null;
}

export async function upsertCustomer(input: Partial<Customer> & { name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE customers SET name=?1, phone=?2, email=?3, credit_limit=?4, notes=?5,
         active=COALESCE(?6, active) WHERE id=?7`,
      [input.name, input.phone || null, input.email || null,
       input.credit_limit ?? 0, input.notes || null,
       input.active === undefined ? null : input.active, input.id]
    );
  } else {
    await execute(
      `INSERT INTO customers (id, name, phone, email, credit_limit, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [id, input.name, input.phone || null, input.email || null,
       input.credit_limit ?? 0, input.notes || null]
    );
  }
  return id;
}

export async function getCustomerStats(customerId: string): Promise<{
  total_purchases: number;
  total_amount: number;
  last_purchase: string | null;
  outstanding_balance: number;
}> {
  // Purchase count + gross + refunds per customer. Net total = gross -
  // refunds (won't go negative). Both aggregates in a single pass so a
  // customer detail page doesn't need two round trips.
  const rows = await query<{
    total_purchases: number;
    gross_amount: number;
    refunds_amount: number;
    last_purchase: string | null;
  }>(
    `SELECT COUNT(*) as total_purchases,
            COALESCE(SUM(total), 0) as gross_amount,
            COALESCE(SUM(refunded_amount), 0) as refunds_amount,
            MAX(created_at) as last_purchase
     FROM sales WHERE customer_id = ?1 AND status = 'completed'`,
    [customerId]
  );
  const customer = await getCustomer(customerId);
  const gross = rows[0]?.gross_amount ?? 0;
  const refunds = rows[0]?.refunds_amount ?? 0;
  return {
    total_purchases: rows[0]?.total_purchases ?? 0,
    total_amount: Math.max(0, gross - refunds),
    last_purchase: rows[0]?.last_purchase ?? null,
    outstanding_balance: customer?.balance || 0,
  };
}

// ============================================================
// Purchase Orders
// ============================================================

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  user_id: string;
  order_date: string;
  expected_date: string | null;
  status: "draft" | "pending_approval" | "approved" | "sent" | "partial" | "received" | "cancelled";
  subtotal: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  // Joined
  supplier_name?: string;
  user_name?: string;
  item_count?: number;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
}

export async function listPurchaseOrders(filter?: { status?: string; supplier_id?: string }): Promise<PurchaseOrder[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filter?.status) { conditions.push(`po.status = ?${idx++}`); params.push(filter.status); }
  if (filter?.supplier_id) { conditions.push(`po.supplier_id = ?${idx++}`); params.push(filter.supplier_id); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<PurchaseOrder>(
    `SELECT po.*, s.name as supplier_name, u.full_name as user_name,
            (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as item_count
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.user_id
     ${where}
     ORDER BY po.created_at DESC LIMIT 200`,
    params
  );
}

export async function getPurchaseOrder(id: string): Promise<{ po: PurchaseOrder; items: POItem[] } | null> {
  const pos = await query<PurchaseOrder>(
    `SELECT po.*, s.name as supplier_name, u.full_name as user_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.user_id
     WHERE po.id = ?1`,
    [id]
  );
  if (!pos[0]) return null;
  const items = await query<POItem>("SELECT * FROM purchase_order_items WHERE po_id = ?1", [id]);
  return { po: pos[0], items };
}

export interface CreatePOInput {
  supplier_id: string;
  user_id: string;
  expected_date?: string;
  items: Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }>;
  notes?: string;
}

async function nextPONumber(): Promise<string> {
  const rows = await query<{ next: number }>(
    "SELECT COALESCE(MAX(CAST(SUBSTR(po_number, 4) AS INTEGER)), 0) + 1 as next FROM purchase_orders WHERE po_number LIKE 'PO-%'"
  );
  return `PO-${String(rows[0]?.next || 1).padStart(5, "0")}`;
}

export async function createPurchaseOrder(input: CreatePOInput): Promise<string> {
  const poId = crypto.randomUUID();
  const poNumber = await nextPONumber();
  const subtotal = input.items.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
  const total = subtotal; // tax can be added later

  await execute(
    `INSERT INTO purchase_orders (id, po_number, supplier_id, user_id, expected_date, subtotal, total, notes, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [poId, poNumber, input.supplier_id, input.user_id, input.expected_date || null,
     subtotal, total, input.notes || null, getActiveBranchId()]
  );

  for (const [idx, item] of input.items.entries()) {
    await execute(
      `INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, line_total, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [crypto.randomUUID(), poId, item.product_id, item.product_name,
       item.quantity, item.unit_cost, item.unit_cost * item.quantity, idx]
    );
  }
  return poId;
}

export async function updatePOStatus(id: string, status: PurchaseOrder["status"]): Promise<void> {
  await execute("UPDATE purchase_orders SET status = ?1, updated_at = datetime('now') WHERE id = ?2", [status, id]);
}

// ============================================================
// Goods Receipts (receiving stock from PO)
// ============================================================

export interface CreateGRNInput {
  po_id?: string;
  supplier_id: string;
  user_id: string;
  invoice_number?: string;
  notes?: string;
  items: Array<{
    po_item_id?: string;
    product_id: string;
    quantity: number;
    unit_cost: number;
    batch_number?: string;
    expiry_date?: string;
  }>;
}

async function nextGRNNumber(): Promise<string> {
  const rows = await query<{ next: number }>(
    "SELECT COALESCE(MAX(CAST(SUBSTR(grn_number, 5) AS INTEGER)), 0) + 1 as next FROM goods_receipts WHERE grn_number LIKE 'GRN-%'"
  );
  return `GRN-${String(rows[0]?.next || 1).padStart(5, "0")}`;
}

export async function createGoodsReceipt(input: CreateGRNInput): Promise<string> {
  const grnId = crypto.randomUUID();
  const grnNumber = await nextGRNNumber();
  const total = input.items.reduce((s, i) => s + i.unit_cost * i.quantity, 0);

  await execute(
    `INSERT INTO goods_receipts (id, grn_number, po_id, supplier_id, user_id, invoice_number, notes, total)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [grnId, grnNumber, input.po_id || null, input.supplier_id, input.user_id,
     input.invoice_number || null, input.notes || null, total]
  );

  for (const item of input.items) {
    // Insert GRN line
    await execute(
      `INSERT INTO goods_receipt_items (id, grn_id, po_item_id, product_id, quantity, unit_cost, batch_number, expiry_date, line_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [crypto.randomUUID(), grnId, item.po_item_id || null, item.product_id,
       item.quantity, item.unit_cost, item.batch_number || null, item.expiry_date || null,
       item.unit_cost * item.quantity]
    );

    // Add to inventory: create batch
    const batchId = crypto.randomUUID();
    await execute(
      `INSERT INTO batches (id, product_id, batch_number, expiry_date, buying_price, quantity, supplier_id, received_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))`,
      [batchId, item.product_id, item.batch_number || null, item.expiry_date || null,
       item.unit_cost, item.quantity, input.supplier_id]
    );

    // Stock movement
    await execute(
      `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, user_id)
       VALUES (?1, ?2, ?3, 'purchase', ?4, 'grn', ?5, ?6)`,
      [crypto.randomUUID(), item.product_id, batchId, item.quantity, grnNumber, input.user_id]
    );

    // Update PO item received_quantity
    if (item.po_item_id) {
      await execute(
        `UPDATE purchase_order_items SET received_quantity = received_quantity + ?1 WHERE id = ?2`,
        [item.quantity, item.po_item_id]
      );
    }
  }

  // Update PO status if linked
  if (input.po_id) {
    const po = await getPurchaseOrder(input.po_id);
    if (po) {
      const allReceived = po.items.every((it) => it.received_quantity >= it.quantity);
      const someReceived = po.items.some((it) => it.received_quantity > 0);
      const newStatus = allReceived ? "received" : someReceived ? "partial" : "sent";
      await updatePOStatus(input.po_id, newStatus);
    }
  }

  // Update supplier balance owed
  await execute(
    "UPDATE suppliers SET balance_owed = balance_owed + ?1 WHERE id = ?2",
    [total, input.supplier_id]
  );

  return grnId;
}

// ============================================================
// Sale Returns
// ============================================================

export interface SaleReturn {
  id: string;
  return_number: string;
  sale_id: string | null;
  customer_id: string | null;
  user_id: string;
  return_date: string;
  reason: string;
  refund_method: string;
  refund_amount: number;
  restock_to_inventory: number;
  notes: string | null;
  created_at: string;
  customer_name?: string;
  cashier_name?: string;
  sale_number?: number;
}

export interface CreateReturnInput {
  sale_id?: string;
  customer_id?: string;
  user_id: string;
  reason: string;
  refund_method: string;
  refund_amount: number;
  restock_to_inventory: boolean;
  notes?: string;
  items: Array<{
    sale_item_id?: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    reason?: string;
  }>;
}

async function nextReturnNumber(): Promise<string> {
  const rows = await query<{ next: number }>(
    "SELECT COALESCE(MAX(CAST(SUBSTR(return_number, 4) AS INTEGER)), 0) + 1 as next FROM sale_returns WHERE return_number LIKE 'RT-%'"
  );
  return `RT-${String(rows[0]?.next || 1).padStart(5, "0")}`;
}

export async function createSaleReturn(input: CreateReturnInput): Promise<string> {
  const id = crypto.randomUUID();
  const number = await nextReturnNumber();
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Build the whole return as one atomic unit: the return header, each
  // line + its restock, and the refund's bank withdrawal. A crash mid-way
  // must not leave a refund recorded with stock un-restored (or vice
  // versa). Reads (FIFO batch target, refund account) resolve up front.
  const stmts: import("@/lib/db").TxStatement[] = [];

  stmts.push({
    sql: `INSERT INTO sale_returns (id, return_number, sale_id, customer_id, user_id, reason, refund_method, refund_amount, restock_to_inventory, notes, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    params: [id, number, input.sale_id || null, input.customer_id || null, input.user_id,
      input.reason, input.refund_method, round2(input.refund_amount),
      input.restock_to_inventory ? 1 : 0, input.notes || null, getActiveBranchId()],
  });

  for (const item of input.items) {
    const lineTotal = round2(item.unit_price * item.quantity);
    stmts.push({
      sql: `INSERT INTO sale_return_items (id, return_id, sale_item_id, product_id, product_name, quantity, unit_price, line_total, reason)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      params: [crypto.randomUUID(), id, item.sale_item_id || null, item.product_id, item.product_name,
        item.quantity, item.unit_price, lineTotal, item.reason || null],
    });

    if (input.restock_to_inventory) {
      const batches = await query<{ id: string }>(
        "SELECT id FROM batches WHERE product_id = ?1 ORDER BY received_at DESC LIMIT 1",
        [item.product_id],
      );
      if (batches[0]) {
        stmts.push({
          sql: "UPDATE batches SET quantity = quantity + ?1 WHERE id = ?2",
          params: [item.quantity, batches[0].id],
        });
      } else {
        stmts.push({
          sql: `INSERT INTO batches (id, product_id, quantity, received_at, batch_number)
           VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'RETURN-RESTOCK')`,
          params: [crypto.randomUUID(), item.product_id, item.quantity],
        });
      }
      stmts.push({
        sql: `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id, user_id)
         VALUES (?1, ?2, 'return', ?3, 'sale_return', ?4, ?5)`,
        params: [crypto.randomUUID(), item.product_id, item.quantity, number, input.user_id],
      });
    }
  }

  // Mirror the refund as money LEAVING the till (a withdrawal), the exact
  // inverse of the deposit completeSale recorded — so the bank reconciles.
  //
  // 'store_credit' + 'credit' refunds are the exception: no cash leaves
  // the till. Instead we reduce the customer's outstanding_balance by
  // the refund amount (they owe less). If the customer already paid in
  // full, this bumps them into "positive credit" territory (customers.balance
  // goes negative — a credit note the shop owes them, redeemable on a
  // future purchase).
  const refundMethod = (input.refund_method || "cash").toLowerCase();
  const isStoreCredit = refundMethod === "store_credit" || refundMethod === "credit";

  if (input.refund_amount > 0 && isStoreCredit && input.customer_id) {
    stmts.push({
      sql: `UPDATE customers
              SET balance = ROUND(COALESCE(balance, 0) - ?2, 2),
                  updated_at = datetime('now')
            WHERE id = ?1`,
      params: [input.customer_id, round2(input.refund_amount)],
    });
  } else if (input.refund_amount > 0) {
    try {
      const { pickBankAccountForMethod } = await import("@/services/sales");
      const accountId = await pickBankAccountForMethod(refundMethod);
      if (accountId) {
        stmts.push({
          sql: `INSERT INTO bank_transactions (id, account_id, transaction_date, transaction_type, amount, description, payment_method, related_sale_id, user_id)
           VALUES (?1, ?2, datetime('now'), 'withdrawal', ?3, ?4, ?5, ?6, ?7)`,
          params: [crypto.randomUUID(), accountId, round2(input.refund_amount), `Refund ${number}`,
            refundMethod, input.sale_id || null, input.user_id],
        });
        stmts.push({
          sql: `UPDATE bank_accounts SET current_balance = ROUND(COALESCE(current_balance,0) - ?2, 2) WHERE id = ?1`,
          params: [accountId, round2(input.refund_amount)],
        });
      }
    } catch (e) {
      console.error("Refund bank account resolve failed:", e);
    }
  }

  const { transaction } = await import("@/lib/db");
  await transaction(stmts);

  return id;
}

export async function listReturns(): Promise<SaleReturn[]> {
  return query<SaleReturn>(
    `SELECT r.*, c.name as customer_name, u.full_name as cashier_name, s.sale_number
     FROM sale_returns r
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN sales s ON s.id = r.sale_id
     ORDER BY r.created_at DESC LIMIT 200`
  );
}

// ============================================================
// Stock Take (cycle count)
// ============================================================

export interface StockTake {
  id: string;
  reference: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  status: "in_progress" | "completed" | "cancelled";
  notes: string | null;
  total_variance: number;
  total_value_variance: number;
  user_name?: string;
  item_count?: number;
}

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  unit_cost: number | null;
  value_variance: number | null;
  counted_at: string | null;
  notes: string | null;
  product_name?: string;
  product_sku?: string;
}

export async function createStockTake(userId: string, notes?: string): Promise<string> {
  const id = crypto.randomUUID();
  const ref = `ST-${Date.now()}`;

  await execute(
    `INSERT INTO stock_takes (id, reference, user_id, notes, branch_id) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, ref, userId, notes || null, getActiveBranchId()]
  );

  // Snapshot current stock for all active products
  const products = await query<{ id: string; current_stock: number; buying_price: number }>(
    `SELECT p.id,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as current_stock,
       COALESCE(pp.buying_price, 0) as buying_price
     FROM products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id
     WHERE p.active = 1`
  );

  for (const p of products) {
    await execute(
      `INSERT INTO stock_take_items (id, stock_take_id, product_id, expected_quantity, unit_cost)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
      [crypto.randomUUID(), id, p.id, p.current_stock, p.buying_price]
    );
  }

  return id;
}

export async function listStockTakes(): Promise<StockTake[]> {
  return query<StockTake>(
    `SELECT st.*, u.full_name as user_name,
       (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = st.id) as item_count
     FROM stock_takes st
     LEFT JOIN users u ON u.id = st.user_id
     ORDER BY st.started_at DESC`
  );
}

export async function getStockTakeItems(stockTakeId: string, search?: string): Promise<StockTakeItem[]> {
  const searchFilter = search?.trim() ? `AND (p.name LIKE ?2 OR p.sku LIKE ?2)` : "";
  const params: unknown[] = [stockTakeId];
  if (search?.trim()) params.push(`%${search.trim()}%`);
  return query<StockTakeItem>(
    `SELECT sti.*, p.name as product_name, p.sku as product_sku
     FROM stock_take_items sti
     JOIN products p ON p.id = sti.product_id
     WHERE sti.stock_take_id = ?1 ${searchFilter}
     ORDER BY p.name LIMIT 500`,
    params
  );
}

export async function recordCount(itemId: string, countedQty: number): Promise<void> {
  const item = (await query<StockTakeItem>("SELECT * FROM stock_take_items WHERE id = ?1", [itemId]))[0];
  if (!item) return;
  const variance = countedQty - item.expected_quantity;
  const valueVariance = variance * (item.unit_cost || 0);
  await execute(
    `UPDATE stock_take_items SET counted_quantity = ?1, variance = ?2, value_variance = ?3, counted_at = datetime('now')
     WHERE id = ?4`,
    [countedQty, variance, valueVariance, itemId]
  );
}

export async function completeStockTake(stockTakeId: string, applyAdjustments: boolean, userId: string): Promise<void> {
  // Calculate totals
  const totals = await query<{ total_variance: number; total_value_variance: number }>(
    `SELECT COALESCE(SUM(variance), 0) as total_variance,
            COALESCE(SUM(value_variance), 0) as total_value_variance
     FROM stock_take_items WHERE stock_take_id = ?1 AND counted_quantity IS NOT NULL`,
    [stockTakeId]
  );

  await execute(
    `UPDATE stock_takes SET status = 'completed', completed_at = datetime('now'),
       total_variance = ?1, total_value_variance = ?2 WHERE id = ?3`,
    [totals[0]?.total_variance || 0, totals[0]?.total_value_variance || 0, stockTakeId]
  );

  if (applyAdjustments) {
    // Apply variances to inventory
    const items = await query<StockTakeItem>(
      "SELECT * FROM stock_take_items WHERE stock_take_id = ?1 AND counted_quantity IS NOT NULL AND variance != 0",
      [stockTakeId]
    );
    for (const item of items) {
      // Get oldest batch
      const batches = await query<{ id: string; quantity: number }>(
        "SELECT id, quantity FROM batches WHERE product_id = ?1 ORDER BY received_at ASC LIMIT 1",
        [item.product_id]
      );
      if (batches[0]) {
        const newQty = batches[0].quantity + (item.variance || 0);
        await execute("UPDATE batches SET quantity = ?1 WHERE id = ?2",
          [Math.max(0, newQty), batches[0].id]);
      }
      await execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id, user_id)
         VALUES (?1, ?2, 'adjustment', ?3, 'stock_take', ?4, ?5)`,
        [crypto.randomUUID(), item.product_id, item.variance || 0, "Stock take", userId]
      );
    }
  }
}

// ============================================================
// Patient Profiles (pharmacy module)
// ============================================================

export interface PatientProfile {
  customer_id: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  blood_type: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  pregnant: number;
  breastfeeding: number;
  chronic_conditions: string | null;
  current_medications: string | null;
  notes: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
}

export interface PatientAllergy {
  id: string;
  customer_id: string;
  allergen: string;
  severity: "mild" | "moderate" | "severe" | "life-threatening";
  reaction: string | null;
  notes: string | null;
}

export async function getPatientProfile(customerId: string): Promise<{
  profile: PatientProfile | null;
  allergies: PatientAllergy[];
}> {
  const profile = await query<PatientProfile>(
    "SELECT * FROM patient_profiles WHERE customer_id = ?1",
    [customerId]
  );
  const allergies = await query<PatientAllergy>(
    "SELECT * FROM patient_allergies WHERE customer_id = ?1 ORDER BY severity DESC",
    [customerId]
  );
  return { profile: profile[0] || null, allergies };
}

export async function upsertPatientProfile(input: PatientProfile): Promise<void> {
  await execute(
    `INSERT INTO patient_profiles (customer_id, date_of_birth, gender, blood_type, weight_kg, height_cm,
       pregnant, breastfeeding, chronic_conditions, current_medications, notes, emergency_contact, emergency_phone, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
     ON CONFLICT(customer_id) DO UPDATE SET
       date_of_birth = excluded.date_of_birth,
       gender = excluded.gender,
       blood_type = excluded.blood_type,
       weight_kg = excluded.weight_kg,
       height_cm = excluded.height_cm,
       pregnant = excluded.pregnant,
       breastfeeding = excluded.breastfeeding,
       chronic_conditions = excluded.chronic_conditions,
       current_medications = excluded.current_medications,
       notes = excluded.notes,
       emergency_contact = excluded.emergency_contact,
       emergency_phone = excluded.emergency_phone,
       updated_at = datetime('now')`,
    [input.customer_id, input.date_of_birth || null, input.gender || null,
     input.blood_type || null, input.weight_kg || null, input.height_cm || null,
     input.pregnant || 0, input.breastfeeding || 0,
     input.chronic_conditions || null, input.current_medications || null,
     input.notes || null, input.emergency_contact || null, input.emergency_phone || null]
  );
}

export async function addAllergy(input: Omit<PatientAllergy, "id">): Promise<void> {
  await execute(
    `INSERT INTO patient_allergies (id, customer_id, allergen, severity, reaction, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [crypto.randomUUID(), input.customer_id, input.allergen, input.severity,
     input.reaction || null, input.notes || null]
  );
}

export async function removeAllergy(id: string): Promise<void> {
  await execute("DELETE FROM patient_allergies WHERE id = ?1", [id]);
}

/**
 * Retail module — brands, variants, price lists, shrinkage, laybys, special orders.
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import type { CartItem } from "@/services/sales";

// ─── Brands ────────────────────────────────────────────────────────────
export interface Brand {
  id: string;
  name: string;
  logo_path: string | null;
  country_of_origin: string | null;
  description: string | null;
  active: number;
  created_at: string;
}

export interface BrandWithStats extends Brand {
  product_count: number;
}

export async function listBrands(includeInactive = false): Promise<BrandWithStats[]> {
  return query<BrandWithStats>(
    `SELECT b.*, COUNT(p.id) AS product_count
     FROM brands b
     LEFT JOIN products p ON p.brand_id = b.id AND p.active = 1
     ${includeInactive ? "" : "WHERE b.active = 1"}
     GROUP BY b.id
     ORDER BY b.name`,
  );
}

export async function getBrand(id: string): Promise<Brand | null> {
  const rows = await query<Brand>(`SELECT * FROM brands WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function upsertBrand(input: Partial<Brand> & { name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE brands SET name = ?2, country_of_origin = ?3, description = ?4, logo_path = ?5, active = ?6 WHERE id = ?1`,
      [id, input.name, input.country_of_origin || null, input.description || null, input.logo_path || null, input.active ?? 1],
    );
  } else {
    await execute(
      `INSERT INTO brands (id, name, country_of_origin, description, logo_path, active)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [id, input.name, input.country_of_origin || null, input.description || null, input.logo_path || null, input.active ?? 1],
    );
  }
  return id;
}

export async function deactivateBrand(id: string): Promise<void> {
  await execute(`UPDATE brands SET active = 0 WHERE id = ?1`, [id]);
}

// ─── Product Variants ──────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  product_id: string;
  variant_sku: string;
  variant_name: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  shade: string | null;
  selling_price: number | null;
  buying_price: number | null;
  stock_qty: number;
  reorder_level: number;
  image_path: string | null;
  active: number;
  sort_order: number;
}

export async function listVariants(productId: string, includeInactive = false): Promise<ProductVariant[]> {
  const where = includeInactive ? "WHERE product_id = ?1" : "WHERE product_id = ?1 AND active = 1";
  return query<ProductVariant>(
    `SELECT * FROM product_variants ${where} ORDER BY sort_order, variant_name`,
    [productId],
  );
}

export async function upsertVariant(input: Partial<ProductVariant> & {
  product_id: string;
  variant_sku: string;
  variant_name: string;
}): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE product_variants SET
        variant_sku=?2, variant_name=?3, barcode=?4, color=?5, size=?6, shade=?7,
        selling_price=?8, buying_price=?9, reorder_level=?10, image_path=?11, active=?12, sort_order=?13
       WHERE id=?1`,
      [id, input.variant_sku, input.variant_name, input.barcode || null,
        input.color || null, input.size || null, input.shade || null,
        input.selling_price ?? null, input.buying_price ?? null,
        input.reorder_level || 0, input.image_path || null, input.active ?? 1, input.sort_order || 0],
    );
  } else {
    await execute(
      `INSERT INTO product_variants (id, product_id, variant_sku, variant_name, barcode, color, size, shade,
         selling_price, buying_price, stock_qty, reorder_level, image_path, active, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
      [id, input.product_id, input.variant_sku, input.variant_name, input.barcode || null,
        input.color || null, input.size || null, input.shade || null,
        input.selling_price ?? null, input.buying_price ?? null,
        input.stock_qty || 0, input.reorder_level || 0, input.image_path || null,
        input.active ?? 1, input.sort_order || 0],
    );
  }
  return id;
}

export async function deleteVariant(id: string): Promise<void> {
  // Soft-delete (RT-18): preserve layby/sale history that references this variant.
  await execute(`UPDATE product_variants SET active = 0 WHERE id = ?1`, [id]);
}

/**
 * Adjust a variant's stock by a delta (positive = receive, negative = issue)
 * and record a stock_movements row against the parent product so the change
 * is auditable. This is the receiving path variants previously lacked (RT-6):
 * upsertVariant's UPDATE never touched stock_qty, so variant stock could not
 * change after creation. Callers pass a signed delta.
 */
export async function adjustVariantStock(
  variantId: string,
  delta: number,
  reason: string,
  userId?: string,
): Promise<void> {
  if (!delta) return;
  const [v] = await query<{ product_id: string }>(
    `SELECT product_id FROM product_variants WHERE id = ?1`, [variantId],
  );
  if (!v) throw new Error("Variant not found");
  await execute(
    `UPDATE product_variants SET stock_qty = MAX(0, stock_qty + ?2) WHERE id = ?1`,
    [variantId, delta],
  );
  await execute(
    `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id, notes, user_id)
     VALUES (?1, ?2, ?3, ?4, 'variant_adjust', ?5, ?6, ?7)`,
    [crypto.randomUUID(), v.product_id, delta > 0 ? "adjustment" : "damage", delta, variantId, reason, userId ?? null],
  );
}

// ─── Price Lists ───────────────────────────────────────────────────────
export interface PriceList {
  id: string;
  name: string;
  description: string | null;
  is_default: number;
  starts_at: string | null;
  ends_at: string | null;
  active: number;
  created_at: string;
}

export interface PriceListItem {
  id: string;
  price_list_id: string;
  product_id: string | null;
  variant_id: string | null;
  price: number;
  min_quantity: number;
  product_name?: string;
  variant_name?: string;
}

/** @deprecated (RT-22) Reads the orphan retail_price_lists registry. Use the
 *  price_lists + product_prices system via resolvePrice / listPricingLists. Kept
 *  for back-compat until the tables are dropped. */
export async function listPriceLists(includeInactive = false): Promise<PriceList[]> {
  const where = includeInactive ? "" : "WHERE active = 1";
  return query<PriceList>(
    `SELECT * FROM retail_price_lists ${where} ORDER BY is_default DESC, name`,
  );
}

export async function getPriceList(id: string): Promise<{ list: PriceList; items: PriceListItem[] } | null> {
  const [list] = await query<PriceList>(`SELECT * FROM retail_price_lists WHERE id = ?1`, [id]);
  if (!list) return null;
  const items = await query<PriceListItem>(
    `SELECT pli.*, p.name AS product_name, v.variant_name
     FROM retail_price_list_items pli
     LEFT JOIN products p ON p.id = pli.product_id
     LEFT JOIN product_variants v ON v.id = pli.variant_id
     WHERE pli.price_list_id = ?1
     ORDER BY p.name, pli.min_quantity`,
    [id],
  );
  return { list, items };
}

export async function upsertPriceList(input: Partial<PriceList> & { name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE retail_price_lists SET name=?2, description=?3, starts_at=?4, ends_at=?5, active=?6 WHERE id=?1`,
      [id, input.name, input.description || null, input.starts_at || null, input.ends_at || null, input.active ?? 1],
    );
  } else {
    await execute(
      `INSERT INTO retail_price_lists (id, name, description, starts_at, ends_at, active)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [id, input.name, input.description || null, input.starts_at || null, input.ends_at || null, input.active ?? 1],
    );
  }
  return id;
}

export async function setPriceListItem(input: {
  price_list_id: string;
  product_id?: string;
  variant_id?: string;
  price: number;
  min_quantity?: number;
}): Promise<void> {
  await execute(
    `INSERT OR REPLACE INTO retail_price_list_items (id, price_list_id, product_id, variant_id, price, min_quantity)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [crypto.randomUUID(), input.price_list_id,
      input.product_id || null, input.variant_id || null,
      input.price, input.min_quantity || 1],
  );
}

export async function removePriceListItem(id: string): Promise<void> {
  await execute(`DELETE FROM retail_price_list_items WHERE id = ?1`, [id]);
}

/**
 * Per-product tier prices across all price lists.
 * One row per (price_list, product) — variant-level prices excluded
 * since the inline editor in product-panel works at product level.
 */
export async function listPricesForProduct(productId: string): Promise<Array<{
  id: string;
  price_list_id: string;
  price_list_name: string;
  is_default: number;
  price: number;
}>> {
  return query(
    `SELECT pli.id, pli.price_list_id, pl.name AS price_list_name, pl.is_default, pli.price
     FROM retail_price_list_items pli
     JOIN retail_price_lists pl ON pl.id = pli.price_list_id
     WHERE pli.product_id = ?1 AND pli.variant_id IS NULL AND (pli.min_quantity IS NULL OR pli.min_quantity <= 1)
     ORDER BY pl.is_default DESC, pl.name`,
    [productId],
  );
}

/** Delete a tier price row by price_list + product (variant-level NULL). */
export async function removeProductPriceTier(priceListId: string, productId: string): Promise<void> {
  await execute(
    `DELETE FROM retail_price_list_items WHERE price_list_id = ?1 AND product_id = ?2 AND variant_id IS NULL`,
    [priceListId, productId],
  );
}

/**
 * Resolve the best price for a customer + product using their assigned price
 * list. Reads from `product_prices` (the store POS uses), keyed by the
 * customer's `pricing_list_id`, falling back to the `default` list.
 *
 * Convergence note (v0.48): the orphan `retail_price_lists` /
 * `retail_price_list_items` system was deprecated. Quantity-break pricing is
 * now modelled as separate price lists rather than min_quantity rows; the
 * `quantity` argument is retained for API compatibility + future tiering.
 */
export async function resolvePrice(input: {
  product_id: string;
  variant_id?: string;
  quantity: number;
  customer_id?: string;
}): Promise<{ price: number; tier: string } | null> {
  // Which price list applies to this customer?
  let priceListId = "default";
  if (input.customer_id) {
    const [c] = await query<{ pricing_list_id: string | null }>(
      `SELECT pricing_list_id FROM customers WHERE id = ?1`, [input.customer_id],
    );
    if (c?.pricing_list_id) priceListId = c.pricing_list_id;
  }

  // Variant-specific price wins when present.
  if (input.variant_id) {
    const [v] = await query<{ selling_price: number | null }>(
      `SELECT selling_price FROM product_variants WHERE id = ?1`, [input.variant_id],
    );
    if (v?.selling_price != null) {
      const [pl] = await query<{ name: string }>(`SELECT name FROM price_lists WHERE id = ?1`, [priceListId]);
      return { price: v.selling_price, tier: pl?.name || "Retail" };
    }
  }

  // Price on the customer's list, else the default list.
  const rows = await query<{ selling_price: number; price_list_id: string }>(
    `SELECT selling_price, price_list_id FROM product_prices
      WHERE product_id = ?1 AND price_list_id IN (?2, 'default')
      ORDER BY (price_list_id = ?2) DESC LIMIT 1`,
    [input.product_id, priceListId],
  );
  if (rows[0]) {
    const [pl] = await query<{ name: string }>(`SELECT name FROM price_lists WHERE id = ?1`, [rows[0].price_list_id]);
    return { price: rows[0].selling_price, tier: pl?.name || "Retail" };
  }
  return null;
}

// ─── Pricing lists (converged: price_lists + product_prices) ───────────
export interface PricingList {
  id: string;
  name: string;
  is_default: number;
  active: number;
}

export interface ProductPriceRow {
  product_id: string;
  product_name: string;
  selling_price: number;
  buying_price: number;
}

/** List the REAL price lists (price_lists, migration 002) — the registry
 *  product_prices + POS actually use (RT-4/RT-22). */
export async function listPricingLists(): Promise<PricingList[]> {
  return query<PricingList>(
    `SELECT id, name, is_default, active FROM price_lists WHERE active = 1 ORDER BY is_default DESC, name`,
  );
}

export async function createPricingList(name: string): Promise<string> {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID();
  await execute(
    `INSERT OR IGNORE INTO price_lists (id, name, is_default, active) VALUES (?1, ?2, 0, 1)`,
    [id, name],
  );
  return id;
}

export async function setPricingListActive(id: string, active: boolean): Promise<void> {
  await execute(`UPDATE price_lists SET active = ?2 WHERE id = ?1`, [id, active ? 1 : 0]);
}

/** Product prices configured on a given list. */
export async function listProductPrices(priceListId: string, search?: string): Promise<ProductPriceRow[]> {
  const like = search?.trim() ? `%${search.trim()}%` : null;
  return query<ProductPriceRow>(
    `SELECT pp.product_id, p.name AS product_name, pp.selling_price, pp.buying_price
       FROM product_prices pp
       JOIN products p ON p.id = pp.product_id
      WHERE pp.price_list_id = ?1 ${like ? "AND p.name LIKE ?2" : ""}
      ORDER BY p.name
      LIMIT 300`,
    like ? [priceListId, like] : [priceListId],
  );
}

/** Set (upsert) a product's price on a list. */
export async function setProductPrice(input: {
  product_id: string;
  price_list_id: string;
  selling_price: number;
  buying_price?: number;
}): Promise<void> {
  await execute(
    `INSERT INTO product_prices (product_id, price_list_id, buying_price, selling_price)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(product_id, price_list_id) DO UPDATE SET
       selling_price = excluded.selling_price,
       buying_price = CASE WHEN excluded.buying_price > 0 THEN excluded.buying_price ELSE product_prices.buying_price END`,
    [input.product_id, input.price_list_id, input.buying_price ?? 0, input.selling_price],
  );
}

export async function removeProductPrice(productId: string, priceListId: string): Promise<void> {
  // Never strip the default-list price — that's the base sell price.
  if (priceListId === "default") throw new Error("Cannot remove the default price");
  await execute(
    `DELETE FROM product_prices WHERE product_id = ?1 AND price_list_id = ?2`,
    [productId, priceListId],
  );
}

// ─── Shrinkage ─────────────────────────────────────────────────────────
export type ShrinkageReason = "damaged" | "expired" | "theft" | "spillage" | "count_correction" | "sample" | "other";

export interface ShrinkageRecord {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reason: ShrinkageReason;
  cost_value: number;
  notes: string | null;
  user_id: string;
  branch_id: string | null;
  incident_date: string;
  created_at: string;
}

export interface ShrinkageWithDetails extends ShrinkageRecord {
  product_name: string;
  variant_name: string | null;
  user_name: string;
}

export async function listShrinkage(opts?: {
  startDate?: string;
  endDate?: string;
  reason?: ShrinkageReason;
  branchId?: string;
}): Promise<ShrinkageWithDetails[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`s.incident_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.incident_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.reason) { conditions.push(`s.reason = ?${params.length + 1}`); params.push(opts.reason); }
  if (opts?.branchId) { conditions.push(`s.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<ShrinkageWithDetails>(
    `SELECT s.*, p.name AS product_name, v.variant_name, u.full_name AS user_name
     FROM shrinkage s
     JOIN products p ON p.id = s.product_id
     LEFT JOIN product_variants v ON v.id = s.variant_id
     JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY s.incident_date DESC, s.created_at DESC
     LIMIT 500`,
    params,
  );
}

export async function recordShrinkage(input: {
  product_id: string;
  variant_id?: string;
  quantity: number;
  reason: ShrinkageReason;
  cost_value?: number;
  notes?: string;
  user_id: string;
  incident_date?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO shrinkage (id, product_id, variant_id, quantity, reason, cost_value, notes, user_id, branch_id, incident_date)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    [id, input.product_id, input.variant_id || null, input.quantity, input.reason,
      input.cost_value || 0, input.notes || null, input.user_id, getActiveBranchId(),
      input.incident_date || new Date().toISOString().slice(0, 10)],
  );

  // Decrement stock from latest batch
  if (input.variant_id) {
    await execute(
      `UPDATE product_variants SET stock_qty = MAX(0, stock_qty - ?2) WHERE id = ?1`,
      [input.variant_id, input.quantity],
    );
  } else {
    // FEFO multi-batch deduction (RT-9): consume across batches by expiry
    // (soonest first, then received order) until the quantity is satisfied,
    // instead of clipping a single LIFO batch.
    let remaining = input.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches
        WHERE product_id = ?1 AND quantity > 0
        ORDER BY expiry_date ASC NULLS LAST, received_at ASC, created_at ASC`,
      [input.product_id],
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const decBy = Math.min(b.quantity, remaining);
      await execute(`UPDATE batches SET quantity = quantity - ?2 WHERE id = ?1`, [b.id, decBy]);
      remaining -= decBy;
    }
  }

  // Stock movement
  await execute(
    `INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id, notes, user_id)
     VALUES (?1, ?2, 'damage', ?3, 'shrinkage', ?4, ?5, ?6)`,
    [crypto.randomUUID(), input.product_id, -input.quantity, id, `${input.reason}: ${input.notes || ""}`, input.user_id],
  );

  return id;
}

export async function getShrinkageSummary(opts?: {
  startDate?: string;
  endDate?: string;
}): Promise<Array<{ reason: ShrinkageReason; total_qty: number; total_cost: number; incident_count: number }>> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`incident_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`incident_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query(
    `SELECT reason,
       COALESCE(SUM(quantity), 0) AS total_qty,
       COALESCE(SUM(cost_value), 0) AS total_cost,
       COUNT(*) AS incident_count
     FROM shrinkage ${where}
     GROUP BY reason
     ORDER BY total_cost DESC`,
    params,
  );
}

// ─── Laybys ────────────────────────────────────────────────────────────
export interface Layby {
  id: string;
  layby_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_amount: number;
  deposit_amount: number;
  paid_amount: number;
  balance_due: number;
  expires_at: string;
  status: "active" | "completed" | "cancelled" | "expired";
  notes: string | null;
  user_id: string;
  branch_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface LaybyItem {
  id: string;
  layby_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface LaybyPayment {
  id: string;
  layby_id: string;
  amount: number;
  method: string;
  reference: string | null;
  user_id: string;
  paid_at: string;
}

async function getNextLaybyNumber(): Promise<string> {
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const [r] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM laybys WHERE layby_number LIKE ?1`,
    [`LB-${yyyymm}-%`],
  );
  return `LB-${yyyymm}-${String((r?.count || 0) + 1).padStart(4, "0")}`;
}

/** Background job (RT-16): flag active laybys past their expiry date.
 *  Moved out of listLaybys so reads have no side effects. */
export async function expireOverdueLaybys(): Promise<number> {
  const before = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM laybys WHERE status = 'active' AND date('now') > expires_at`,
  );
  await execute(
    `UPDATE layby_items SET reserved_qty = 0
      WHERE layby_id IN (SELECT id FROM laybys WHERE status = 'active' AND date('now') > expires_at)`,
  );
  await execute(
    `UPDATE laybys SET status = 'expired' WHERE status = 'active' AND date('now') > expires_at`,
  );
  return before[0]?.n ?? 0;
}

export async function listLaybys(opts?: { status?: Layby["status"] }): Promise<Layby[]> {
  const where = opts?.status ? `WHERE status = ?1` : "";
  return query<Layby>(
    `SELECT * FROM laybys ${where} ORDER BY created_at DESC LIMIT 500`,
    opts?.status ? [opts.status] : [],
  );
}

export async function getLayby(id: string): Promise<{ layby: Layby; items: LaybyItem[]; payments: LaybyPayment[] } | null> {
  const [layby] = await query<Layby>(`SELECT * FROM laybys WHERE id = ?1`, [id]);
  if (!layby) return null;
  const items = await query<LaybyItem>(`SELECT * FROM layby_items WHERE layby_id = ?1`, [id]);
  const payments = await query<LaybyPayment>(`SELECT * FROM layby_payments WHERE layby_id = ?1 ORDER BY paid_at DESC`, [id]);
  return { layby, items, payments };
}

/** Physical sellable stock for a product (sum of batch quantities). */
export async function getPhysicalStock(productId: string): Promise<number> {
  const [r] = await query<{ qty: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS qty FROM batches WHERE product_id = ?1`,
    [productId],
  );
  return r?.qty ?? 0;
}

/** Quantity soft-reserved by ACTIVE laybys for a product (RT-10). */
export async function getReservedStock(productId: string): Promise<number> {
  const [r] = await query<{ qty: number }>(
    `SELECT COALESCE(SUM(li.reserved_qty), 0) AS qty
       FROM layby_items li JOIN laybys l ON l.id = li.layby_id
      WHERE li.product_id = ?1 AND l.status = 'active'`,
    [productId],
  );
  return r?.qty ?? 0;
}

/** Available-to-promise = physical - active reservations. */
export async function getAvailableStock(productId: string): Promise<number> {
  const [phys, reserved] = await Promise.all([getPhysicalStock(productId), getReservedStock(productId)]);
  return phys - reserved;
}

export async function createLayby(input: {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  expires_at: string;
  deposit_amount: number;
  deposit_method: string;
  deposit_reference?: string;
  notes?: string;
  user_id: string;
  items: Array<{ product_id: string; variant_id?: string; product_name: string; quantity: number; unit_price: number }>;
}): Promise<string> {
  if (input.items.length === 0) throw new Error("Add at least one item");

  const id = crypto.randomUUID();
  const number = await getNextLaybyNumber();
  const total = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  if (input.deposit_amount > total) throw new Error("Deposit cannot exceed total");
  if (input.deposit_amount < 0) throw new Error("Deposit cannot be negative");

  await execute(
    `INSERT INTO laybys (id, layby_number, customer_id, customer_name, customer_phone,
       total_amount, deposit_amount, paid_amount, balance_due, expires_at, notes, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    [id, number, input.customer_id, input.customer_name, input.customer_phone || null,
      total, input.deposit_amount, input.deposit_amount, total - input.deposit_amount,
      input.expires_at, input.notes || null, input.user_id, getActiveBranchId()],
  );

  // Availability guard (RU3) + soft reservation (RT-10): each line must have
  // enough available-to-promise stock (physical minus existing active-layby
  // reservations). We record reserved_qty but DON'T deduct batches — physical
  // deduction happens at completion via the POS sale, so reserving here would
  // otherwise double-count.
  for (const it of input.items) {
    if (!it.variant_id) {
      const avail = await getAvailableStock(it.product_id);
      if (it.quantity > avail) {
        throw new Error(`Insufficient stock for ${it.product_name}: need ${it.quantity}, ${avail} available (after existing laybys)`);
      }
    }
  }

  for (const it of input.items) {
    await execute(
      `INSERT INTO layby_items (id, layby_id, product_id, variant_id, product_name, quantity, unit_price, line_total, reserved_qty)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?6)`,
      [crypto.randomUUID(), id, it.product_id, it.variant_id || null, it.product_name,
        it.quantity, it.unit_price, it.quantity * it.unit_price],
    );
  }

  // Record initial deposit
  if (input.deposit_amount > 0) {
    await execute(
      `INSERT INTO layby_payments (id, layby_id, amount, method, reference, user_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [crypto.randomUUID(), id, input.deposit_amount, input.deposit_method, input.deposit_reference || null, input.user_id],
    );
    // RT-23: a layby deposit is a CUSTOMER DEPOSIT (liability), not yet a
    // taxable supply — the eTIMS tax invoice is correctly deferred to
    // completion (goods handover), which completeSale signs. Here we post the
    // deposit to the GL: debit cash, credit customer-deposit liability.
    try {
      const { postJournal } = await import("@/services/gl");
      await postJournal({
        entry_date: new Date().toISOString().slice(0, 10),
        description: `Layby deposit ${number}`,
        source_kind: "layby_deposit",
        source_id: id,
        lines: [
          { account_code: "1000", debit: input.deposit_amount, credit: 0 },
          { account_code: "2300", debit: 0, credit: input.deposit_amount },
        ],
      });
    } catch (e) {
      console.warn("Layby deposit GL post skipped:", e);
    }
  }

  return id;
}

export async function recordLaybyPayment(input: {
  layby_id: string;
  amount: number;
  method: string;
  reference?: string;
  user_id: string;
}): Promise<string> {
  const [layby] = await query<Layby>(`SELECT * FROM laybys WHERE id = ?1`, [input.layby_id]);
  if (!layby) throw new Error("Layby not found");
  if (layby.status !== "active") throw new Error(`Layby is ${layby.status}`);
  if (input.amount <= 0) throw new Error("Amount must be > 0");
  if (input.amount > layby.balance_due) throw new Error("Amount exceeds balance due");

  const paymentId = crypto.randomUUID();
  await execute(
    `INSERT INTO layby_payments (id, layby_id, amount, method, reference, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [paymentId, input.layby_id, input.amount, input.method, input.reference || null, input.user_id],
  );

  const newPaid = layby.paid_amount + input.amount;
  const newBalance = layby.total_amount - newPaid;
  const isComplete = newBalance < 0.01;

  await execute(
    `UPDATE laybys SET paid_amount = ?2, balance_due = ?3, status = ?4, completed_at = ?5 WHERE id = ?1`,
    [input.layby_id, newPaid, Math.max(0, newBalance),
      isComplete ? "completed" : "active",
      isComplete ? new Date().toISOString() : null],
  );

  return paymentId;
}

export async function cancelLayby(id: string, refundAmount?: number, userId?: string): Promise<void> {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const stmts: import("@/lib/db").TxStatement[] = [
    { sql: `UPDATE laybys SET status = 'cancelled' WHERE id = ?1`, params: [id] },
    { sql: `UPDATE layby_items SET reserved_qty = 0 WHERE layby_id = ?1`, params: [id] },
  ];

  if (refundAmount && refundAmount > 0 && userId) {
    stmts.push({
      sql: `INSERT INTO layby_payments (id, layby_id, amount, method, reference, user_id)
       VALUES (?1, ?2, ?3, 'refund', 'cancellation refund', ?4)`,
      params: [crypto.randomUUID(), id, -round2(refundAmount), userId],
    });
    // Mirror the refund as money leaving the till so the bank reconciles.
    try {
      const { pickBankAccountForMethod } = await import("@/services/sales");
      const accountId = await pickBankAccountForMethod("cash");
      if (accountId) {
        stmts.push({
          sql: `INSERT INTO bank_transactions (id, account_id, transaction_date, transaction_type, amount, description, payment_method, user_id)
           VALUES (?1, ?2, datetime('now'), 'withdrawal', ?3, ?4, 'cash', ?5)`,
          params: [crypto.randomUUID(), accountId, round2(refundAmount), `Layby refund`, userId],
        });
        stmts.push({
          sql: `UPDATE bank_accounts SET current_balance = ROUND(COALESCE(current_balance,0) - ?2, 2) WHERE id = ?1`,
          params: [accountId, round2(refundAmount)],
        });
      }
    } catch (e) {
      console.error("Layby refund bank mirror failed:", e);
    }
  }

  const { transaction } = await import("@/lib/db");
  await transaction(stmts);
}

export async function prepareLaybyForPosCheckout(laybyId: string): Promise<{
  items: CartItem[]; laybyNumber: string; customerName: string; customerId: string | null
} | null> {
  const result = await getLayby(laybyId);
  if (!result) return null;
  const { layby, items } = result;
  if (layby.status === "cancelled" || layby.status === "expired") return null;

  const productIds = [...new Set(items.map((it) => it.product_id))];
  const placeholders = productIds.map(() => "?").join(",");
  const prices = await query<{ id: string; tax_rate: number }>(
    `SELECT id, COALESCE(tax_rate, 0) AS tax_rate FROM products WHERE id IN (${placeholders})`,
    productIds,
  );
  const taxMap = new Map(prices.map((p) => [p.id, p.tax_rate]));

  const cartItems: CartItem[] = items.map((it) => {
    const tax = taxMap.get(it.product_id) || 0;
    return {
      id: crypto.randomUUID(),
      product_id: it.product_id,
      name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount: 0,
      tax_rate: tax,
      total: it.unit_price * it.quantity,
    };
  });

  return { items: cartItems, laybyNumber: layby.layby_number, customerName: layby.customer_name, customerId: layby.customer_id };
}

export async function completeLaybyFromPos(laybyId: string, saleId: string): Promise<void> {
  await execute(
    `UPDATE laybys SET status = 'completed', completed_at = datetime('now'), sale_id = ?2 WHERE id = ?1`,
    [laybyId, saleId],
  );
  // Release the soft reservation — physical stock was deducted by the POS sale.
  await execute(`UPDATE layby_items SET reserved_qty = 0 WHERE layby_id = ?1`, [laybyId]);
}

export async function prepareSpecialOrderForPosCheckout(orderId: string): Promise<{
  items: CartItem[]; customerName: string; customerId: string | null
} | null> {
  const rows = await query<{ id: string; customer_id: string | null; customer_name: string | null; items_json: string; status: string }>(
    `SELECT id, customer_id, customer_name, items_json, status FROM special_orders WHERE id = ?1`,
    [orderId],
  );
  if (!rows[0]) return null;
  const so = rows[0];
  if (so.status === "cancelled" || so.status === "fulfilled") return null;

  const raw = parseSpecialOrderItems(so.items_json);
  if (!raw.length) return null;

  const productIds = [...new Set(raw.map((it) => it.product_id).filter(Boolean))];
  const taxMap = new Map<string, number>();
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(",");
    const prices = await query<{ id: string; tax_rate: number }>(
      `SELECT id, COALESCE(tax_rate, 0) AS tax_rate FROM products WHERE id IN (${placeholders})`,
      productIds,
    );
    prices.forEach((p) => taxMap.set(p.id, p.tax_rate));
  }

  const cartItems: CartItem[] = raw.map((it) => {
    const unit = it.unit_price ?? 0;
    return {
      id: crypto.randomUUID(),
      product_id: it.product_id || "",
      name: it.product_name,
      quantity: it.quantity,
      unit_price: unit,                        // RT-15: remembered estimate
      discount: 0,
      tax_rate: it.product_id ? (taxMap.get(it.product_id) || 0) : 0,
      total: unit * it.quantity,
    };
  });

  return { items: cartItems, customerName: so.customer_name || "", customerId: so.customer_id };
}

export async function completeSpecialOrderFromPos(orderId: string, saleId: string): Promise<void> {
  await execute(
    `UPDATE special_orders SET status = 'fulfilled', fulfilled_at = datetime('now'), sale_id = ?2 WHERE id = ?1`,
    [orderId, saleId],
  );
}

// ─── Special Orders ────────────────────────────────────────────────────
export interface SpecialOrder {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items_json: string;
  estimated_value: number | null;
  needed_by: string | null;
  status: "pending" | "ordered" | "received" | "fulfilled" | "cancelled";
  notes: string | null;
  user_id: string;
  branch_id: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export interface SpecialOrderItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  /** Estimated/agreed unit price captured at order time; carried to POS (RT-15). */
  unit_price?: number;
  notes?: string;
}

export async function listSpecialOrders(opts?: { status?: SpecialOrder["status"] }): Promise<SpecialOrder[]> {
  const where = opts?.status ? `WHERE status = ?1` : "";
  return query<SpecialOrder>(
    `SELECT * FROM special_orders ${where} ORDER BY needed_by ASC, created_at DESC`,
    opts?.status ? [opts.status] : [],
  );
}

export async function createSpecialOrder(input: {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  items: SpecialOrderItem[];
  estimated_value?: number;
  needed_by?: string;
  notes?: string;
  user_id: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO special_orders (id, customer_id, customer_name, customer_phone, items_json, estimated_value, needed_by, notes, user_id, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    [id, input.customer_id || null, input.customer_name || null, input.customer_phone || null,
      JSON.stringify(input.items), input.estimated_value || null,
      input.needed_by || null, input.notes || null, input.user_id, getActiveBranchId()],
  );
  return id;
}

export async function updateSpecialOrderStatus(id: string, status: SpecialOrder["status"]): Promise<void> {
  await execute(
    `UPDATE special_orders SET status = ?2, fulfilled_at = ?3 WHERE id = ?1`,
    [id, status, status === "fulfilled" ? new Date().toISOString() : null],
  );
}

export function parseSpecialOrderItems(json: string): SpecialOrderItem[] {
  try { return JSON.parse(json); } catch { return []; }
}


// ─── Product UOMs (Carton/Pack) ────────────────────────────────────────
export interface ProductUom {
  id: string;
  product_id: string;
  name: string;
  quantity_per: number;
  barcode: string | null;
  selling_price: number | null;
  buying_price: number | null;
  is_default_purchase: number;
  is_default_sale: number;
  sort_order: number;
  created_at: string;
}

export async function listProductUoms(productId: string): Promise<ProductUom[]> {
  return query<ProductUom>(
    `SELECT * FROM product_uoms WHERE product_id = ?1 ORDER BY sort_order, name`,
    [productId],
  );
}

export async function upsertProductUom(input: Partial<ProductUom> & {
  product_id: string;
  name: string;
  quantity_per: number;
}): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE product_uoms SET name = ?2, quantity_per = ?3, barcode = ?4,
        selling_price = ?5, buying_price = ?6,
        is_default_purchase = ?7, is_default_sale = ?8, sort_order = ?9
       WHERE id = ?1`,
      [id, input.name, input.quantity_per, input.barcode || null,
        input.selling_price ?? null, input.buying_price ?? null,
        input.is_default_purchase ?? 0, input.is_default_sale ?? 0, input.sort_order || 0],
    );
  } else {
    await execute(
      `INSERT INTO product_uoms (id, product_id, name, quantity_per, barcode,
         selling_price, buying_price, is_default_purchase, is_default_sale, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      [id, input.product_id, input.name, input.quantity_per, input.barcode || null,
        input.selling_price ?? null, input.buying_price ?? null,
        input.is_default_purchase ?? 0, input.is_default_sale ?? 0, input.sort_order || 0],
    );
  }
  return id;
}

export async function deleteProductUom(id: string): Promise<void> {
  await execute(`DELETE FROM product_uoms WHERE id = ?1`, [id]);
}

/** Look up UOM by barcode — useful at POS for cartons that have own barcode. */
export async function getUomByBarcode(barcode: string): Promise<{
  uom: ProductUom;
  product_id: string;
  product_name: string;
  base_selling_price: number;
  product_stock_qty: number;
} | null> {
  const rows = await query<ProductUom & { product_name: string; base_selling_price: number; product_stock_qty: number }>(
    `SELECT u.*, p.name AS product_name,
       COALESCE(pp.selling_price, 0) AS base_selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS product_stock_qty
     FROM product_uoms u
     JOIN products p ON p.id = u.product_id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE u.barcode = ?1
     LIMIT 1`,
    [barcode],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    uom: r,
    product_id: r.product_id,
    product_name: r.product_name,
    base_selling_price: r.base_selling_price,
    product_stock_qty: r.product_stock_qty,
  };
}

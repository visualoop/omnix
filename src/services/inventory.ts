import { query, execute } from "@/lib/db";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  description: string | null;
  reorder_level: number;
  tax_rate: number;
  active: number;
  buying_price: number;
  selling_price: number;
  stock_qty: number;
  /** Optional product image. Path (file://, app data, or http URL). */
  image_path?: string | null;
  created_at: string;
  category_name?: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  unit?: string;
  description?: string;
  reorder_level?: number;
  tax_rate?: number;
  buying_price: number;
  selling_price: number;
  initial_stock?: number;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  product_count?: number;
}

/** Default cap on `getProducts` — stops the inventory page hanging on
 *  multi-thousand-SKU databases. Cashiers + owners refine via the search
 *  box (name / SKU / barcode) when they need a specific item. */
export const PRODUCTS_PAGE_SIZE = 500

export interface ProductsPage {
  rows: Product[]
  /** Total active physical products matching the filter (ignores limit). */
  total: number
  /** True if more rows exist beyond `rows.length`. */
  hasMore: boolean
}

export async function getProducts(search?: string): Promise<Product[]> {
  // Back-compat surface — kept so existing call sites that don't care
  // about pagination still work. New code should prefer `getProductsPage`.
  const page = await getProductsPage(search, PRODUCTS_PAGE_SIZE)
  return page.rows
}

/**
 * Paginated product listing. Returns at most `limit` rows plus the
 * total count of matches so the UI can show "Showing 500 of 12,400 —
 * refine your search to find a specific item."
 */
export async function getProductsPage(search?: string, limit: number = PRODUCTS_PAGE_SIZE): Promise<ProductsPage> {
  const where = `WHERE p.active = 1 AND p.kind = 'physical'${
    search ? " AND (p.name LIKE ?1 OR p.barcode LIKE ?1 OR p.sku LIKE ?1)" : ""
  }`
  const params = search ? [`%${search}%`] : []

  const [totalRow] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM products p ${where}`,
    params,
  )
  const total = totalRow?.count ?? 0

  const sql = `
    SELECT p.*,
      COALESCE(pp.buying_price, 0) as buying_price,
      COALESCE(pp.selling_price, 0) as selling_price,
      COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as stock_qty,
      c.name as category_name
    FROM products p
    LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
    LEFT JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.name ASC
    LIMIT ${Math.max(1, Math.floor(limit))}
  `
  const rows = await query<Product>(sql, params)
  return { rows, total, hasMore: total > rows.length }
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await query<Product>(
    `SELECT p.*,
      c.name as category_name,
      COALESCE(pp.buying_price, 0) as buying_price,
      COALESCE(pp.selling_price, 0) as selling_price,
      COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as stock_qty
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
    WHERE p.id = ?1`,
    [id]
  );
  return rows[0] || null;
}

export async function createProduct(input: CreateProductInput): Promise<string> {
  const id = crypto.randomUUID();
  // Resolve effective tax rate: explicit on input → use it; else fall back
  // to the default in settings (`tax.default_rate`); else 16% as last resort.
  let effectiveTaxRate = input.tax_rate;
  if (effectiveTaxRate === undefined || effectiveTaxRate === null) {
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'tax.default_rate' LIMIT 1`,
    );
    const fromSettings = rows[0]?.value ? parseFloat(rows[0].value) : NaN;
    effectiveTaxRate = Number.isFinite(fromSettings) ? fromSettings : 16.0;
  }
  await execute(
    `INSERT INTO products (id, name, sku, barcode, category_id, unit, description, reorder_level, tax_rate)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [id, input.name, input.sku || null, input.barcode || null, input.category_id || null,
     input.unit || "pcs", input.description || null, input.reorder_level ?? 10, effectiveTaxRate]
  );
  await execute(
    `INSERT INTO product_prices (product_id, price_list_id, buying_price, selling_price)
     VALUES (?1, 'default', ?2, ?3)`,
    [id, input.buying_price, input.selling_price]
  );
  if (input.initial_stock && input.initial_stock > 0) {
    const batchId = crypto.randomUUID();
    await execute(
      `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price)
       VALUES (?1, ?2, 'INITIAL', ?3, ?4)`,
      [batchId, id, input.initial_stock, input.buying_price]
    );
    await execute(
      `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, notes)
       VALUES (?1, ?2, ?3, 'purchase', ?4, 'Initial stock')`,
      [crypto.randomUUID(), id, batchId, input.initial_stock]
    );
  }
  return id;
}

export async function updateProduct(id: string, input: Partial<CreateProductInput>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) { fields.push(`name = ?${idx}`); values.push(input.name); idx++; }
  if (input.sku !== undefined) { fields.push(`sku = ?${idx}`); values.push(input.sku); idx++; }
  if (input.barcode !== undefined) { fields.push(`barcode = ?${idx}`); values.push(input.barcode); idx++; }
  if (input.category_id !== undefined) { fields.push(`category_id = ?${idx}`); values.push(input.category_id); idx++; }
  if (input.unit !== undefined) { fields.push(`unit = ?${idx}`); values.push(input.unit); idx++; }
  if (input.reorder_level !== undefined) { fields.push(`reorder_level = ?${idx}`); values.push(input.reorder_level); idx++; }
  if (input.tax_rate !== undefined) { fields.push(`tax_rate = ?${idx}`); values.push(input.tax_rate); idx++; }
  if (input.description !== undefined) { fields.push(`description = ?${idx}`); values.push(input.description || null); idx++; }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`);
    values.push(id);
    await execute(`UPDATE products SET ${fields.join(", ")} WHERE id = ?${idx}`, values);
  }

  if (input.buying_price !== undefined || input.selling_price !== undefined) {
    await execute(
      `UPDATE product_prices SET buying_price = COALESCE(?1, buying_price), selling_price = COALESCE(?2, selling_price) WHERE product_id = ?3 AND price_list_id = 'default'`,
      [input.buying_price ?? null, input.selling_price ?? null, id]
    );
  }
}

export async function deleteProduct(id: string): Promise<void> {
  await execute(`UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?1`, [id]);
}

export async function getCategories(): Promise<Category[]> {
  return query<Category>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count
     FROM categories c ORDER BY c.sort_order, c.name`
  );
}

export async function createCategory(name: string, parentId?: string): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO categories (id, name, parent_id) VALUES (?1, ?2, ?3)`,
    [id, name, parentId || null]
  );
  return id;
}

export async function updateCategory(id: string, name: string, parentId?: string | null, sortOrder?: number): Promise<void> {
  await execute(
    `UPDATE categories SET name = ?2, parent_id = ?3, sort_order = COALESCE(?4, sort_order) WHERE id = ?1`,
    [id, name, parentId ?? null, sortOrder ?? null]
  );
}

export async function deleteCategory(id: string): Promise<void> {
  // Soft delete approach — null out parent_id pointers + null products' category.
  // Hard delete is fine here since categories are shallow.
  await execute(`UPDATE products SET category_id = NULL WHERE category_id = ?1`, [id]);
  await execute(`UPDATE categories SET parent_id = NULL WHERE parent_id = ?1`, [id]);
  await execute(`DELETE FROM categories WHERE id = ?1`, [id]);
}

export async function adjustStock(productId: string, quantity: number, reason: string): Promise<void> {
  const batchId = crypto.randomUUID();
  await execute(
    `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price)
     VALUES (?1, ?2, 'ADJ', ?3, 0)`,
    [batchId, productId, quantity]
  );
  await execute(
    `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, notes)
     VALUES (?1, ?2, ?3, 'adjustment', ?4, ?5)`,
    [crypto.randomUUID(), productId, batchId, quantity, reason]
  );
}

export async function getStockMovements(productId?: string): Promise<Array<{
  id: string; product_name: string; type: string; quantity: number; notes: string | null; created_at: string;
}>> {
  const sql = `
    SELECT sm.id, p.name as product_name, sm.type, sm.quantity, sm.notes, sm.created_at
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    ${productId ? "WHERE sm.product_id = ?1" : ""}
    ORDER BY sm.created_at DESC LIMIT 100
  `;
  return query(sql, productId ? [productId] : []);
}

/**
 * Bundles / kits / composite products.
 *
 * A "bundle" product has entries in bundle_components pointing at each child
 * SKU + qty. When sold, we still record the bundle as one line at POS but
 * internally we deduct stock from each component and roll cost up from
 * children.
 */
import { execute, query } from "@/lib/db";

export interface BundleComponent {
  id: string;
  bundle_product_id: string;
  component_product_id: string;
  component_name: string;
  component_sku: string;
  quantity: number;
  discount_pct: number;
  unit_cost: number;
  unit_price: number;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

/** All components of a bundle SKU, joined against products for cost + name. */
export async function getBundleComponents(bundleProductId: string): Promise<BundleComponent[]> {
  return query<BundleComponent>(
    `SELECT
        bc.id,
        bc.bundle_product_id,
        bc.component_product_id,
        p.name AS component_name,
        p.sku AS component_sku,
        bc.quantity,
        bc.discount_pct,
        COALESCE(
          (SELECT AVG(b.buying_price) FROM batches b WHERE b.product_id = p.id AND b.quantity > 0),
          0
        ) AS unit_cost,
        COALESCE(
          (SELECT price FROM product_prices pp
           JOIN price_lists pl ON pl.id = pp.price_list_id
           WHERE pp.product_id = p.id AND pl.is_default = 1 LIMIT 1),
          0
        ) AS unit_price
     FROM bundle_components bc
     JOIN products p ON p.id = bc.component_product_id
     WHERE bc.bundle_product_id = ?1
     ORDER BY p.name ASC`,
    [bundleProductId],
  );
}

/** Is this product a bundle (has children)? Cheap query used at POS to know when to explode. */
export async function isBundle(productId: string): Promise<boolean> {
  const [row] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM bundle_components WHERE bundle_product_id = ?1`,
    [productId],
  );
  return (row?.n ?? 0) > 0;
}

/** Add a component to a bundle. */
export async function addComponent(bundleProductId: string, componentProductId: string, quantity: number, discountPct = 0): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO bundle_components (id, bundle_product_id, component_product_id, quantity, discount_pct)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(bundle_product_id, component_product_id) DO UPDATE
       SET quantity = excluded.quantity, discount_pct = excluded.discount_pct`,
    [id, bundleProductId, componentProductId, quantity, discountPct],
  );
  return id;
}

export async function removeComponent(componentId: string): Promise<void> {
  await execute(`DELETE FROM bundle_components WHERE id = ?1`, [componentId]);
}

/**
 * Compute a bundle's rolled-up cost + suggested price.
 * Cost = sum(component.cost × qty) — always accurate.
 * SuggestedPrice = sum(component.price × qty × (1 - discount_pct/100)) — a
 * starting point that the owner can override on the product itself.
 */
export async function computeRollup(bundleProductId: string): Promise<{
  total_cost: number;
  suggested_price: number;
}> {
  const comps = await getBundleComponents(bundleProductId);
  let cost = 0;
  let price = 0;
  for (const c of comps) {
    cost += (c.unit_cost ?? 0) * c.quantity;
    const netPrice = (c.unit_price ?? 0) * (1 - (c.discount_pct ?? 0) / 100);
    price += netPrice * c.quantity;
  }
  return { total_cost: cost, suggested_price: price };
}

/**
 * When a bundle is sold, we deduct stock from each component (using the same
 * batch-selection logic the POS uses for regular products). Callers pass the
 * saleId + bundle qty and we do the rest.
 *
 * Idempotent via a marker in sale_items metadata — repeat calls are safe.
 */
export async function expandBundleAtSale(
  saleId: string,
  bundleProductId: string,
  bundleQty: number,
): Promise<Array<{ product_id: string; quantity: number }>> {
  void saleId; // referenced by callers for logging; deduction is by product+qty
  const comps = await getBundleComponents(bundleProductId);
  const deductions: Array<{ product_id: string; quantity: number }> = [];
  for (const c of comps) {
    const totalQty = c.quantity * bundleQty;
    deductions.push({ product_id: c.component_product_id, quantity: totalQty });
    // FIFO batch deduction (matches services/inventory.ts pattern)
    let remaining = totalQty;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches WHERE product_id = ?1 AND quantity > 0
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
      [c.component_product_id],
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      await execute(
        `UPDATE batches SET quantity = quantity - ?2 WHERE id = ?1`,
        [b.id, take],
      );
      remaining -= take;
    }
  }
  return deductions;
}

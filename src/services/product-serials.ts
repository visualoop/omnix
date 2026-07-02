/**
 * Serial-number tracking for electronics / appliances / anything unique.
 *
 * Flow:
 *   1. Receive: scan/type each serial on GRN → status='in_stock'.
 *   2. Sell: scan a serial on POS → status='sold', sale_id set, sold_at stamped.
 *   3. Return: same serial → status='returned', ready to re-sell.
 *   4. Damage: → status='damaged', typically supplier_return follows.
 *   5. Warranty: warranty_until stamped from product + received_at.
 */
import { execute, query } from "@/lib/db";

export type SerialStatus = "in_stock" | "sold" | "returned" | "damaged" | "quarantined";

export interface ProductSerial {
  id: string;
  product_id: string;
  product_name: string;
  batch_id: string | null;
  serial: string;
  status: SerialStatus;
  sale_id: string | null;
  sale_number: string | null;
  received_at: string;
  sold_at: string | null;
  warranty_until: string | null;
  notes: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export async function registerSerial(input: {
  product_id: string;
  batch_id?: string;
  serial: string;
  warranty_months?: number;
  notes?: string;
}): Promise<string> {
  const id = newId();
  const warrantyUntil = input.warranty_months
    ? new Date(Date.now() + input.warranty_months * 30 * 24 * 3600_000).toISOString().slice(0, 10)
    : null;
  await execute(
    `INSERT INTO product_serials (id, product_id, batch_id, serial, status, warranty_until, notes)
     VALUES (?1, ?2, ?3, ?4, 'in_stock', ?5, ?6)`,
    [id, input.product_id, input.batch_id ?? null, input.serial, warrantyUntil, input.notes ?? null],
  );
  return id;
}

/**
 * Try to consume a serial for a sale. Returns true if the serial existed +
 * was in_stock. Callers check the return to detect scan errors.
 */
export async function consumeForSale(serial: string, saleId: string): Promise<boolean> {
  const res = await execute(
    `UPDATE product_serials
     SET status = 'sold', sale_id = ?2, sold_at = datetime('now')
     WHERE serial = ?1 AND status = 'in_stock'`,
    [serial, saleId],
  );
  return typeof res === "number" ? res > 0 : true;
}

export async function returnSerial(serial: string): Promise<boolean> {
  const res = await execute(
    `UPDATE product_serials
     SET status = 'returned', sale_id = NULL, sold_at = NULL
     WHERE serial = ?1 AND status = 'sold'`,
    [serial],
  );
  return typeof res === "number" ? res > 0 : true;
}

export async function markDamaged(serial: string, notes?: string): Promise<void> {
  await execute(
    `UPDATE product_serials SET status = 'damaged', notes = COALESCE(notes || ' · ', '') || ?2 WHERE serial = ?1`,
    [serial, notes ?? "damaged"],
  );
}

export async function findBySerial(serial: string): Promise<ProductSerial | null> {
  const rows = await query<ProductSerial>(
    `SELECT
        ps.id, ps.product_id,
        p.name AS product_name,
        ps.batch_id, ps.serial, ps.status,
        ps.sale_id,
        s.sale_number,
        ps.received_at, ps.sold_at, ps.warranty_until, ps.notes
     FROM product_serials ps
     JOIN products p ON p.id = ps.product_id
     LEFT JOIN sales s ON s.id = ps.sale_id
     WHERE ps.serial = ?1
     LIMIT 1`,
    [serial],
  );
  return rows[0] ?? null;
}

export async function listByProduct(productId: string, status?: SerialStatus): Promise<ProductSerial[]> {
  if (status) {
    return query<ProductSerial>(
      `SELECT ps.id, ps.product_id, p.name AS product_name, ps.batch_id, ps.serial, ps.status,
              ps.sale_id, s.sale_number, ps.received_at, ps.sold_at, ps.warranty_until, ps.notes
       FROM product_serials ps
       JOIN products p ON p.id = ps.product_id
       LEFT JOIN sales s ON s.id = ps.sale_id
       WHERE ps.product_id = ?1 AND ps.status = ?2
       ORDER BY ps.received_at DESC
       LIMIT 500`,
      [productId, status],
    );
  }
  return query<ProductSerial>(
    `SELECT ps.id, ps.product_id, p.name AS product_name, ps.batch_id, ps.serial, ps.status,
            ps.sale_id, s.sale_number, ps.received_at, ps.sold_at, ps.warranty_until, ps.notes
     FROM product_serials ps
     JOIN products p ON p.id = ps.product_id
     LEFT JOIN sales s ON s.id = ps.sale_id
     WHERE ps.product_id = ?1
     ORDER BY ps.received_at DESC
     LIMIT 500`,
    [productId],
  );
}

export async function countByStatus(productId: string): Promise<Record<SerialStatus, number>> {
  const rows = await query<{ status: SerialStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM product_serials WHERE product_id = ?1 GROUP BY status`,
    [productId],
  );
  const out: Record<SerialStatus, number> = {
    in_stock: 0, sold: 0, returned: 0, damaged: 0, quarantined: 0,
  };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

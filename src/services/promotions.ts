/**
 * Promotions / Time-Limited Offers
 *
 * Schedule time-limited discounts. Three types:
 * - percent_off: e.g. "10% off all painkillers"
 * - amount_off: e.g. "KES 100 off purchases over KES 1000"
 * - buy_x_get_y: e.g. "Buy 2 get 1 free on vitamins"
 *
 * Apply at cart-level, product-level, or category-level.
 */
import { query, execute } from "@/lib/db";

export type PromotionType = "percent_off" | "amount_off" | "buy_x_get_y";
export type PromotionTarget = "cart" | "product" | "category";

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  value: number;
  target_type: PromotionTarget;
  target_id: string | null;
  starts_at: string;
  ends_at: string;
  min_purchase: number;
  max_uses: number | null;
  uses_count: number;
  code: string | null;
  active: number;
  created_at: string;
}

export async function listPromotions(includeExpired = false): Promise<Promotion[]> {
  const where = includeExpired ? "1=1" : `active = 1 AND ends_at >= datetime('now')`;
  return query<Promotion>(
    `SELECT * FROM promotions WHERE ${where} ORDER BY ends_at DESC`,
  );
}

export async function getActivePromotions(): Promise<Promotion[]> {
  return query<Promotion>(
    `SELECT * FROM promotions
     WHERE active = 1
       AND starts_at <= datetime('now')
       AND ends_at >= datetime('now')
       AND (max_uses IS NULL OR uses_count < max_uses)
     ORDER BY ends_at`,
  );
}

export async function createPromotion(input: Omit<Promotion, "id" | "uses_count" | "created_at">): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO promotions (
       id, name, description, type, value, target_type, target_id,
       starts_at, ends_at, min_purchase, max_uses, code, active
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    [
      id, input.name, input.description || null, input.type, input.value,
      input.target_type, input.target_id || null,
      input.starts_at, input.ends_at, input.min_purchase || 0,
      input.max_uses || null, input.code || null, input.active ?? 1,
    ],
  );
  return id;
}

export async function updatePromotion(id: string, updates: Partial<Promotion>): Promise<void> {
  const cur = await getPromotion(id);
  if (!cur) throw new Error("Promotion not found");
  const merged = { ...cur, ...updates };
  await execute(
    `UPDATE promotions SET
       name = ?2, description = ?3, type = ?4, value = ?5,
       target_type = ?6, target_id = ?7, starts_at = ?8, ends_at = ?9,
       min_purchase = ?10, max_uses = ?11, code = ?12, active = ?13
     WHERE id = ?1`,
    [
      id, merged.name, merged.description, merged.type, merged.value,
      merged.target_type, merged.target_id, merged.starts_at, merged.ends_at,
      merged.min_purchase, merged.max_uses, merged.code, merged.active,
    ],
  );
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  const rows = await query<Promotion>(`SELECT * FROM promotions WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function togglePromotion(id: string, active: number): Promise<void> {
  await execute(`UPDATE promotions SET active = ?1 WHERE id = ?2`, [active, id]);
}

export async function deletePromotion(id: string): Promise<void> {
  await execute(`DELETE FROM promotions WHERE id = ?1`, [id]);
}

/** Try to find a promo by code. */
export async function getPromotionByCode(code: string): Promise<Promotion | null> {
  const rows = await query<Promotion>(
    `SELECT * FROM promotions
     WHERE active = 1
       AND code = ?1
       AND starts_at <= datetime('now')
       AND ends_at >= datetime('now')
       AND (max_uses IS NULL OR uses_count < max_uses)
     LIMIT 1`,
    [code.toUpperCase()],
  );
  return rows[0] || null;
}

export async function incrementPromotionUse(id: string): Promise<void> {
  await execute(`UPDATE promotions SET uses_count = uses_count + 1 WHERE id = ?1`, [id]);
}

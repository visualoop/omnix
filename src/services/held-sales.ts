import { query, execute } from "@/lib/db";
import type { CartItem } from "@/services/sales";

export interface HeldSale {
  id: string;
  cart_json: string;
  customer_id: string | null;
  note: string | null;
  user_id: string;
  created_at: string;
  // Computed
  item_count?: number;
  total?: number;
  customer_name?: string | null;
}

export interface HeldSaleSnapshot {
  items: CartItem[];
  discount: number;
}

export async function holdCurrentSale(input: {
  items: CartItem[];
  discount: number;
  customer_id: string | null;
  user_id: string;
  note?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const cart_json: HeldSaleSnapshot = {
    items: input.items,
    discount: input.discount,
  };
  await execute(
    `INSERT INTO held_sales (id, cart_json, customer_id, note, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, JSON.stringify(cart_json), input.customer_id, input.note || null, input.user_id]
  );
  return id;
}

export async function listHeldSales(): Promise<HeldSale[]> {
  return query<HeldSale>(
    `SELECT h.*, c.name as customer_name
     FROM held_sales h
     LEFT JOIN customers c ON c.id = h.customer_id
     ORDER BY h.created_at DESC LIMIT 50`
  );
}

export async function recallHeldSale(id: string): Promise<{ snapshot: HeldSaleSnapshot; customer_id: string | null } | null> {
  const rows = await query<HeldSale>("SELECT * FROM held_sales WHERE id = ?1", [id]);
  if (!rows[0]) return null;
  // Delete it on recall — single source of truth
  await execute("DELETE FROM held_sales WHERE id = ?1", [id]);
  const snapshot = JSON.parse(rows[0].cart_json) as HeldSaleSnapshot;
  return { snapshot, customer_id: rows[0].customer_id };
}

export async function deleteHeldSale(id: string): Promise<void> {
  await execute("DELETE FROM held_sales WHERE id = ?1", [id]);
}

export async function countHeldSales(): Promise<number> {
  const rows = await query<{ c: number }>("SELECT COUNT(*) as c FROM held_sales");
  return rows[0]?.c || 0;
}

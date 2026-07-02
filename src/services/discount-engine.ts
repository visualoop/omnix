/**
 * Discount engine — evaluates every applicable rule against a cart snapshot
 * and returns line-level adjustments the POS applies.
 *
 * Rule types:
 *   buy_x_get_y      — buy N of a SKU, get M free (or discounted)
 *   tier_percent     — spend ≥ X → Y% off subtotal
 *   category_percent — every line in category C gets Y% off
 *   bogo             — pair-based half-off / free-second logic
 *
 * Also handles:
 *   - Customer-group discounts (`customer_groups.discount_percent`)
 *   - Coupon codes (`coupons` table with usage tracking)
 *   - Gift card redemption (`gift_cards` table + transactions)
 *
 * Return shape stays flat so the POS can render "why this line was discounted".
 */
import { execute, query } from "@/lib/db";

export interface CartLine {
  line_id: string;                     // client-generated for tracking adjustments
  product_id: string;
  category_id?: string | null;
  quantity: number;
  unit_price: number;
  original_line_total: number;
}

export interface CartSnapshot {
  lines: CartLine[];
  customer_id?: string | null;
  subtotal: number;
}

export interface Adjustment {
  line_id?: string;                    // when applied to a specific line
  amount: number;                      // positive = discount off subtotal (KES)
  rule_id: string;
  rule_name: string;
  rule_kind: string;
}

export interface CouponRedemption {
  code: string;
  coupon_id: string;
  amount: number;
}

export interface GiftCardRedemption {
  code: string;
  gift_card_id: string;
  amount: number;
}

export interface DiscountResult {
  adjustments: Adjustment[];
  total_discount: number;
  coupon?: CouponRedemption;
  gift_card?: GiftCardRedemption;
  customer_group_discount: number;
}

interface DiscountRule {
  id: string;
  name: string;
  rule_type: string;
  params: string;
  priority: number;
  valid_from: string | null;
  valid_until: string | null;
}

async function activeRules(): Promise<DiscountRule[]> {
  return query<DiscountRule>(
    `SELECT id, name, rule_type, params, priority, valid_from, valid_until
     FROM discount_rules
     WHERE active = 1
       AND (valid_from IS NULL OR valid_from <= datetime('now'))
       AND (valid_until IS NULL OR valid_until >= datetime('now'))
     ORDER BY priority DESC`,
  );
}

function safeParse<T>(json: string): T | null {
  try { return JSON.parse(json) as T; } catch { return null; }
}

/**
 * Evaluate every active rule against the cart. Returns adjustments the POS
 * must apply. Doesn't mutate the cart.
 */
export async function evaluateCart(cart: CartSnapshot): Promise<DiscountResult> {
  const rules = await activeRules();
  const adjustments: Adjustment[] = [];

  for (const rule of rules) {
    const params = safeParse<Record<string, unknown>>(rule.params) ?? {};
    if (rule.rule_type === "buy_x_get_y") {
      const buy = Number(params.buy ?? 0);
      const getFree = Number(params.get_free ?? 0);
      const productId = params.product_id as string | undefined;
      if (!buy || !getFree) continue;
      for (const line of cart.lines) {
        if (productId && line.product_id !== productId) continue;
        // How many "free" units this line qualifies for.
        const bundles = Math.floor(line.quantity / (buy + getFree));
        if (bundles > 0) {
          const discountUnits = bundles * getFree;
          const disc = discountUnits * line.unit_price;
          adjustments.push({
            line_id: line.line_id,
            amount: disc,
            rule_id: rule.id,
            rule_name: rule.name,
            rule_kind: rule.rule_type,
          });
        }
      }
    } else if (rule.rule_type === "tier_percent") {
      const minSpend = Number(params.min_spend ?? 0);
      const pct = Number(params.percent ?? 0);
      if (cart.subtotal >= minSpend && pct > 0) {
        adjustments.push({
          amount: cart.subtotal * (pct / 100),
          rule_id: rule.id,
          rule_name: rule.name,
          rule_kind: rule.rule_type,
        });
      }
    } else if (rule.rule_type === "category_percent") {
      const categoryId = params.category_id as string;
      const pct = Number(params.percent ?? 0);
      if (!categoryId || pct <= 0) continue;
      for (const line of cart.lines) {
        if (line.category_id === categoryId) {
          adjustments.push({
            line_id: line.line_id,
            amount: line.original_line_total * (pct / 100),
            rule_id: rule.id,
            rule_name: rule.name,
            rule_kind: rule.rule_type,
          });
        }
      }
    } else if (rule.rule_type === "bogo") {
      // Every 2nd item on the specified product is 50% off (or configurable).
      const productId = params.product_id as string;
      const pct = Number(params.second_pct_off ?? 50);
      if (!productId) continue;
      for (const line of cart.lines) {
        if (line.product_id !== productId) continue;
        const pairs = Math.floor(line.quantity / 2);
        if (pairs > 0) {
          adjustments.push({
            line_id: line.line_id,
            amount: pairs * line.unit_price * (pct / 100),
            rule_id: rule.id,
            rule_name: rule.name,
            rule_kind: rule.rule_type,
          });
        }
      }
    }
  }

  // Customer-group discount (applied on top).
  let customerGroupDiscount = 0;
  if (cart.customer_id) {
    const [row] = await query<{ discount_percent: number }>(
      `SELECT COALESCE(cg.discount_percent, 0) AS discount_percent
       FROM customers c
       LEFT JOIN customer_groups cg ON cg.id = c.customer_group_id
       WHERE c.id = ?1`,
      [cart.customer_id],
    );
    const pct = row?.discount_percent ?? 0;
    if (pct > 0) customerGroupDiscount = cart.subtotal * (pct / 100);
  }

  const totalDiscount = adjustments.reduce((s, a) => s + a.amount, 0) + customerGroupDiscount;

  return {
    adjustments,
    total_discount: totalDiscount,
    customer_group_discount: customerGroupDiscount,
  };
}

// ─── Coupons ──────────────────────────────────────────────
/**
 * Validate + calculate discount for a coupon code, without redeeming yet.
 * Returns null when the code doesn't exist / has expired / hit max redemptions.
 */
export async function validateCoupon(code: string, subtotal: number): Promise<{
  coupon_id: string;
  code: string;
  amount: number;
} | null> {
  const [row] = await query<{
    id: string;
    discount_type: string;
    discount_value: number;
    min_purchase: number;
    valid_from: string | null;
    valid_until: string | null;
    max_redemptions: number | null;
    redemptions_count: number;
    active: number;
  }>(
    `SELECT id, discount_type, discount_value, min_purchase,
            valid_from, valid_until, max_redemptions, redemptions_count, active
     FROM coupons WHERE code = ?1 LIMIT 1`,
    [code],
  );
  if (!row) return null;
  if (row.active === 0) return null;
  if (subtotal < row.min_purchase) return null;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (row.valid_from && row.valid_from > now) return null;
  if (row.valid_until && row.valid_until < now) return null;
  if (row.max_redemptions !== null && row.redemptions_count >= row.max_redemptions) return null;

  const amount = row.discount_type === "percent"
    ? subtotal * (row.discount_value / 100)
    : row.discount_value;
  return { coupon_id: row.id, code, amount };
}

/** Record a coupon redemption + increment its counter. Call from services/sales.ts on successful sale. */
export async function redeemCoupon(couponId: string, saleId: string, customerId: string | null, amount: number): Promise<void> {
  await execute(
    `INSERT INTO coupon_redemptions (id, coupon_id, sale_id, customer_id, amount_off)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [crypto.randomUUID().replace(/-/g, "").slice(0, 16), couponId, saleId, customerId, amount],
  );
  await execute(
    `UPDATE coupons SET redemptions_count = redemptions_count + 1 WHERE id = ?1`,
    [couponId],
  );
}

// ─── Gift cards ───────────────────────────────────────────
export async function validateGiftCard(code: string): Promise<{
  gift_card_id: string;
  code: string;
  balance: number;
} | null> {
  const [row] = await query<{ id: string; current_balance: number; status: string; expires_at: string | null }>(
    `SELECT id, current_balance, status, expires_at FROM gift_cards WHERE code = ?1 LIMIT 1`,
    [code],
  );
  if (!row) return null;
  if (row.status !== "active") return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  if (row.current_balance <= 0) return null;
  return { gift_card_id: row.id, code, balance: row.current_balance };
}

/** Deduct from a gift card and log the transaction. */
export async function redeemGiftCard(giftCardId: string, saleId: string, amount: number): Promise<number> {
  const [gc] = await query<{ current_balance: number }>(
    `SELECT current_balance FROM gift_cards WHERE id = ?1`,
    [giftCardId],
  );
  const balance = gc?.current_balance ?? 0;
  const applied = Math.min(balance, amount);
  const newBalance = balance - applied;
  const newStatus = newBalance === 0 ? "depleted" : "active";

  await execute(
    `UPDATE gift_cards SET current_balance = ?2, status = ?3 WHERE id = ?1`,
    [giftCardId, newBalance, newStatus],
  );
  await execute(
    `INSERT INTO gift_card_transactions (id, gift_card_id, sale_id, amount, balance_after)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [crypto.randomUUID().replace(/-/g, "").slice(0, 16), giftCardId, saleId, -applied, newBalance],
  );
  return applied;
}

/** Issue a new gift card. */
export async function issueGiftCard(input: {
  code: string;
  initial_balance: number;
  customer_id?: string;
  issued_by_user_id?: string;
  expires_at?: string;
  notes?: string;
}): Promise<string> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  await execute(
    `INSERT INTO gift_cards (id, code, initial_balance, current_balance, issued_to_customer_id, issued_by_user_id, expires_at, notes)
     VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7)`,
    [id, input.code, input.initial_balance, input.customer_id ?? null, input.issued_by_user_id ?? null, input.expires_at ?? null, input.notes ?? null],
  );
  return id;
}

/**
 * Loyalty Points System
 *
 * Earn points on each sale, redeem against future purchases. Supports
 * tier upgrades (silver/gold/platinum) based on lifetime points.
 */
import { query, execute } from "@/lib/db";

export interface LoyaltySettings {
  enabled: number;
  earn_rate: number;          // points per KES spent
  redeem_rate: number;        // KES value per point
  min_redeem_points: number;
  expiry_days: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  sale_id: string | null;
  points: number;
  balance_after: number;
  reason: string;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const [s] = await query<LoyaltySettings>(`SELECT * FROM loyalty_settings WHERE id = 1`);
  return s || {
    enabled: 1, earn_rate: 1, redeem_rate: 1, min_redeem_points: 100,
    expiry_days: 365, silver_threshold: 1000, gold_threshold: 5000, platinum_threshold: 20000,
  };
}

export async function updateLoyaltySettings(s: Partial<LoyaltySettings>): Promise<void> {
  const current = await getLoyaltySettings();
  const merged = { ...current, ...s };
  await execute(
    `UPDATE loyalty_settings SET enabled = ?1, earn_rate = ?2, redeem_rate = ?3,
       min_redeem_points = ?4, expiry_days = ?5, silver_threshold = ?6,
       gold_threshold = ?7, platinum_threshold = ?8
     WHERE id = 1`,
    [
      merged.enabled, merged.earn_rate, merged.redeem_rate,
      merged.min_redeem_points, merged.expiry_days, merged.silver_threshold,
      merged.gold_threshold, merged.platinum_threshold,
    ],
  );
}

/** Earn points on a sale (call after completing a sale). */
export async function earnPoints(
  customerId: string,
  saleId: string,
  saleTotal: number,
  userId: string,
): Promise<number> {
  const settings = await getLoyaltySettings();
  if (!settings.enabled) return 0;
  const points = Math.floor(saleTotal * settings.earn_rate);
  if (points <= 0) return 0;

  await execute(`UPDATE customers SET loyalty_points = loyalty_points + ?1 WHERE id = ?2`, [points, customerId]);
  const [c] = await query<{ loyalty_points: number }>(`SELECT loyalty_points FROM customers WHERE id = ?1`, [customerId]);

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO loyalty_transactions (id, customer_id, sale_id, points, balance_after, reason, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, 'sale', ?6)`,
    [id, customerId, saleId, points, c.loyalty_points, userId],
  );

  // Tier check
  await refreshTier(customerId);
  return points;
}

/** Redeem points to KES discount. Returns the KES value applied. */
export async function redeemPoints(
  customerId: string,
  pointsToRedeem: number,
  userId: string,
): Promise<number> {
  const settings = await getLoyaltySettings();
  if (!settings.enabled) throw new Error("Loyalty program disabled");
  if (pointsToRedeem < settings.min_redeem_points) {
    throw new Error(`Minimum redemption is ${settings.min_redeem_points} points`);
  }
  const [c] = await query<{ loyalty_points: number }>(`SELECT loyalty_points FROM customers WHERE id = ?1`, [customerId]);
  if (!c || c.loyalty_points < pointsToRedeem) {
    throw new Error("Insufficient points");
  }

  await execute(`UPDATE customers SET loyalty_points = loyalty_points - ?1 WHERE id = ?2`, [pointsToRedeem, customerId]);
  const newBalance = c.loyalty_points - pointsToRedeem;

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO loyalty_transactions (id, customer_id, points, balance_after, reason, user_id)
     VALUES (?1, ?2, ?3, ?4, 'redemption', ?5)`,
    [id, customerId, -pointsToRedeem, newBalance, userId],
  );

  return pointsToRedeem * settings.redeem_rate;
}

async function refreshTier(customerId: string): Promise<void> {
  const settings = await getLoyaltySettings();
  const [c] = await query<{ loyalty_points: number; loyalty_tier: string }>(
    `SELECT loyalty_points, loyalty_tier FROM customers WHERE id = ?1`,
    [customerId],
  );
  if (!c) return;

  let newTier: string = "standard";
  if (c.loyalty_points >= settings.platinum_threshold) newTier = "platinum";
  else if (c.loyalty_points >= settings.gold_threshold) newTier = "gold";
  else if (c.loyalty_points >= settings.silver_threshold) newTier = "silver";

  if (newTier !== c.loyalty_tier) {
    await execute(`UPDATE customers SET loyalty_tier = ?1 WHERE id = ?2`, [newTier, customerId]);
  }
}

export async function getLoyaltyHistory(customerId: string, limit = 50): Promise<LoyaltyTransaction[]> {
  return query<LoyaltyTransaction>(
    `SELECT * FROM loyalty_transactions WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    [customerId, limit],
  );
}

export async function adjustPoints(
  customerId: string,
  points: number,
  reason: string,
  userId: string,
  note?: string,
): Promise<void> {
  await execute(`UPDATE customers SET loyalty_points = MAX(0, loyalty_points + ?1) WHERE id = ?2`, [points, customerId]);
  const [c] = await query<{ loyalty_points: number }>(`SELECT loyalty_points FROM customers WHERE id = ?1`, [customerId]);
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO loyalty_transactions (id, customer_id, points, balance_after, reason, note, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, customerId, points, c.loyalty_points, reason, note || null, userId],
  );
  await refreshTier(customerId);
}

export const TIER_BENEFITS: Record<string, { label: string; color: string; multiplier: number }> = {
  standard: { label: "Standard", color: "text-muted-foreground", multiplier: 1 },
  silver:   { label: "Silver",   color: "text-zinc-500",        multiplier: 1.25 },
  gold:     { label: "Gold",     color: "text-amber-600",       multiplier: 1.5 },
  platinum: { label: "Platinum", color: "text-violet-600",      multiplier: 2 },
};

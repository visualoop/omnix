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

/** Points a sale earns for a customer, applying their current tier multiplier. Pure. */
export function computeEarnedPoints(saleTotal: number, earnRate: number, tier: string): number {
  const multiplier = TIER_BENEFITS[tier]?.multiplier ?? 1;
  return Math.floor(saleTotal * earnRate * multiplier);
}

/** Earn points on a sale (call after completing a sale). Applies the
 *  customer's tier multiplier (RT-7) and posts a GL liability entry (RT-24). */
export async function earnPoints(
  customerId: string,
  saleId: string,
  saleTotal: number,
  userId: string,
): Promise<number> {
  const settings = await getLoyaltySettings();
  if (!settings.enabled) return 0;

  // Tier multiplier is based on the tier BEFORE this sale is counted.
  const [before] = await query<{ loyalty_tier: string }>(
    `SELECT loyalty_tier FROM customers WHERE id = ?1`, [customerId],
  );
  const tier = before?.loyalty_tier ?? "standard";
  const points = computeEarnedPoints(saleTotal, settings.earn_rate, tier);
  if (points <= 0) return 0;

  await execute(`UPDATE customers SET loyalty_points = loyalty_points + ?1 WHERE id = ?2`, [points, customerId]);
  const [c] = await query<{ loyalty_points: number }>(`SELECT loyalty_points FROM customers WHERE id = ?1`, [customerId]);

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO loyalty_transactions (id, customer_id, sale_id, points, balance_after, reason, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, 'sale', ?6)`,
    [id, customerId, saleId, points, c.loyalty_points, userId],
  );

  // Post the points liability to the GL (best-effort; flags gl_posted).
  await postLoyaltyLiability(id, points, settings.redeem_rate, "earn").catch(() => {});

  // Tier check (may promote after this sale).
  await refreshTier(customerId);
  return points;
}

/**
 * Post a loyalty-points liability movement to the general ledger.
 * Earning points increases the liability (points owed to customers);
 * redeeming decreases it. Value = points x redeem_rate (KES). Best-effort:
 * if the GL helper isn't available, the transaction stays gl_posted=0 for a
 * later sweep. RT-24.
 */
async function postLoyaltyLiability(
  txnId: string,
  points: number,
  redeemRate: number,
  direction: "earn" | "redeem",
): Promise<void> {
  const value = Math.abs(points) * (redeemRate || 0);
  if (value <= 0) { await execute(`UPDATE loyalty_transactions SET gl_posted = 1 WHERE id = ?1`, [txnId]); return; }
  try {
    const { postJournal } = await import("@/services/gl");
    // Loyalty liability uses 2300 (customer deposits / owed to customers);
    // expense side is 6700 (marketing & advertising). Earn increases the
    // liability + expense; redeem reverses.
    const today = new Date().toISOString().slice(0, 10);
    await postJournal({
      entry_date: today,
      description: direction === "earn" ? "Loyalty points earned" : "Loyalty points redeemed",
      source_kind: "loyalty",
      source_id: txnId,
      lines: direction === "earn"
        ? [
            { account_code: "6700", debit: value, credit: 0 },
            { account_code: "2300", debit: 0, credit: value },
          ]
        : [
            { account_code: "2300", debit: value, credit: 0 },
            { account_code: "6700", debit: 0, credit: value },
          ],
    });
    await execute(`UPDATE loyalty_transactions SET gl_posted = 1 WHERE id = ?1`, [txnId]);
  } catch {
    // Leave gl_posted = 0; a future GL sweep can pick it up.
  }
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

  // Reverse the liability portion for the redeemed points (RT-24).
  await postLoyaltyLiability(id, pointsToRedeem, settings.redeem_rate, "redeem").catch(() => {});

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

/**
 * Expire loyalty points older than the configured window (RT-13). For each
 * customer, points earned before (now - expiry_days) that haven't already
 * been redeemed/expired are clawed back with a negative 'expiry' transaction.
 * Approximation: expires the net positive balance attributable to earn rows
 * older than the cutoff. No-op when expiry_days = 0.
 */
export async function expireLoyaltyPoints(asOf: Date = new Date()): Promise<number> {
  const settings = await getLoyaltySettings();
  if (!settings.enabled || !settings.expiry_days || settings.expiry_days <= 0) return 0;
  const cutoff = new Date(asOf.getTime() - settings.expiry_days * 86400000).toISOString();

  // Sum earned points older than the cutoff that have not been offset by
  // later redemptions/expiries. Simple model: expirable = earned_before_cutoff
  // - already_expired. Clamp to the customer's current balance.
  const rows = await query<{ customer_id: string; expirable: number; balance: number }>(
    `SELECT c.id AS customer_id,
            COALESCE(SUM(CASE WHEN lt.reason = 'sale' AND lt.created_at < ?1 THEN lt.points ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN lt.reason = 'expiry' THEN -lt.points ELSE 0 END), 0) AS expirable,
            c.loyalty_points AS balance
       FROM customers c
       JOIN loyalty_transactions lt ON lt.customer_id = c.id
      GROUP BY c.id
     HAVING expirable > 0 AND balance > 0`,
    [cutoff],
  );

  let expiredCustomers = 0;
  for (const r of rows) {
    const toExpire = Math.min(r.expirable, r.balance);
    if (toExpire <= 0) continue;
    await execute(`UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?1) WHERE id = ?2`, [toExpire, r.customer_id]);
    const [c] = await query<{ loyalty_points: number }>(`SELECT loyalty_points FROM customers WHERE id = ?1`, [r.customer_id]);
    await execute(
      `INSERT INTO loyalty_transactions (id, customer_id, points, balance_after, reason, note)
       VALUES (?1, ?2, ?3, ?4, 'expiry', ?5)`,
      [crypto.randomUUID(), r.customer_id, -toExpire, c.loyalty_points, `Expired after ${settings.expiry_days} days`],
    );
    await refreshTier(r.customer_id);
    expiredCustomers++;
  }
  return expiredCustomers;
}

export const TIER_BENEFITS: Record<string, { label: string; color: string; multiplier: number }> = {
  standard: { label: "Standard", color: "text-muted-foreground", multiplier: 1 },
  silver:   { label: "Silver",   color: "text-zinc-500",        multiplier: 1.25 },
  gold:     { label: "Gold",     color: "text-amber-600",       multiplier: 1.5 },
  platinum: { label: "Platinum", color: "text-violet-600",      multiplier: 2 },
};

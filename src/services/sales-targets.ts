/**
 * Sales targets + commissions.
 *
 * Targets: per-staff monthly numeric target with running achieved amount.
 * Commissions: rules per staff producing per-sale ledger entries payable via payroll.
 */
import { execute, query } from "@/lib/db";

export interface SalesTarget {
  id: string;
  staff_id: string;
  staff_name: string;
  period: string;                      // 'YYYY-MM'
  target_amount: number;
  achieved_amount: number;
  bonus_pct: number;
}

export interface CommissionRule {
  id: string;
  staff_id: string;
  rule_type: string;
  params: string;
  active: number;
}

export interface CommissionEntry {
  id: string;
  staff_id: string;
  staff_name: string;
  sale_id: string;
  sale_number: string;
  amount: number;
  posted_at: string;
  paid_at: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Targets ─────────────────────────────────────────────
export async function setTarget(staffId: string, period: string, amount: number, bonusPct = 0): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO sales_targets (id, staff_id, period, target_amount, bonus_pct)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(staff_id, period) DO UPDATE
       SET target_amount = excluded.target_amount, bonus_pct = excluded.bonus_pct`,
    [id, staffId, period, amount, bonusPct],
  );
  return id;
}

export async function listTargets(period: string = currentPeriod()): Promise<SalesTarget[]> {
  return query<SalesTarget>(
    `SELECT
        st.id, st.staff_id,
        COALESCE(u.full_name, u.username, e.full_name, 'Unknown') AS staff_name,
        st.period, st.target_amount, st.bonus_pct,
        COALESCE((
          SELECT SUM(s.total) FROM sales s
          WHERE s.user_id = st.staff_id
            AND s.status = 'completed'
            AND strftime('%Y-%m', s.created_at) = st.period
        ), 0) AS achieved_amount
     FROM sales_targets st
     LEFT JOIN users u ON u.id = st.staff_id
     LEFT JOIN employees e ON e.id = st.staff_id
     WHERE st.period = ?1
     ORDER BY (target_amount - achieved_amount) ASC`,
    [period],
  );
}

// ─── Commissions ─────────────────────────────────────────
/** Compute a commission for a completed sale. Applies the staff's active rule. */
export async function commissionForSale(staffId: string, saleId: string, saleAmount: number): Promise<number> {
  const rules = await query<CommissionRule>(
    `SELECT id, staff_id, rule_type, params, active
     FROM commissions
     WHERE staff_id = ?1 AND active = 1 LIMIT 1`,
    [staffId],
  );
  const rule = rules[0];
  if (!rule) return 0;

  let params: Record<string, unknown> = {};
  try { params = JSON.parse(rule.params); } catch { /* ignore */ }

  let amount = 0;
  if (rule.rule_type === "flat_pct") {
    const pct = Number(params.percent ?? 0);
    amount = saleAmount * (pct / 100);
  } else if (rule.rule_type === "tiered") {
    // params.tiers = [{ from: 0, pct: 2 }, { from: 50000, pct: 3 }, ...]
    const tiers = (params.tiers as Array<{ from: number; pct: number }>) ?? [];
    for (const tier of tiers.slice().sort((a, b) => b.from - a.from)) {
      if (saleAmount >= tier.from) {
        amount = saleAmount * (tier.pct / 100);
        break;
      }
    }
  } else if (rule.rule_type === "per_product") {
    // params.rates = { productId: rate_per_unit }
    // Compute by looking at the sale items.
    const items = await query<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1`,
      [saleId],
    );
    const rates = params.rates as Record<string, number> | undefined;
    if (rates) {
      for (const it of items) {
        const rate = rates[it.product_id] ?? 0;
        amount += rate * it.quantity;
      }
    }
  }

  if (amount > 0) {
    await execute(
      `INSERT INTO commission_ledger (id, staff_id, sale_id, amount) VALUES (?1, ?2, ?3, ?4)`,
      [newId(), staffId, saleId, amount],
    );
  }
  return amount;
}

export async function listCommissions(staffId?: string, unpaidOnly = false): Promise<CommissionEntry[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 0;
  if (staffId) { clauses.push(`cl.staff_id = ?${++i}`); params.push(staffId); }
  if (unpaidOnly) clauses.push(`cl.paid_at IS NULL`);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<CommissionEntry>(
    `SELECT
        cl.id, cl.staff_id,
        COALESCE(u.full_name, u.username, e.full_name, 'Unknown') AS staff_name,
        cl.sale_id, s.sale_number,
        cl.amount, cl.posted_at, cl.paid_at
     FROM commission_ledger cl
     LEFT JOIN users u ON u.id = cl.staff_id
     LEFT JOIN employees e ON e.id = cl.staff_id
     LEFT JOIN sales s ON s.id = cl.sale_id
     ${where}
     ORDER BY cl.posted_at DESC
     LIMIT 500`,
    params,
  );
}

export async function markPaid(entryIds: string[], via: string): Promise<void> {
  if (entryIds.length === 0) return;
  const placeholders = entryIds.map((_, i) => `?${i + 2}`).join(",");
  await execute(
    `UPDATE commission_ledger SET paid_at = datetime('now'), paid_via = ?1 WHERE id IN (${placeholders})`,
    [via, ...entryIds],
  );
}

/**
 * Tips reporting service.
 */
import { query, execute } from "@/lib/db";

export interface TipBreakdown {
  total_tips: number;
  tip_count: number;
  avg_tip: number;
  cash_tips: number;
  mpesa_tips: number;
  card_tips: number;
}

export async function getTipsSummary(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<TipBreakdown> {
  const conditions: string[] = ["s.status != 'voided'", "s.tip_amount > 0"];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  if (opts?.branchId) { conditions.push(`s.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const [r] = await query<TipBreakdown & { method_breakdown: string }>(
    `SELECT
       COALESCE(SUM(s.tip_amount), 0) AS total_tips,
       COUNT(*) AS tip_count,
       COALESCE(AVG(s.tip_amount), 0) AS avg_tip,
       0 AS cash_tips, 0 AS mpesa_tips, 0 AS card_tips,
       '' AS method_breakdown
     FROM sales s
     ${where}`,
    params,
  );

  // Per-method breakdown via payment table
  const methods = await query<{ method_name: string; total: number }>(
    `SELECT p.method_name, SUM(s.tip_amount) AS total
     FROM sales s
     JOIN payments p ON p.sale_id = s.id
     ${where}
     GROUP BY p.method_name`,
    params,
  );
  let cash_tips = 0, mpesa_tips = 0, card_tips = 0;
  for (const m of methods) {
    const lower = m.method_name.toLowerCase();
    if (lower.includes("cash")) cash_tips += m.total;
    else if (lower.includes("pesa") || lower.includes("m-pesa")) mpesa_tips += m.total;
    else if (lower.includes("card")) card_tips += m.total;
  }

  return {
    total_tips: r?.total_tips || 0,
    tip_count: r?.tip_count || 0,
    avg_tip: r?.avg_tip || 0,
    cash_tips, mpesa_tips, card_tips,
  };
}

export interface TipByEmployee {
  employee_id: string | null;
  employee_name: string;
  job_title: string | null;
  tip_count: number;
  total_tips: number;
  avg_tip: number;
}

export async function getTipsByEmployee(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<TipByEmployee[]> {
  const conditions: string[] = ["s.status != 'voided'", "s.tip_amount > 0"];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  if (opts?.branchId) { conditions.push(`s.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  return query<TipByEmployee>(
    `SELECT
       s.tip_employee_id AS employee_id,
       COALESCE(e.full_name, '(Pool / Unassigned)') AS employee_name,
       e.job_title,
       COUNT(*) AS tip_count,
       SUM(s.tip_amount) AS total_tips,
       AVG(s.tip_amount) AS avg_tip
     FROM sales s
     LEFT JOIN employees e ON e.id = s.tip_employee_id
     ${where}
     GROUP BY s.tip_employee_id
     ORDER BY total_tips DESC`,
    params,
  );
}

// ─── Distribution log ──────────────────────────────────────────────────
export interface TipDistribution {
  id: string;
  period_start: string;
  period_end: string;
  total_tips: number;
  employee_id: string;
  employee_name: string;
  share_amount: number;
  distribution_method: "direct" | "pooled_equal" | "pooled_hours" | "custom";
  notes: string | null;
  user_id: string;
  branch_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export async function listTipDistributions(opts?: {
  startDate?: string;
  endDate?: string;
}): Promise<TipDistribution[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`period_start >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`period_end <= ?${params.length + 1}`); params.push(opts.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<TipDistribution>(
    `SELECT * FROM tip_distributions ${where} ORDER BY created_at DESC LIMIT 500`,
    params,
  );
}

export async function recordTipDistribution(input: {
  period_start: string;
  period_end: string;
  shares: Array<{ employee_id: string; employee_name: string; share_amount: number }>;
  method: TipDistribution["distribution_method"];
  notes?: string;
  user_id: string;
  paid: boolean;
}): Promise<void> {
  const total = input.shares.reduce((s, sh) => s + sh.share_amount, 0);
  for (const s of input.shares) {
    await execute(
      `INSERT INTO tip_distributions (id, period_start, period_end, total_tips,
         employee_id, employee_name, share_amount, distribution_method, notes, user_id, paid_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      [crypto.randomUUID(), input.period_start, input.period_end, total,
        s.employee_id, s.employee_name, s.share_amount, input.method,
        input.notes || null, input.user_id, input.paid ? new Date().toISOString() : null],
    );
  }
}

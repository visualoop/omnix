/**
 * Report builder — saved queries with dimensions + measures + filters.
 *
 * Each saved report stores a JSON query definition. The runner interprets
 * the definition and produces rows the UI renders as table / chart.
 *
 * Supported entity families for MVP:
 *   'sales'      — sales + sale_items + payment_methods
 *   'purchases'  — purchase_orders + goods_receipts
 *   'inventory'  — products + batches
 *   'finance'    — journal_lines + chart_of_accounts
 *
 * Query shape:
 *   { entity: 'sales', dimensions: ['day'|'branch'|'category'|'staff'|'payment_method'],
 *     measures: ['count'|'total'|'tax'|'discount'|'refunds'],
 *     filters: { from, to, branch_id?, category_id?, staff_id? },
 *     order_by?: 'measure_desc'|'dimension_asc' }
 */
import { execute, query } from "@/lib/db";

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  query_json: string;
  schedule: string | null;
  next_run_at: string | null;
  recipient_emails: string | null;
  active: number;
  created_by: string | null;
  created_at: string;
}

export interface ReportQuery {
  entity: "sales" | "purchases" | "inventory" | "finance";
  dimensions: string[];
  measures: string[];
  filters: Record<string, string | number | undefined>;
  order_by?: string;
  limit?: number;
}

export type ReportRow = Record<string, string | number | null>;

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

// ─── CRUD ─────────────────────────────────────────────────
export async function saveReport(input: {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  query: ReportQuery;
  schedule?: string;
  recipient_emails?: string;
  created_by?: string;
}): Promise<string> {
  const id = input.id ?? newId();
  await execute(
    `INSERT INTO saved_reports (id, name, description, category, query_json, schedule, recipient_emails, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(id) DO UPDATE
       SET name = excluded.name, description = excluded.description, category = excluded.category,
           query_json = excluded.query_json, schedule = excluded.schedule,
           recipient_emails = excluded.recipient_emails`,
    [
      id, input.name, input.description ?? null, input.category ?? null,
      JSON.stringify(input.query),
      input.schedule ?? null, input.recipient_emails ?? null, input.created_by ?? null,
    ],
  );
  return id;
}

export async function listReports(): Promise<SavedReport[]> {
  return query<SavedReport>(`SELECT * FROM saved_reports WHERE active = 1 ORDER BY name ASC LIMIT 200`);
}

export async function getReport(id: string): Promise<SavedReport | null> {
  const rows = await query<SavedReport>(`SELECT * FROM saved_reports WHERE id = ?1`, [id]);
  return rows[0] ?? null;
}

export async function deleteReport(id: string): Promise<void> {
  await execute(`DELETE FROM saved_reports WHERE id = ?1`, [id]);
}

// ─── Runner ───────────────────────────────────────────────
export async function runReport(q: ReportQuery): Promise<ReportRow[]> {
  if (q.entity === "sales") return runSalesReport(q);
  if (q.entity === "purchases") return runPurchasesReport(q);
  if (q.entity === "inventory") return runInventoryReport(q);
  if (q.entity === "finance") return runFinanceReport(q);
  return [];
}

function dimensionSql(dim: string, ns: "sale"): string {
  const map: Record<string, string> = {
    day: `date(s.created_at)`,
    week: `strftime('%Y-W%W', s.created_at)`,
    month: `strftime('%Y-%m', s.created_at)`,
    branch: `s.branch_id`,
    staff: `s.user_id`,
    payment_method: `(SELECT pm.name FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id WHERE p.sale_id = s.id LIMIT 1)`,
    category: `(SELECT c.name FROM sale_items si JOIN products p ON p.id = si.product_id JOIN categories c ON c.id = p.category_id WHERE si.sale_id = s.id LIMIT 1)`,
  };
  void ns;
  return map[dim] ?? `'unknown'`;
}

function measureSql(m: string): string {
  const map: Record<string, string> = {
    count: `COUNT(DISTINCT s.id)`,
    total: `COALESCE(SUM(s.total), 0)`,
    tax: `COALESCE(SUM(s.tax_amount), 0)`,
    discount: `COALESCE(SUM(s.discount_amount), 0)`,
    subtotal: `COALESCE(SUM(s.subtotal), 0)`,
  };
  return map[m] ?? `0`;
}

async function runSalesReport(q: ReportQuery): Promise<ReportRow[]> {
  const dimensions = q.dimensions.length ? q.dimensions : ["day"];
  const measures = q.measures.length ? q.measures : ["total"];

  const dimSelects = dimensions.map((d, i) => `${dimensionSql(d, "sale")} AS d_${i}`).join(", ");
  const mSelects = measures.map((m) => `${measureSql(m)} AS m_${m}`).join(", ");

  const clauses: string[] = ["s.status = 'completed'"];
  const params: unknown[] = [];
  let i = 0;
  if (q.filters.from) { clauses.push(`s.created_at >= ?${++i}`); params.push(q.filters.from); }
  if (q.filters.to) { clauses.push(`s.created_at <= ?${++i}`); params.push(q.filters.to); }
  if (q.filters.branch_id) { clauses.push(`s.branch_id = ?${++i}`); params.push(q.filters.branch_id); }
  if (q.filters.staff_id) { clauses.push(`s.user_id = ?${++i}`); params.push(q.filters.staff_id); }

  const where = clauses.join(" AND ");
  const groupBy = dimensions.map((_, i) => `d_${i}`).join(", ");
  const limit = q.limit ?? 500;

  const sql = `
    SELECT ${dimSelects}, ${mSelects}
    FROM sales s
    WHERE ${where}
    GROUP BY ${groupBy}
    ORDER BY ${measures[0] ? `m_${measures[0]} DESC` : `d_0 ASC`}
    LIMIT ${limit}
  `;
  const rows = await query<ReportRow>(sql, params).catch(() => []);
  return normaliseRows(rows, dimensions, measures);
}

async function runPurchasesReport(q: ReportQuery): Promise<ReportRow[]> {
  const clauses: string[] = ["po.status IN ('received', 'partial')"];
  const params: unknown[] = [];
  let i = 0;
  if (q.filters.from) { clauses.push(`po.created_at >= ?${++i}`); params.push(q.filters.from); }
  if (q.filters.to) { clauses.push(`po.created_at <= ?${++i}`); params.push(q.filters.to); }
  const where = clauses.join(" AND ");
  return query<ReportRow>(
    `SELECT
        po.supplier_id AS supplier,
        COUNT(*) AS count,
        COALESCE(SUM(po.total), 0) AS total
     FROM purchase_orders po
     WHERE ${where}
     GROUP BY po.supplier_id
     ORDER BY total DESC
     LIMIT ${q.limit ?? 500}`,
    params,
  ).catch(() => []);
}

async function runInventoryReport(q: ReportQuery): Promise<ReportRow[]> {
  return query<ReportRow>(
    `SELECT
        p.id AS product_id,
        p.name,
        p.sku,
        COALESCE(SUM(b.quantity), 0) AS on_hand,
        COALESCE(SUM(b.quantity * b.buying_price), 0) AS value_at_cost
     FROM products p
     LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.deleted_at IS NULL
     GROUP BY p.id
     ORDER BY value_at_cost DESC
     LIMIT ${q.limit ?? 500}`,
  ).catch(() => []);
}

async function runFinanceReport(q: ReportQuery): Promise<ReportRow[]> {
  const clauses: string[] = ["e.posted = 1"];
  const params: unknown[] = [];
  let i = 0;
  if (q.filters.from) { clauses.push(`e.entry_date >= ?${++i}`); params.push(q.filters.from); }
  if (q.filters.to) { clauses.push(`e.entry_date <= ?${++i}`); params.push(q.filters.to); }
  return query<ReportRow>(
    `SELECT
        c.code, c.name, c.type,
        COALESCE(SUM(l.debit), 0) AS debit,
        COALESCE(SUM(l.credit), 0) AS credit
     FROM journal_lines l
     JOIN chart_of_accounts c ON c.code = l.account_code
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY c.code
     ORDER BY c.code`,
    params,
  ).catch(() => []);
}

function normaliseRows(rows: ReportRow[], dimensions: string[], measures: string[]): ReportRow[] {
  return rows.map((r) => {
    const out: ReportRow = {};
    dimensions.forEach((d, i) => { out[d] = r[`d_${i}`] ?? null; });
    measures.forEach((m) => { out[m] = (r[`m_${m}`] as number) ?? 0; });
    return out;
  });
}

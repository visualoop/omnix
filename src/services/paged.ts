/**
 * Paginated + searchable list services for every long-growing table.
 *
 * One place = one review boundary. Each function is ~5 lines using the
 * shared pagedQuery helper. Pages import from here via useListData.
 *
 * Column choices explained:
 *   - Search columns include human-facing identifiers (name, number, code)
 *   - Not all columns are joined — pages that need extra data (customer
 *     name, product name) get a lightweight join and search across the join.
 */
import { pagedQuery } from "@/lib/paged-query";
import type { ListPage, ListQuery } from "@/lib/list-types";

// ─── Invoicing ─────────────────────────────────────────────────
export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: string;
}

export async function pageInvoices(
  q: ListQuery & { status?: string; type?: "invoice" | "quotation"; branchId?: string },
): Promise<ListPage<InvoiceRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.status) {
    extraWhere.push(`status = ?${++i}`);
    extraParams.push(q.status);
  }
  if (q.type) {
    extraWhere.push(`type = ?${++i}`);
    extraParams.push(q.type);
  }
  if (q.branchId) {
    extraWhere.push(`branch_id = ?${++i}`);
    extraParams.push(q.branchId);
  }
  return pagedQuery<InvoiceRow>(
    {
      table: "invoices",
      searchColumns: ["invoice_number", "customer_name"],
      orderBy: "issue_date DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Promotions ────────────────────────────────────────────────
export interface PromotionRow {
  id: string;
  name: string;
  code: string | null;
  type: string;
  active: number;
}

export async function pagePromotions(q: ListQuery & { active?: boolean }): Promise<ListPage<PromotionRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.active !== undefined) {
    extraWhere.push(`active = ?${extraParams.length + 1}`);
    extraParams.push(q.active ? 1 : 0);
  }
  return pagedQuery<PromotionRow>(
    {
      table: "promotions",
      searchColumns: ["name", "code"],
      orderBy: "created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Sales history ─────────────────────────────────────────────
export interface SaleRow {
  id: string;
  sale_number: string;
  customer_id: string | null;
  customer_name: string | null;
  total: number;
  tax_amount: number;
  status: string;
  created_at: string;
}

export async function pageSales(q: ListQuery & { from?: string; to?: string; status?: string; branch_id?: string; exclude_held?: boolean }): Promise<ListPage<SaleRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`s.created_at >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`s.created_at <= ?${++i}`); extraParams.push(q.to); }
  if (q.status) { extraWhere.push(`s.status = ?${++i}`); extraParams.push(q.status); }
  if (q.branch_id) { extraWhere.push(`s.branch_id = ?${++i}`); extraParams.push(q.branch_id); }
  if (q.exclude_held) { extraWhere.push(`s.status != 'held'`); }
  return pagedQuery<SaleRow>(
    {
      baseSql:
        `SELECT s.id, s.sale_number, s.customer_id, c.name AS customer_name,
                s.total, s.tax_amount, s.status, s.payment_status, s.created_at,
                u.full_name AS cashier,
                (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.user_id`,
      countSql: `SELECT COUNT(*) AS n FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.user_id`,
      searchColumns: ["s.sale_number", "c.name", "u.full_name"],
      orderBy: "s.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Audit log ─────────────────────────────────────────────────
export interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource: string | null;
  metadata: string | null;
  created_at: string;
}

export async function pageAuditLog(q: ListQuery & { action?: string }): Promise<ListPage<AuditRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.action) {
    extraWhere.push(`action = ?${extraParams.length + 1}`);
    extraParams.push(q.action);
  }
  return pagedQuery<AuditRow>(
    {
      table: "audit_log",
      searchColumns: ["action", "resource", "metadata"],
      orderBy: "created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Purchase orders ───────────────────────────────────────────
export interface PurchaseOrderRow {
  id: string;
  po_number: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  total: number;
  created_at: string;
}

export async function pagePurchaseOrders(q: ListQuery & { status?: string; supplier_id?: string }): Promise<ListPage<PurchaseOrderRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.status) { extraWhere.push(`po.status = ?${++i}`); extraParams.push(q.status); }
  if (q.supplier_id) { extraWhere.push(`po.supplier_id = ?${++i}`); extraParams.push(q.supplier_id); }
  return pagedQuery<PurchaseOrderRow>(
    {
      baseSql:
        `SELECT po.id, po.po_number, po.supplier_id, s.name AS supplier_name,
                po.status, po.total, po.created_at
         FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id`,
      searchColumns: ["po.po_number", "s.name"],
      orderBy: "po.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Expenses ──────────────────────────────────────────────────
export interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category_id: string | null;
  vendor: string | null;
}

export async function pageExpenses(q: ListQuery & { category_id?: string; from?: string; to?: string }): Promise<ListPage<ExpenseRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.category_id) { extraWhere.push(`category_id = ?${++i}`); extraParams.push(q.category_id); }
  if (q.from) { extraWhere.push(`expense_date >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`expense_date <= ?${++i}`); extraParams.push(q.to); }
  return pagedQuery<ExpenseRow>(
    {
      table: "expenses",
      searchColumns: ["description", "vendor"],
      orderBy: "expense_date DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Attendance ────────────────────────────────────────────────
export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_name: string | null;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
}

export async function pageAttendance(q: ListQuery & { employee_id?: string; from?: string; to?: string }): Promise<ListPage<AttendanceRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.employee_id) { extraWhere.push(`a.employee_id = ?${++i}`); extraParams.push(q.employee_id); }
  if (q.from) { extraWhere.push(`a.clock_in >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`a.clock_in <= ?${++i}`); extraParams.push(q.to); }
  return pagedQuery<AttendanceRow>(
    {
      baseSql:
        `SELECT a.id, a.employee_id, e.full_name AS employee_name,
                a.clock_in, a.clock_out, a.hours
         FROM attendance a LEFT JOIN employees e ON e.id = a.employee_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM attendance a LEFT JOIN employees e ON e.id = a.employee_id`,
      searchColumns: ["e.full_name"],
      orderBy: "a.clock_in DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Petty cash ────────────────────────────────────────────────
export interface PettyCashRow {
  id: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  entry_date: string;
  category: string | null;
}

export async function pagePettyCash(q: ListQuery & { direction?: "in" | "out" }): Promise<ListPage<PettyCashRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.direction) {
    extraWhere.push(`direction = ?${extraParams.length + 1}`);
    extraParams.push(q.direction);
  }
  return pagedQuery<PettyCashRow>(
    {
      baseSql:
        `SELECT p.*, COALESCE(u.full_name, u.username) AS user_name
         FROM petty_cash p LEFT JOIN users u ON u.id = p.user_id`,
      countSql: `SELECT COUNT(*) AS n FROM petty_cash p LEFT JOIN users u ON u.id = p.user_id`,
      searchColumns: ["p.description", "p.category", "u.full_name"],
      orderBy: "p.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Insurance claims ──────────────────────────────────────────
export interface ClaimRow {
  id: string;
  claim_number: string;
  provider_id: string | null;
  provider_name: string | null;
  patient_name: string | null;
  status: string;
  total_amount: number;
  created_at: string;
}

export async function pageClaims(q: ListQuery & { status?: string; provider_id?: string }): Promise<ListPage<ClaimRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.status) { extraWhere.push(`cl.status = ?${++i}`); extraParams.push(q.status); }
  if (q.provider_id) { extraWhere.push(`cl.provider_id = ?${++i}`); extraParams.push(q.provider_id); }
  return pagedQuery<ClaimRow>(
    {
      baseSql:
        `SELECT cl.*, p.name AS provider_name
         FROM insurance_claims cl LEFT JOIN insurance_providers p ON p.id = cl.provider_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM insurance_claims cl LEFT JOIN insurance_providers p ON p.id = cl.provider_id`,
      searchColumns: ["cl.claim_number", "cl.member_name", "p.name"],
      orderBy: "cl.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── eTIMS queue ───────────────────────────────────────────────
export interface EtimsQueueRow {
  id: string;
  sale_id: string;
  invoice_number: string | null;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

export async function pageEtimsQueue(q: ListQuery & { status?: string }): Promise<ListPage<EtimsQueueRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.status) {
    extraWhere.push(`status = ?${extraParams.length + 1}`);
    extraParams.push(q.status);
  }
  return pagedQuery<EtimsQueueRow>(
    {
      table: "etims_invoices",
      searchColumns: ["invoice_number", "sale_id"],
      orderBy: "created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Refills — active refillable prescriptions ─────────────────
export interface RefillRow {
  id: string;
  rx_number: number;
  patient_name: string;
  patient_phone: string | null;
  doctor_name: string | null;
  refills_authorized: number;
  refills_used: number;
  refills_remaining: number;
  last_dispensed: string;
  item_count: number;
}

export async function pageRefills(q: ListQuery): Promise<ListPage<RefillRow>> {
  return pagedQuery<RefillRow>(
    {
      baseSql:
        `SELECT
           p.id, p.rx_number, p.patient_name, p.patient_phone, p.doctor_name,
           p.refills_authorized, p.refills_used,
           (p.refills_authorized - p.refills_used) AS refills_remaining,
           p.created_at AS last_dispensed,
           (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = p.id) AS item_count
         FROM prescriptions p`,
      countSql: `SELECT COUNT(*) AS n FROM prescriptions p`,
      searchColumns: ["p.patient_name", "p.patient_phone", "CAST(p.rx_number AS TEXT)"],
      orderBy: "p.created_at DESC",
      extraWhere: ["p.refills_authorized > p.refills_used", "p.parent_prescription_id IS NULL"],
      extraParams: [],
    },
    q,
  );
}

// ─── Retail: Laybys ────────────────────────────────────────────
export interface LaybyRow {
  id: string;
  layby_number: string;
  customer_id: string | null;
  customer_name: string | null;
  total_amount: number;
  paid_amount: number;
  status: string;
  created_at: string;
}

export async function pageLaybys(q: ListQuery & { status?: string }): Promise<ListPage<LaybyRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.status) {
    extraWhere.push(`l.status = ?${extraParams.length + 1}`);
    extraParams.push(q.status);
  }
  return pagedQuery<LaybyRow>(
    {
      baseSql:
        `SELECT l.id, l.layby_number, l.customer_id, c.name AS customer_name,
                l.total_amount, l.paid_amount, l.status, l.created_at
         FROM retail_laybys l LEFT JOIN customers c ON c.id = l.customer_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM retail_laybys l LEFT JOIN customers c ON c.id = l.customer_id`,
      searchColumns: ["l.layby_number", "c.name"],
      orderBy: "l.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Retail: Special orders ────────────────────────────────────
export interface SpecialOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  created_at: string;
}

export async function pageSpecialOrders(q: ListQuery & { status?: string }): Promise<ListPage<SpecialOrderRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.status) {
    extraWhere.push(`o.status = ?${extraParams.length + 1}`);
    extraParams.push(q.status);
  }
  return pagedQuery<SpecialOrderRow>(
    {
      baseSql:
        `SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name,
                o.status, o.created_at
         FROM retail_special_orders o LEFT JOIN customers c ON c.id = o.customer_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM retail_special_orders o LEFT JOIN customers c ON c.id = o.customer_id`,
      searchColumns: ["o.order_number", "c.name"],
      orderBy: "o.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Retail: Shrinkage ─────────────────────────────────────────
export interface ShrinkageRow {
  id: string;
  product_name: string | null;
  quantity: number;
  reason: string;
  recorded_at: string;
}

export async function pageShrinkage(q: ListQuery & { from?: string; to?: string }): Promise<ListPage<ShrinkageRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`s.recorded_at >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`s.recorded_at <= ?${++i}`); extraParams.push(q.to); }
  return pagedQuery<ShrinkageRow>(
    {
      baseSql:
        `SELECT s.id, p.name AS product_name, s.quantity, s.reason, s.recorded_at
         FROM shrinkage s LEFT JOIN products p ON p.id = s.product_id`,
      countSql: `SELECT COUNT(*) AS n FROM shrinkage s LEFT JOIN products p ON p.id = s.product_id`,
      searchColumns: ["p.name", "s.reason"],
      orderBy: "s.recorded_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Stock transfers ───────────────────────────────────────────
export interface StockTransferRow {
  id: string;
  transfer_number: string;
  from_branch_name: string | null;
  to_branch_name: string | null;
  status: string;
  created_at: string;
}

export async function pageStockTransfers(q: ListQuery & { status?: string }): Promise<ListPage<StockTransferRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.status) {
    extraWhere.push(`t.status = ?${extraParams.length + 1}`);
    extraParams.push(q.status);
  }
  return pagedQuery<StockTransferRow>(
    {
      baseSql:
        `SELECT t.id, t.transfer_number, bf.name AS from_branch_name, bt.name AS to_branch_name,
                t.status, t.created_at
         FROM stock_transfers t
         LEFT JOIN branches bf ON bf.id = t.from_branch_id
         LEFT JOIN branches bt ON bt.id = t.to_branch_id`,
      countSql:
        `SELECT COUNT(*) AS n FROM stock_transfers t
         LEFT JOIN branches bf ON bf.id = t.from_branch_id
         LEFT JOIN branches bt ON bt.id = t.to_branch_id`,
      searchColumns: ["t.transfer_number", "bf.name", "bt.name"],
      orderBy: "t.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Wastage ───────────────────────────────────────────────────
export interface WastageRow {
  id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  reason: string;
  cost_value: number;
  recorded_at: string;
}

export async function pageWastage(q: ListQuery & { from?: string; to?: string; reason?: string }): Promise<ListPage<WastageRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`w.recorded_at >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`w.recorded_at <= ?${++i}`); extraParams.push(q.to); }
  if (q.reason) { extraWhere.push(`w.reason = ?${++i}`); extraParams.push(q.reason); }
  return pagedQuery<WastageRow>(
    {
      baseSql:
        `SELECT w.id, w.product_id, p.name AS product_name, w.quantity,
                w.reason, w.cost_value, w.recorded_at
         FROM hospitality_wastage w LEFT JOIN products p ON p.id = w.product_id`,
      countSql: `SELECT COUNT(*) AS n FROM hospitality_wastage w LEFT JOIN products p ON p.id = w.product_id`,
      searchColumns: ["p.name", "w.reason"],
      orderBy: "w.recorded_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Returns ───────────────────────────────────────────────────
export interface SaleReturnRow {
  id: string;
  return_number: string;
  sale_number: string | null;
  customer_name: string | null;
  refund_amount: number;
  refund_method: string;
  created_at: string;
}

export async function pageReturns(q: ListQuery & { from?: string; to?: string }): Promise<ListPage<SaleReturnRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`r.created_at >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`r.created_at <= ?${++i}`); extraParams.push(q.to); }
  return pagedQuery<SaleReturnRow>(
    {
      baseSql:
        `SELECT r.id, r.return_number, s.sale_number, c.name AS customer_name,
                r.refund_amount, r.refund_method, r.created_at
         FROM sale_returns r
         LEFT JOIN sales s ON s.id = r.sale_id
         LEFT JOIN customers c ON c.id = s.customer_id`,
      countSql: `SELECT COUNT(*) AS n FROM sale_returns r LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers c ON c.id = s.customer_id`,
      searchColumns: ["r.return_number", "s.sale_number", "c.name"],
      orderBy: "r.created_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Controlled register (pharmacy) ────────────────────────────
export interface ControlledLogRow {
  id: string;
  drug_name: string;
  patient_name: string | null;
  quantity: number;
  dispensed_at: string;
  dispenser_name: string | null;
}

export async function pageControlledLog(q: ListQuery & { from?: string; to?: string; drug?: string }): Promise<ListPage<ControlledLogRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`cl.dispensed_at >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`cl.dispensed_at <= ?${++i}`); extraParams.push(q.to); }
  if (q.drug) { extraWhere.push(`cl.drug_name LIKE ?${++i}`); extraParams.push(`%${q.drug}%`); }
  return pagedQuery<ControlledLogRow>(
    {
      table: "controlled_log cl",
      select: "cl.id, cl.drug_name, cl.patient_name, cl.quantity, cl.dispensed_at, cl.dispenser_name",
      searchColumns: ["cl.drug_name", "cl.patient_name"],
      orderBy: "cl.dispensed_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

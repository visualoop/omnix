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
import type { Customer, StockTake } from "@/services/erp";
import type { DhaEprescription } from "@/services/dha-eprescriptions";
import type { ExpiryItem, Prescription } from "@/services/pharmacy";
import type { DebitNote } from "@/services/debit-notes";
import type { FixedAsset } from "@/services/fixed-assets";
import { getActiveBranchId } from "@/stores/active-branch";

function addActiveBranch(
  where: string[],
  params: unknown[],
  column: string,
): void {
  const branchId = getActiveBranchId();
  if (!branchId) {
    where.push("1 = 0");
    return;
  }
  params.push(branchId);
  where.push(`${column} = ?${params.length}`);
}

// ─── Dawa operational lists ───────────────────────────────────
export async function pagePrescriptions(
  q: ListQuery & { status?: string; from?: string; to?: string },
): Promise<ListPage<Prescription>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.status) { extraWhere.push(`status = ?${extraParams.length + 1}`); extraParams.push(q.status); }
  if (q.from) { extraWhere.push(`created_at >= ?${extraParams.length + 1}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`created_at <= ?${extraParams.length + 1}`); extraParams.push(`${q.to}T23:59:59`); }
  return pagedQuery<Prescription>({
    table: "prescriptions",
    searchColumns: ["patient_name", "patient_phone", "CAST(rx_number AS TEXT)"],
    orderBy: "created_at DESC",
    extraWhere,
    extraParams,
  }, q);
}

export interface PatientListRow {
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  allergy_count: number;
  prescription_count: number;
  last_visit: string | null;
}

export async function pagePatients(q: ListQuery): Promise<ListPage<PatientListRow>> {
  return pagedQuery<PatientListRow>({
    baseSql: `SELECT c.id AS customer_id, c.name, c.phone, c.email,
                    pp.date_of_birth, pp.gender,
                    (SELECT COUNT(*) FROM patient_allergies a WHERE a.customer_id = c.id) AS allergy_count,
                    (SELECT COUNT(*) FROM prescriptions r
                      WHERE r.customer_id = c.id OR (r.customer_id IS NULL AND r.patient_name = c.name)) AS prescription_count,
                    (SELECT MAX(r.created_at) FROM prescriptions r
                      WHERE r.customer_id = c.id OR (r.customer_id IS NULL AND r.patient_name = c.name)) AS last_visit
               FROM customers c
               INNER JOIN patient_profiles pp ON pp.customer_id = c.id`,
    countSql: `SELECT COUNT(DISTINCT c.id) AS n
                 FROM customers c
                 INNER JOIN patient_profiles pp ON pp.customer_id = c.id`,
    searchColumns: ["c.name", "c.phone", "c.email"],
    orderBy: "c.name ASC",
    extraWhere: [],
    extraParams: [],
  }, q).then((page) => page);
}

export async function pageExpiryItems(
  q: ListQuery & { daysWindow: number },
): Promise<ListPage<ExpiryItem>> {
  return pagedQuery<ExpiryItem>({
    baseSql: `SELECT p.id AS product_id, p.name AS product_name,
                    b.id AS batch_id, COALESCE(b.batch_number, '—') AS batch_number,
                    b.quantity, b.expiry_date,
                    CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry,
                    COALESCE(pp.is_controlled, 0) AS is_controlled
               FROM batches b
               JOIN products p ON p.id = b.product_id
               LEFT JOIN pharmacy_products pp ON pp.product_id = p.id`,
    countSql: `SELECT COUNT(*) AS n FROM batches b
                 JOIN products p ON p.id = b.product_id
                 LEFT JOIN pharmacy_products pp ON pp.product_id = p.id`,
    searchColumns: ["p.name", "b.batch_number"],
    orderBy: "b.expiry_date ASC",
    extraWhere: ["b.expiry_date IS NOT NULL", "b.quantity > 0", "julianday(b.expiry_date) - julianday('now') <= ?1"],
    extraParams: [q.daysWindow],
  }, q);
}

export interface ControlledRegisterRow {
  id: string;
  product_id: string;
  product_name: string;
  action: string;
  quantity: number;
  patient_name: string | null;
  patient_id_number: string | null;
  prescribed_by: string | null;
  prescription_number: string | null;
  balance_after: number;
  notes: string | null;
  pharmacist_id: string | null;
  pharmacist_name: string | null;
  pharmacist_license: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
}

export async function pageControlledRegister(
  q: ListQuery & { date: string },
): Promise<ListPage<ControlledRegisterRow>> {
  return pagedQuery<ControlledRegisterRow>({
    baseSql: `SELECT cl.*, u.full_name AS user_name,
                    p.full_name AS pharmacist_name,
                    p.pharmacist_license_number AS pharmacist_license
               FROM controlled_log cl
               LEFT JOIN users u ON u.id = cl.user_id
               LEFT JOIN employees p ON p.id = cl.pharmacist_id`,
    countSql: `SELECT COUNT(*) AS n FROM controlled_log cl
                 LEFT JOIN users u ON u.id = cl.user_id
                 LEFT JOIN employees p ON p.id = cl.pharmacist_id`,
    searchColumns: ["cl.product_name", "cl.patient_name", "cl.prescribed_by", "cl.prescription_number", "p.full_name"],
    orderBy: "cl.created_at ASC",
    extraWhere: ["date(cl.created_at) = ?1"],
    extraParams: [q.date],
  }, q);
}

// ─── Customers ─────────────────────────────────────────────────
export async function pageCustomers(q: ListQuery): Promise<ListPage<Customer>> {
  return pagedQuery<Customer>(
    {
      table: "customers",
      searchColumns: ["name", "phone", "email"],
      orderBy: "name",
      extraWhere: ["active = 1"],
      extraParams: [],
    },
    q,
  );
}

// ─── DHA e-prescriptions ───────────────────────────────────────
export async function pageEprescriptions(q: ListQuery): Promise<ListPage<DhaEprescription>> {
  return pagedQuery<DhaEprescription>(
    {
      table: "dha_eprescriptions",
      searchColumns: ["patient_name", "prescriber_name", "dha_id"],
      orderBy: "issued_at DESC",
      extraWhere: [],
      extraParams: [],
    },
    q,
  );
}

// ─── Debit notes ───────────────────────────────────────────────
export async function pageDebitNotes(q: ListQuery): Promise<ListPage<DebitNote>> {
  return pagedQuery<DebitNote>(
    {
      table: "debit_notes",
      searchColumns: ["note_number"],
      orderBy: "issue_date DESC",
      extraWhere: [],
      extraParams: [],
    },
    q,
  );
}

// ─── Stock takes ───────────────────────────────────────────────
export async function pageStockTakes(q: ListQuery): Promise<ListPage<StockTake>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  addActiveBranch(extraWhere, extraParams, "st.branch_id");
  return pagedQuery<StockTake>(
    {
      baseSql: `SELECT st.*, u.full_name as user_name,
                  (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = st.id) AS item_count
                FROM stock_takes st LEFT JOIN users u ON u.id = st.user_id`,
      countSql: `SELECT COUNT(*) AS n FROM stock_takes st`,
      searchColumns: ["st.reference", "st.notes"],
      orderBy: "st.started_at DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

// ─── Fixed assets ──────────────────────────────────────────────
export async function pageFixedAssets(q: ListQuery): Promise<ListPage<FixedAsset>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  addActiveBranch(extraWhere, extraParams, "branch_id");
  return pagedQuery<FixedAsset>(
    {
      table: "fixed_assets",
      searchColumns: ["asset_code", "name", "category"],
      orderBy: "acquired_date DESC",
      extraWhere,
      extraParams,
    },
    q,
  );
}

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
  addActiveBranch(extraWhere, extraParams, "branch_id");
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
  addActiveBranch(extraWhere, extraParams, "s.branch_id");
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
// Unified audit feed backed by the audit_log_unified VIEW (migration 074).
// The view UNIONs permission events, license activations, and sale/void
// events into a common shape so this page can paginate the merged feed.
export interface AuditRow {
  id: string;
  kind: "permission" | "license" | "sale" | "void";
  event: string;
  description: string;
  user: string | null;
  metadata: string | null;
  created_at: string;
}

export async function pageAuditLog(q: ListQuery & { kind?: string }): Promise<ListPage<AuditRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  if (q.kind) {
    extraWhere.push(`kind = ?${extraParams.length + 1}`);
    extraParams.push(q.kind);
  }
  return pagedQuery<AuditRow>(
    {
      table: "audit_log_unified",
      searchColumns: ["description", "user", "event"],
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
  addActiveBranch(extraWhere, extraParams, "po.branch_id");
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
  addActiveBranch(extraWhere, extraParams, "branch_id");
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
  addActiveBranch(extraWhere, extraParams, "a.branch_id");
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
  addActiveBranch(extraWhere, extraParams, "p.branch_id");
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
  addActiveBranch(extraWhere, extraParams, "l.branch_id");
  return pagedQuery<LaybyRow>(
    {
      baseSql:
        `SELECT l.*, c.name AS customer_name,
                COALESCE(l.customer_phone, c.phone) AS customer_phone
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
  addActiveBranch(extraWhere, extraParams, "o.branch_id");
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
  incident_date: string;
}

export async function pageShrinkage(q: ListQuery & { from?: string; to?: string; reason?: string }): Promise<ListPage<ShrinkageRow>> {
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let i = 0;
  if (q.from) { extraWhere.push(`s.incident_date >= ?${++i}`); extraParams.push(q.from); }
  if (q.to) { extraWhere.push(`s.incident_date <= ?${++i}`); extraParams.push(q.to); }
  if (q.reason) { extraWhere.push(`s.reason = ?${++i}`); extraParams.push(q.reason); }
  addActiveBranch(extraWhere, extraParams, "s.branch_id");
  return pagedQuery<ShrinkageRow>(
    {
      baseSql:
        `SELECT s.*, p.name AS product_name, v.variant_name, u.full_name AS user_name
         FROM shrinkage s
         JOIN products p ON p.id = s.product_id
         LEFT JOIN product_variants v ON v.id = s.variant_id
         JOIN users u ON u.id = s.user_id`,
      countSql: `SELECT COUNT(*) AS n FROM shrinkage s
         JOIN products p ON p.id = s.product_id
         LEFT JOIN product_variants v ON v.id = s.variant_id
         JOIN users u ON u.id = s.user_id`,
      searchColumns: ["p.name", "v.variant_name", "s.reason", "s.notes"],
      orderBy: "s.incident_date DESC, s.created_at DESC",
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
  const branchId = getActiveBranchId();
  if (branchId) {
    extraParams.push(branchId, branchId);
    extraWhere.push(`(t.from_branch_id = ?${extraParams.length - 1} OR t.to_branch_id = ?${extraParams.length})`);
  } else {
    extraWhere.push("1 = 0");
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
  addActiveBranch(extraWhere, extraParams, "w.branch_id");
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
  addActiveBranch(extraWhere, extraParams, "r.branch_id");
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

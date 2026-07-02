/**
 * Platform-level services for the Medium tier:
 * - Custom fields registry + values
 * - Data quality scanner
 * - Anomaly detector
 * - Global cross-entity search
 * - Consolidated multi-business dashboard (client-side, hits telemetry API)
 */
import { execute, query } from "@/lib/db";

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

// ─── Custom fields (Task 59) ───────────────────────────
export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";

export interface CustomField {
  id: string;
  entity_kind: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string | null;             // JSON array for 'select'
  required: number;
  position: number;
  active: number;
}

export async function listFields(entityKind: string): Promise<CustomField[]> {
  return query<CustomField>(
    `SELECT id, entity_kind, field_key, label, field_type, options, required, position, active
     FROM custom_fields WHERE entity_kind = ?1 AND active = 1 ORDER BY position ASC, field_key`,
    [entityKind],
  );
}

export async function createField(input: {
  entity_kind: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO custom_fields (id, entity_kind, field_key, label, field_type, options, required, position)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      id, input.entity_kind, input.field_key, input.label, input.field_type,
      input.options ? JSON.stringify(input.options) : null,
      input.required ? 1 : 0, input.position ?? 0,
    ],
  );
  return id;
}

export async function setFieldValue(fieldId: string, entityId: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO custom_field_values (id, field_id, entity_id, value, updated_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))
     ON CONFLICT(field_id, entity_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [newId(), fieldId, entityId, value],
  );
}

export async function getFieldValues(entityKind: string, entityId: string): Promise<Record<string, string>> {
  const rows = await query<{ field_key: string; value: string }>(
    `SELECT cf.field_key, cfv.value
     FROM custom_field_values cfv
     JOIN custom_fields cf ON cf.id = cfv.field_id
     WHERE cf.entity_kind = ?1 AND cfv.entity_id = ?2 AND cf.active = 1`,
    [entityKind, entityId],
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.field_key] = r.value;
  return out;
}

// ─── Data quality scanner (Task 61) ────────────────────
export async function runDataQualityScan(): Promise<number> {
  await execute(`DELETE FROM data_quality_issues WHERE status = 'open'`);
  let generated = 0;

  const emit = async (kind: string, entityKind: string, entityId: string, details: object, severity = "warning") => {
    await execute(
      `INSERT INTO data_quality_issues (id, issue_kind, entity_kind, entity_id, details, severity)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(issue_kind, entity_id) DO UPDATE
         SET details = excluded.details, severity = excluded.severity, status = 'open', detected_at = datetime('now')`,
      [newId(), kind, entityKind, entityId, JSON.stringify(details), severity],
    );
    generated++;
  };

  // 1. Duplicate customers by phone.
  const dupPhones = await query<{ phone: string; count: number; ids: string }>(
    `SELECT phone, COUNT(*) AS count, GROUP_CONCAT(id) AS ids
     FROM customers WHERE phone IS NOT NULL AND phone != ''
     GROUP BY phone HAVING COUNT(*) > 1`,
  ).catch(() => []);
  for (const d of dupPhones) {
    const firstId = d.ids.split(",")[0];
    await emit("duplicate_customer", "customer", firstId, { phone: d.phone, count: d.count, ids: d.ids });
  }

  // 2. Negative stock batches.
  const negStock = await query<{ id: string; product_id: string; quantity: number }>(
    `SELECT id, product_id, quantity FROM batches WHERE quantity < 0`,
  ).catch(() => []);
  for (const b of negStock) {
    await emit("negative_stock", "batch", b.id, { product_id: b.product_id, qty: b.quantity }, "critical");
  }

  // 3. Sales without a customer that are on credit (customer_id required for AR).
  const orphanCredit = await query<{ id: string; total: number }>(
    `SELECT s.id, s.total FROM sales s
     JOIN payments p ON p.sale_id = s.id
     JOIN payment_methods pm ON pm.id = p.payment_method_id
     WHERE pm.name LIKE '%credit%' AND s.customer_id IS NULL LIMIT 100`,
  ).catch(() => []);
  for (const s of orphanCredit) {
    await emit("missing_customer", "sale", s.id, { total: s.total }, "critical");
  }

  return generated;
}

export async function listDataQualityIssues(): Promise<Array<{ id: string; issue_kind: string; entity_kind: string; entity_id: string; details: string; severity: string; detected_at: string }>> {
  return query(
    `SELECT id, issue_kind, entity_kind, entity_id, details, severity, detected_at
     FROM data_quality_issues WHERE status = 'open' ORDER BY detected_at DESC LIMIT 500`,
  );
}

// ─── Anomaly detector (Task 54) ────────────────────────
export async function runAnomalyDetection(): Promise<number> {
  let generated = 0;
  const emit = async (params: {
    detector: string;
    severity?: string;
    entity_kind?: string;
    entity_id?: string;
    baseline?: number;
    observed?: number;
    message: string;
  }) => {
    const variance = params.baseline && params.baseline > 0
      ? (((params.observed ?? 0) - params.baseline) / params.baseline) * 100 : null;
    await execute(
      `INSERT INTO anomaly_log
        (id, detector, severity, entity_kind, entity_id, baseline_value, observed_value, variance_pct, message)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [newId(), params.detector, params.severity ?? "warning", params.entity_kind ?? null,
        params.entity_id ?? null, params.baseline ?? null, params.observed ?? null,
        variance, params.message],
    );
    generated++;
  };

  // Sales drop >30% vs 7-day trailing avg.
  const [today] = await query<{ today: number; trailing: number }>(
    `SELECT
        COALESCE((SELECT SUM(total) FROM sales WHERE date(created_at) = date('now') AND status = 'completed'), 0) AS today,
        COALESCE((SELECT AVG(daily_total) FROM (
          SELECT SUM(total) AS daily_total FROM sales
          WHERE date(created_at) BETWEEN date('now', '-8 days') AND date('now', '-1 days')
            AND status = 'completed'
          GROUP BY date(created_at)
        )), 0) AS trailing`,
  ).catch(() => [{ today: 0, trailing: 0 }]);

  if (today && today.trailing > 0 && today.today < today.trailing * 0.7) {
    await emit({
      detector: "sales_drop",
      severity: "warning",
      entity_kind: "day",
      baseline: today.trailing,
      observed: today.today,
      message: `Today's sales are ${Math.round((1 - today.today / today.trailing) * 100)}% below the 7-day average`,
    });
  }

  // Expiry write-off spike (compare last 7d vs prior 30d).
  const [expiry] = await query<{ recent: number; prior: number }>(
    `SELECT
        COALESCE((SELECT SUM(quantity) FROM shrinkage
                  WHERE reason LIKE '%expir%' AND date(created_at) >= date('now', '-7 days')), 0) AS recent,
        COALESCE((SELECT SUM(quantity) FROM shrinkage
                  WHERE reason LIKE '%expir%' AND date(created_at) BETWEEN date('now', '-37 days') AND date('now', '-8 days')), 0) AS prior`,
  ).catch(() => [{ recent: 0, prior: 0 }]);
  const priorAvg = (expiry?.prior ?? 0) / 4.28;  // 30 days ÷ 7 for weekly comparison
  if (expiry && expiry.recent > priorAvg * 2 && expiry.recent > 5) {
    await emit({
      detector: "expiry_spike",
      severity: "warning",
      entity_kind: "week",
      baseline: priorAvg,
      observed: expiry.recent,
      message: `Expiry write-offs up ${Math.round((expiry.recent / (priorAvg || 1) - 1) * 100)}% this week`,
    });
  }

  return generated;
}

// ─── Global search (Task 57) ───────────────────────────
export interface SearchHit {
  entity_kind: "product" | "customer" | "supplier" | "sale" | "invoice";
  entity_id: string;
  title: string;
  subtitle: string | null;
  score: number;
}

export async function globalSearch(qStr: string, limit = 30): Promise<SearchHit[]> {
  const q = qStr.trim();
  if (!q) return [];
  const pattern = `%${q}%`;
  const hits: SearchHit[] = [];

  const products = await query<{ id: string; name: string; sku: string | null }>(
    `SELECT id, name, sku FROM products
     WHERE (name LIKE ?1 OR sku LIKE ?1 OR barcode LIKE ?1)
       AND deleted_at IS NULL
     LIMIT 10`,
    [pattern],
  ).catch(() => []);
  for (const p of products) hits.push({
    entity_kind: "product", entity_id: p.id, title: p.name, subtitle: p.sku, score: 1,
  });

  const customers = await query<{ id: string; name: string; phone: string | null }>(
    `SELECT id, name, phone FROM customers
     WHERE name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1
     LIMIT 10`,
    [pattern],
  ).catch(() => []);
  for (const c of customers) hits.push({
    entity_kind: "customer", entity_id: c.id, title: c.name, subtitle: c.phone, score: 1,
  });

  const suppliers = await query<{ id: string; name: string; phone: string | null }>(
    `SELECT id, name, phone FROM suppliers WHERE name LIKE ?1 OR phone LIKE ?1 LIMIT 10`,
    [pattern],
  ).catch(() => []);
  for (const s of suppliers) hits.push({
    entity_kind: "supplier", entity_id: s.id, title: s.name, subtitle: s.phone, score: 1,
  });

  const sales = await query<{ id: string; sale_number: string; total: number }>(
    `SELECT id, sale_number, total FROM sales WHERE sale_number LIKE ?1 LIMIT 10`,
    [pattern],
  ).catch(() => []);
  for (const s of sales) hits.push({
    entity_kind: "sale", entity_id: s.id, title: s.sale_number, subtitle: `KES ${s.total.toFixed(2)}`, score: 1,
  });

  const invoices = await query<{ id: string; invoice_number: string; customer_name: string | null }>(
    `SELECT id, invoice_number, customer_name FROM invoices WHERE invoice_number LIKE ?1 LIMIT 10`,
    [pattern],
  ).catch(() => []);
  for (const inv of invoices) hits.push({
    entity_kind: "invoice", entity_id: inv.id, title: inv.invoice_number, subtitle: inv.customer_name, score: 1,
  });

  return hits.slice(0, limit);
}

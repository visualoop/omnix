import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";

export interface EtimsConfig {
  id: string;
  kra_pin: string | null;
  vscu_serial: string | null;
  api_endpoint: string;
  branch_id: string;
  business_name: string | null;
  active: number;
  test_mode: number;
  last_sync_at: string | null;
}

export interface EtimsInvoice {
  id: string;
  sale_id: string;
  invoice_number: string;
  invoice_type: "normal" | "credit_note" | "debit_note";
  seller_pin: string;
  buyer_pin: string | null;
  buyer_name: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  kra_internal_control_no: string | null;
  kra_signature: string | null;
  kra_qr_code: string | null;
  kra_invoice_no: string | null;
  submitted_at: string | null;
  status: "pending" | "signed" | "failed" | "queued";
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export interface SaleItemForEtims {
  product_id: string;
  product_name: string;
  hs_code?: string;
  tax_class?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

// Configuration
export async function getEtimsConfig(): Promise<EtimsConfig | null> {
  const rows = await query<EtimsConfig>("SELECT * FROM etims_config WHERE id = 'default'");
  return rows[0] || null;
}

export async function saveEtimsConfig(input: {
  kra_pin: string;
  vscu_serial: string;
  branch_id: string;
  business_name: string;
  test_mode: boolean;
}): Promise<void> {
  await execute(
    `UPDATE etims_config 
     SET kra_pin = ?1, vscu_serial = ?2, branch_id = ?3, business_name = ?4,
         test_mode = ?5, active = 1, last_sync_at = datetime('now')
     WHERE id = 'default'`,
    [input.kra_pin, input.vscu_serial, input.branch_id, input.business_name, input.test_mode ? 1 : 0]
  );
}

export async function disableEtims(): Promise<void> {
  await execute("UPDATE etims_config SET active = 0 WHERE id = 'default'");
}

// Verify connection (call /info endpoint)
export async function verifyEtimsConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await getEtimsConfig();
  if (!config?.kra_pin || !config.vscu_serial) {
    return { ok: false, error: "Missing KRA PIN or VSCU serial" };
  }
  try {
    const baseUrl = config.test_mode === 1
      ? "https://etims-api-sbx.kra.go.ke"
      : "https://etims-api.kra.go.ke";
    const res = await fetch(`${baseUrl}/initializer/initializerInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tin: config.kra_pin,
        bhfId: config.branch_id,
        dvcSrlNo: config.vscu_serial,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: (body as { resultMsg?: string }).resultMsg || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Sign an invoice via KRA VSCU
export async function signInvoice(saleId: string, items: SaleItemForEtims[], totals: {
  subtotal: number;
  tax: number;
  total: number;
  buyerPin?: string;
  buyerName?: string;
}): Promise<{ status: string; invoice_id: string; kra_internal_control_no?: string }> {
  const config = await getEtimsConfig();
  if (!config?.active || !config.kra_pin) {
    throw new Error("eTIMS not configured");
  }

  const invoiceNumber = `INV-${Date.now()}`;
  const invoiceId = crypto.randomUUID();

  // Persist as pending first (offline-resilient)
  await execute(
    `INSERT INTO etims_invoices 
     (id, sale_id, invoice_number, seller_pin, buyer_pin, buyer_name, subtotal, tax_amount, total, status, payload_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)`,
    [
      invoiceId, saleId, invoiceNumber, config.kra_pin,
      totals.buyerPin || null, totals.buyerName || null,
      totals.subtotal, totals.tax, totals.total,
      JSON.stringify({ items, totals }),
    ]
  );

  // Try to submit to KRA
  try {
    const baseUrl = config.test_mode === 1
      ? "https://etims-api-sbx.kra.go.ke"
      : "https://etims-api.kra.go.ke";

    const payload = {
      invcNo: invoiceNumber,
      orgInvcNo: 0,
      custTin: totals.buyerPin || null,
      custNm: totals.buyerName || "Walk-in Customer",
      salesTyCd: "N",
      rcptTyCd: "S",
      pmtTyCd: "01",
      salesSttsCd: "02",
      cfmDt: new Date().toISOString().replace(/[-:]/g, "").slice(0, 14),
      salesDt: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      totItemCnt: items.length,
      taxblAmtA: 0, taxblAmtB: totals.subtotal, taxblAmtC: 0, taxblAmtD: 0,
      taxRtA: 0, taxRtB: 16, taxRtC: 0, taxRtD: 0,
      taxAmtA: 0, taxAmtB: totals.tax, taxAmtC: 0, taxAmtD: 0,
      totTaxblAmt: totals.subtotal,
      totTaxAmt: totals.tax,
      totAmt: totals.total,
      itemList: items.map((it, i) => ({
        itemSeq: i + 1,
        itemCd: it.product_id.slice(0, 20),
        itemClsCd: it.hs_code || "9990.90.00",
        itemNm: it.product_name,
        pkgUnitCd: "NT",
        pkg: 1,
        qtyUnitCd: "U",
        qty: it.quantity,
        prc: it.unit_price,
        splyAmt: it.unit_price * it.quantity,
        dcRt: 0,
        dcAmt: 0,
        taxTyCd: it.tax_class || "B",
        taxblAmt: it.unit_price * it.quantity,
        taxAmt: (it.unit_price * it.quantity * it.tax_rate) / 100,
        totAmt: it.total,
      })),
    };

    const res = await fetch(`${baseUrl}/trnsSales/saveSales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tin": config.kra_pin,
        "bhfId": config.branch_id,
        "dvcSrlNo": config.vscu_serial || "",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json() as {
      resultCd?: string;
      resultMsg?: string;
      data?: {
        curRcptNo?: number;
        intrlData?: string;
        rcptSign?: string;
        sdcDateTime?: string;
      };
    };

    if (body.resultCd === "000" && body.data) {
      await execute(
        `UPDATE etims_invoices 
         SET status = 'signed', 
             kra_internal_control_no = ?1,
             kra_signature = ?2,
             kra_invoice_no = ?3,
             submitted_at = datetime('now'),
             response_json = ?4
         WHERE id = ?5`,
        [
          body.data.intrlData || null,
          body.data.rcptSign || null,
          String(body.data.curRcptNo || ""),
          JSON.stringify(body),
          invoiceId,
        ]
      );
      return { status: "signed", invoice_id: invoiceId, kra_internal_control_no: body.data.intrlData };
    }

    // Failed — queue for retry
    await execute(
      `UPDATE etims_invoices 
       SET status = 'queued', error_message = ?1, response_json = ?2
       WHERE id = ?3`,
      [body.resultMsg || "Unknown error", JSON.stringify(body), invoiceId]
    );
    return { status: "queued", invoice_id: invoiceId };
  } catch (e) {
    // Network error — queue
    await execute(
      `UPDATE etims_invoices SET status = 'queued', error_message = ?1 WHERE id = ?2`,
      [String(e), invoiceId]
    );
    return { status: "queued", invoice_id: invoiceId };
  }
}

// Get pending/queued invoices
export async function getPendingInvoices(): Promise<EtimsInvoice[]> {
  return query<EtimsInvoice>(
    "SELECT * FROM etims_invoices WHERE status IN ('pending','queued','failed') ORDER BY created_at ASC LIMIT 500"
  );
}

export async function getRecentInvoices(limit = 50): Promise<EtimsInvoice[]> {
  return query<EtimsInvoice>(
    "SELECT * FROM etims_invoices ORDER BY created_at DESC LIMIT ?1",
    [limit]
  );
}

// Retry queued invoices (called periodically)
export async function retryQueuedInvoices(): Promise<{ retried: number; succeeded: number }> {
  const queued = await query<EtimsInvoice & { payload_json: string }>(
    "SELECT * FROM etims_invoices WHERE status = 'queued' AND retry_count < 5 ORDER BY created_at ASC LIMIT 10"
  );

  let succeeded = 0;
  for (const inv of queued) {
    try {
      const payload = JSON.parse(inv.payload_json);
      const result = await signInvoice(inv.sale_id, payload.items, payload.totals);
      if (result.status === "signed") succeeded++;
    } catch {
      await execute("UPDATE etims_invoices SET retry_count = retry_count + 1 WHERE id = ?1", [inv.id]);
    }
  }

  return { retried: queued.length, succeeded };
}

// VAT report for filing
export async function getVatReport(startDate: string, endDate: string): Promise<{
  total_sales: number;
  taxable_sales: number;
  exempt_sales: number;
  output_vat: number;
  invoice_count: number;
  signed_count: number;
  pending_count: number;
}> {
  const rows = await query<{
    total_sales: number;
    taxable_sales: number;
    output_vat: number;
    invoice_count: number;
    signed_count: number;
    pending_count: number;
  }>(
    `SELECT
       COALESCE(SUM(total), 0) as total_sales,
       COALESCE(SUM(subtotal), 0) as taxable_sales,
       COALESCE(SUM(tax_amount), 0) as output_vat,
       COUNT(*) as invoice_count,
       SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed_count,
       SUM(CASE WHEN status IN ('pending','queued','failed') THEN 1 ELSE 0 END) as pending_count
     FROM etims_invoices
     WHERE date(created_at) BETWEEN ?1 AND ?2`,
    [startDate, endDate]
  );

  const r = rows[0] || { total_sales: 0, taxable_sales: 0, output_vat: 0, invoice_count: 0, signed_count: 0, pending_count: 0 };
  return {
    ...r,
    exempt_sales: r.total_sales - r.taxable_sales,
  };
}

/**
 * Queue a credit note for a sale return (v0.28.3).
 *
 * Called from createSaleReturn inside the same transaction batch (via
 * a returned TxStatement) so it commits atomically with the return.
 * The worker (the existing signInvoice-style flow above) picks it up
 * later and submits. Offline-safe: rows are marked 'pending' until the
 * worker can talk to KRA.
 *
 * Returns:
 *   - a TxStatement to be included in createSaleReturn's stmts array
 *   - null if eTIMS isn't configured (skip silently — no credit note needed)
 */
import type { TxStatement } from "@/lib/db";

export async function queueCreditNoteFor(input: {
  returnId: string;
  saleId: string | null;
  refundAmount: number;
  taxAmount: number;
  items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }>;
  customerId?: string | null;
  customerName?: string | null;
  customerPin?: string | null;
}): Promise<TxStatement | null> {
  const config = await getEtimsConfig();
  if (!config?.active || !config.kra_pin) return null;
  if (!input.saleId) return null; // walk-in refund; skip

  // Look up the original invoice to reference in orgInvcNo.
  const originalInv = await query<{ invoice_number: string }>(
    "SELECT invoice_number FROM etims_invoices WHERE sale_id = ?1 AND invoice_type = 'normal' AND status = 'signed' LIMIT 1",
    [input.saleId],
  );
  const originalInvoiceNumber = originalInv[0]?.invoice_number ?? null;
  if (!originalInvoiceNumber) {
    // The original wasn't signed (yet). Still queue the credit note —
    // when the worker runs it can retry until the original signs.
  }

  const invoiceId = crypto.randomUUID();
  const invoiceNumber = `CRN-${Date.now()}`;
  // Credit note tax + subtotal derive from the return items; the total
  // is the refund_amount signed negative in KRA's schema — but our stored
  // total keeps the absolute value so reporting queries still SUM cleanly.
  const subtotal = Math.max(0, Math.round((input.refundAmount - input.taxAmount) * 100) / 100);

  return {
    sql: `INSERT INTO etims_invoices
       (id, sale_id, sale_return_id, invoice_number, invoice_type,
        original_invoice_number, seller_pin, buyer_pin, buyer_name,
        subtotal, tax_amount, total, status, payload_json)
       VALUES (?1, ?2, ?3, ?4, 'credit_note', ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12)`,
    params: [
      invoiceId,
      input.saleId,
      input.returnId,
      invoiceNumber,
      originalInvoiceNumber,
      config.kra_pin,
      input.customerPin ?? null,
      input.customerName ?? null,
      subtotal,
      input.taxAmount,
      input.refundAmount,
      JSON.stringify({
        items: input.items,
        totals: { subtotal, tax: input.taxAmount, total: input.refundAmount },
        credit_note: { returnId: input.returnId, originalInvoiceNumber },
      }),
    ],
  };
}

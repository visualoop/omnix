/**
 * service-v51.spec.ts — Equipment DMS Phase 2 (workshop).
 *
 * Status-transition rules, total recompute, warranty auto-detect on job
 * creation, parts stock-consume statement building + short-stock guard,
 * labour math, and invoice guards — with the DB + collaborators mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
const execute = vi.fn();
const transaction = vi.fn();
const createInvoice = vi.fn();
const warrantyState = vi.fn();

vi.mock("@/lib/db", () => ({
  query: (...a: unknown[]) => query(...a),
  execute: (...a: unknown[]) => execute(...a),
  transaction: (...a: unknown[]) => transaction(...a),
}));
vi.mock("@/services/license", () => ({ assertModuleEntitled: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/services/rbac", () => ({ requirePermission: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/stores/active-branch", () => ({ getActiveBranchId: () => "" }));
vi.mock("@/services/equipment", () => ({ warrantyState: (...a: unknown[]) => warrantyState(...a) }));
vi.mock("@/services/invoicing", () => ({ createInvoice: (...a: unknown[]) => createInvoice(...a) }));

import {
  canTransitionJob, recomputeTotals, createServiceJob,
  addPart, addLabour, invoiceJob,
} from "@/services/service";

beforeEach(() => {
  query.mockReset();
  execute.mockReset();
  transaction.mockReset();
  createInvoice.mockReset();
  warrantyState.mockReset();
});

describe("canTransitionJob", () => {
  it("allows the normal workflow", () => {
    expect(canTransitionJob("open", "in_progress")).toBe(true);
    expect(canTransitionJob("in_progress", "completed")).toBe(true);
    expect(canTransitionJob("awaiting_parts", "in_progress")).toBe(true);
    expect(canTransitionJob("completed", "invoiced")).toBe(true);
    expect(canTransitionJob("open", "open")).toBe(true);
  });
  it("blocks terminal + illegal moves", () => {
    expect(canTransitionJob("cancelled", "in_progress")).toBe(false);
    expect(canTransitionJob("invoiced", "in_progress")).toBe(false);
    expect(canTransitionJob("open", "invoiced")).toBe(false);
  });
});

describe("recomputeTotals", () => {
  it("sums parts + labour and persists them", async () => {
    query
      .mockResolvedValueOnce([{ t: 250 }])   // parts sum
      .mockResolvedValueOnce([{ t: 400 }]);  // labour sum
    execute.mockResolvedValue(undefined);
    const res = await recomputeTotals("job1");
    expect(res).toEqual({ parts: 250, labour: 400 });
    const params = execute.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe(250);
    expect(params[2]).toBe(400);
  });
});

describe("createServiceJob", () => {
  it("auto-detects warranty from the unit and flips it to in_service", async () => {
    warrantyState.mockReturnValue("active");
    query
      .mockResolvedValueOnce([{ status: "sold", warranty_expiry: "2030-01-01", customer_id: "c1" }]) // unit
      .mockResolvedValueOnce([{ n: "4" }]);                                                          // nextJobNumber
    transaction.mockResolvedValueOnce(undefined);
    const res = await createServiceJob({ unit_id: "u1", reported_fault: "won't start" });
    expect(res.job_number).toMatch(/^SJ-\d{4}-00005$/);
    const stmts = transaction.mock.calls[0][0] as { params: unknown[] }[];
    expect(stmts).toHaveLength(2);
    // is_warranty flag is params[5] of the job insert
    expect(stmts[0].params[5]).toBe(1);
    // second statement flips the unit into service
    expect(stmts[1].sql).toMatch(/in_service/);
  });

  it("respects an explicit non-warranty override", async () => {
    warrantyState.mockReturnValue("active");
    query
      .mockResolvedValueOnce([{ status: "sold", warranty_expiry: "2030-01-01", customer_id: null }])
      .mockResolvedValueOnce([{ n: "0" }]);
    transaction.mockResolvedValueOnce(undefined);
    await createServiceJob({ unit_id: "u1", is_warranty: false });
    const stmts = transaction.mock.calls[0][0] as { params: unknown[] }[];
    expect(stmts[0].params[5]).toBe(0);
  });

  it("refuses a written-off unit", async () => {
    query.mockResolvedValueOnce([{ status: "written_off", warranty_expiry: null, customer_id: null }]);
    await expect(createServiceJob({ unit_id: "u1" })).rejects.toThrow(/written off/i);
  });
});

describe("addPart", () => {
  it("throws when stock is short (nothing written)", async () => {
    query
      .mockResolvedValueOnce([{ name: "Oil filter", selling_price: 100 }]) // product
      .mockResolvedValueOnce([{ id: "b1", quantity: 1, buying_price: 40 }]); // batches (only 1)
    await expect(addPart("job1", { product_id: "p1", quantity: 3 })).rejects.toThrow(/Not enough stock/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("consumes stock FEFO + records the part in one transaction", async () => {
    query
      .mockResolvedValueOnce([{ name: "Oil filter", selling_price: 100 }])
      .mockResolvedValueOnce([{ id: "b1", quantity: 5, buying_price: 40 }])
      // recomputeTotals afterwards:
      .mockResolvedValueOnce([{ t: 200 }])
      .mockResolvedValueOnce([{ t: 0 }]);
    transaction.mockResolvedValueOnce(undefined);
    execute.mockResolvedValue(undefined);
    await addPart("job1", { product_id: "p1", quantity: 2 });
    const stmts = transaction.mock.calls[0][0] as { sql: string; params: unknown[] }[];
    // decrement + movement + part insert
    expect(stmts).toHaveLength(3);
    expect(stmts[0].sql).toMatch(/UPDATE batches/);
    expect(stmts[2].sql).toMatch(/service_job_parts/);
    // line_total = unit_price(100) × qty(2)
    const partParams = stmts[2].params;
    expect(partParams[partParams.length - 1]).toBe(200);
  });
});

describe("addLabour", () => {
  it("computes line_total = hours × rate", async () => {
    query.mockResolvedValue([{ t: 0 }]); // recompute reads
    execute.mockResolvedValue(undefined);
    await addLabour("job1", { description: "Diagnostics", hours: 2, rate: 1500 });
    const insertParams = execute.mock.calls[0][1] as unknown[];
    expect(insertParams[5]).toBe(3000); // line_total
  });
});

describe("invoiceJob guards", () => {
  const mockJob = (over: Record<string, unknown>) => {
    query
      .mockResolvedValueOnce([{ id: "job1", job_number: "SJ-2026-00001", is_warranty: 0, invoice_id: null, status: "completed", customer_id: "c1", serial_number: "SN1", ...over }]) // job
      .mockResolvedValueOnce([]) // parts
      .mockResolvedValueOnce([]); // labour
  };

  it("refuses warranty jobs", async () => {
    mockJob({ is_warranty: 1 });
    await expect(invoiceJob("job1", { dueDate: "2026-01-01", userId: "u1" })).rejects.toThrow(/Warranty/);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("refuses an already-invoiced job", async () => {
    mockJob({ invoice_id: "inv0" });
    await expect(invoiceJob("job1", { dueDate: "2026-01-01", userId: "u1" })).rejects.toThrow(/already been invoiced/);
  });

  it("refuses a job that isn't completed", async () => {
    mockJob({ status: "in_progress" });
    await expect(invoiceJob("job1", { dueDate: "2026-01-01", userId: "u1" })).rejects.toThrow(/Complete the job/);
  });

  it("raises an invoice from parts + labour and links it", async () => {
    // job with parts + labour
    query
      .mockResolvedValueOnce([{ id: "job1", job_number: "SJ-2026-00001", is_warranty: 0, invoice_id: null, status: "completed", customer_id: "c1", serial_number: "SN1" }])
      .mockResolvedValueOnce([{ id: "pt1", product_id: "p1", product_name: "Filter", quantity: 2, unit_price: 100, line_total: 200 }])
      .mockResolvedValueOnce([{ id: "lb1", description: "Labour", hours: 2, rate: 1500, line_total: 3000 }])
      .mockResolvedValueOnce([{ name: "Acme Ltd", phone: null, email: null, address: null }]); // customer
    createInvoice.mockResolvedValueOnce("inv1");
    execute.mockResolvedValue(undefined);
    const id = await invoiceJob("job1", { dueDate: "2026-02-01", userId: "u1" });
    expect(id).toBe("inv1");
    const arg = createInvoice.mock.calls[0][0] as { items: unknown[] };
    expect(arg.items).toHaveLength(2); // 1 part + 1 labour
    // job marked invoiced with the invoice id
    const upd = execute.mock.calls.at(-1)?.[1] as unknown[];
    expect(upd[1]).toBe("inv1");
  });
});

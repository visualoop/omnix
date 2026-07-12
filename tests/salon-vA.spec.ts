/**
 * salon-vA.spec.ts — Salon/Spa Phase A booking engine.
 *
 * Pure time helpers, appointment status transitions, staff-availability
 * conflict detection, and booking (end-time from duration + commission
 * accrual per service pct / staff default). DB + collaborators mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
const execute = vi.fn();
const transaction = vi.fn();
const completeSale = vi.fn();

vi.mock("@/lib/db", () => ({
  query: (...a: unknown[]) => query(...a),
  execute: (...a: unknown[]) => execute(...a),
  transaction: (...a: unknown[]) => transaction(...a),
}));
vi.mock("@/services/rbac", () => ({ requirePermission: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/stores/active-branch", () => ({ getActiveBranchId: () => "" }));
vi.mock("@/services/sales", () => ({ completeSale: (...a: unknown[]) => completeSale(...a), getPaymentMethods: vi.fn() }));

const upsertEmployee = vi.fn();
const listEmployees = vi.fn();
const listLinkableUsers = vi.fn();
vi.mock("@/services/employees", () => ({
  upsertEmployee: (...a: unknown[]) => upsertEmployee(...a),
  listEmployees: (...a: unknown[]) => listEmployees(...a),
  listLinkableUsers: (...a: unknown[]) => listLinkableUsers(...a),
}));

import {
  timeToMin, addMinutesIso, intervalsOverlap, canTransitionAppt,
  isStaffAvailable, bookAppointment, setServiceProducts, sellPackage, isResourceAvailable,
  listEnrollableStaff, enrolStaff, updatePackage, finalizeSalonAppointment, finalizeSalonPackageSale, prepareAppointmentForPos,
} from "@/services/salon";

beforeEach(() => { query.mockReset(); execute.mockReset(); transaction.mockReset(); completeSale.mockReset(); upsertEmployee.mockReset(); listEmployees.mockReset(); listLinkableUsers.mockReset(); });

describe("staff enrolment (source = employees ∪ users)", () => {
  it("lists active employees and login-users-without-employee together", async () => {
    listEmployees.mockResolvedValue([{ id: "emp-1", full_name: "Amina", job_title: "Stylist" }]);
    listLinkableUsers.mockResolvedValue([{ id: "user-1", full_name: "Brian", username: "brian", role: "cashier" }]);
    const people = await listEnrollableStaff();
    expect(people).toEqual([
      { kind: "employee", id: "emp-1", full_name: "Amina", subtitle: "Stylist" },
      { kind: "user", id: "user-1", full_name: "Brian", subtitle: "cashier" },
    ]);
  });

  it("materializes a linked employee for a login-only user, then creates staff", async () => {
    upsertEmployee.mockResolvedValue("emp-new");
    execute.mockResolvedValue(undefined);
    await enrolStaff({ kind: "user", id: "user-1", full_name: "Jane", subtitle: "cashier" }, 10);
    expect(upsertEmployee).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Jane", user_id: "user-1" }));
    const insert = execute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO salon_staff"));
    expect(insert?.[1]).toContain("emp-new"); // salon_staff.employee_id
  });

  it("enrols an existing employee directly without creating a new employee", async () => {
    execute.mockResolvedValue(undefined);
    await enrolStaff({ kind: "employee", id: "emp-9", full_name: "Bob", subtitle: null }, 5);
    expect(upsertEmployee).not.toHaveBeenCalled();
    const insert = execute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO salon_staff"));
    expect(insert?.[1]).toContain("emp-9");
  });
});

describe("updatePackage", () => {
  it("updates the package row and syncs the backing product name", async () => {
    query.mockResolvedValueOnce([{ product_id: "prod-1" }]);
    execute.mockResolvedValue(undefined);
    await updatePackage("pkg-1", { name: "New Bundle", service_id: "svc-1", sessions: 8, price: 4000, validity_days: 90 });
    const updPkg = execute.mock.calls.find((c) => String(c[0]).includes("UPDATE salon_packages"));
    expect(updPkg?.[1]).toContain("New Bundle");
    expect(updPkg?.[1]).toContain(8);
    const updProd = execute.mock.calls.find((c) => String(c[0]).includes("UPDATE products"));
    expect(updProd?.[1]).toEqual(["prod-1", "New Bundle"]);
  });
});

describe("finalizeSalonAppointment (POS completion)", () => {
  it("accrues commissions + marks the appointment checked out against the sale", async () => {
    query
      .mockResolvedValueOnce([{ id: "appt1", sale_id: null, client_id: null, staff_id: "st1", appt_number: "A1" }]) // getAppointment: appt
      .mockResolvedValueOnce([{ id: "as1", service_id: "sv1", staff_id: "st1", name: "Cut", price: 500, duration_min: 30, commission_amount: 50 }]) // appt services
      .mockResolvedValueOnce([{ id: "sv1", product_id: "p1", tax_rate: 16 }]) // buildServiceLines productMap
      .mockResolvedValueOnce([]); // backBarConsumptionStmts (no back-bar products)
    transaction.mockResolvedValue(undefined);

    await finalizeSalonAppointment("appt1", "sale1");

    expect(transaction).toHaveBeenCalledTimes(1);
    const stmts = transaction.mock.calls[0][0] as Array<{ sql: string; params: unknown[] }>;
    const mark = stmts.find((s) => s.sql.includes("UPDATE salon_appointments SET status = 'completed', sale_id"));
    expect(mark?.params).toContain("sale1");
    const comm = stmts.find((s) => s.sql.includes("INSERT INTO salon_commissions"));
    expect(comm?.params).toContain(50);   // commission amount
    expect(comm?.params).toContain("sale1");
  });

  it("is a no-op when the appointment is already linked to a sale", async () => {
    query
      .mockResolvedValueOnce([{ id: "appt1", sale_id: "existing", client_id: null, staff_id: "st1" }])
      .mockResolvedValueOnce([]);
    await finalizeSalonAppointment("appt1", "sale2");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("prepareAppointmentForPos (FK-787 guard)", () => {
  it("resolves the tip recipient to the staff's employee id, not the salon_staff id", async () => {
    query
      .mockResolvedValueOnce([{ id: "appt1", sale_id: null, client_id: null, staff_id: "staff-row-1", appt_number: "A1", client_name: "Jane" }]) // getAppointment: appt
      .mockResolvedValueOnce([{ id: "as1", service_id: "sv1", staff_id: "staff-row-1", name: "Cut", price: 500, duration_min: 30, commission_amount: 50 }]) // appt services
      .mockResolvedValueOnce([{ id: "sv1", product_id: "prod1", tax_rate: 16 }]) // buildServiceLines productMap
      .mockResolvedValueOnce([{ employee_id: "emp-99" }]); // staffEmployeeId lookup
    const res = await prepareAppointmentForPos("appt1");
    // sales.tip_employee_id FKs employees(id) — must be the employee, not the staff row id.
    expect(res.tipEmployeeId).toBe("emp-99");
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({ service_id: "sv1", unit_price: 500 });
  });

  it("uses the CURRENT service price, not the stale booking snapshot", async () => {
    query
      .mockResolvedValueOnce([{ id: "appt1", sale_id: null, client_id: null, staff_id: "st1", appt_number: "A1", client_name: "Jane" }])
      .mockResolvedValueOnce([{ id: "as1", service_id: "sv1", staff_id: "st1", name: "Cut", price: 0, duration_min: 30, commission_amount: 0 }]) // snapshot price 0 (booked before price was set)
      .mockResolvedValueOnce([{ id: "sv1", product_id: "prod1", tax_rate: 16, current_price: 800 }]) // current price 800
      .mockResolvedValueOnce([{ employee_id: "emp-1" }]);
    const res = await prepareAppointmentForPos("appt1");
    expect(res.items[0].unit_price).toBe(800); // not 0
  });
});

describe("finalizeSalonPackageSale (POS package sale)", () => {
  const pkgRow = { id: "pk1", product_id: "prod1", name: "10 massages", service_id: "svc1", sessions: 10, price: 9000, validity_days: 90 };

  it("grants the client's package balance after the POS sale completes", async () => {
    query.mockResolvedValueOnce([]);         // no existing balance for this sale
    query.mockResolvedValueOnce([pkgRow]);   // grantClientPackage: load package
    execute.mockResolvedValue(undefined);
    await finalizeSalonPackageSale("pk1", "c1", "sale1");
    const insert = execute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO client_packages"));
    expect(insert?.[1]).toContain("c1");
    expect(insert?.[1]).toContain("sale1");
    expect(insert?.[1]).toContain(10);       // sessions_total = sessions_remaining
  });

  it("is a no-op for a walk-in (no client to own the package)", async () => {
    await finalizeSalonPackageSale("pk1", null, "sale1");
    expect(execute).not.toHaveBeenCalled();
  });

  it("is idempotent when a balance already exists for the sale", async () => {
    query.mockResolvedValueOnce([{ id: "cp-existing" }]);
    await finalizeSalonPackageSale("pk1", "c1", "sale1");
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("time helpers", () => {
  it("timeToMin parses HH:MM", () => {
    expect(timeToMin("08:00")).toBe(480);
    expect(timeToMin("13:30")).toBe(810);
  });
  it("addMinutesIso advances the clock", () => {
    expect(addMinutesIso("2026-07-09T08:00:00.000Z", 45)).toBe("2026-07-09T08:45:00.000Z");
  });
  it("intervalsOverlap detects overlap + abutting", () => {
    const a = ["2026-07-09T08:00:00Z", "2026-07-09T09:00:00Z"] as const;
    expect(intervalsOverlap(a[0], a[1], "2026-07-09T08:30:00Z", "2026-07-09T09:30:00Z")).toBe(true);
    // abutting (back-to-back) does NOT overlap
    expect(intervalsOverlap(a[0], a[1], "2026-07-09T09:00:00Z", "2026-07-09T10:00:00Z")).toBe(false);
    expect(intervalsOverlap(a[0], a[1], "2026-07-09T07:00:00Z", "2026-07-09T07:45:00Z")).toBe(false);
  });
});

describe("canTransitionAppt", () => {
  it("allows the normal flow", () => {
    expect(canTransitionAppt("booked", "checked_in")).toBe(true);
    expect(canTransitionAppt("checked_in", "in_service")).toBe(true);
    expect(canTransitionAppt("in_service", "completed")).toBe(true);
  });
  it("blocks terminal / illegal moves", () => {
    expect(canTransitionAppt("completed", "in_service")).toBe(false);
    expect(canTransitionAppt("cancelled", "booked")).toBe(false);
    expect(canTransitionAppt("in_service", "booked")).toBe(false);
  });
});

describe("isStaffAvailable", () => {
  it("is free when no appointment overlaps", async () => {
    query.mockResolvedValueOnce([{ starts_at: "2026-07-09T10:00:00Z", ends_at: "2026-07-09T11:00:00Z" }]);
    const free = await isStaffAvailable("st1", "2026-07-09T11:00:00Z", "2026-07-09T12:00:00Z");
    expect(free).toBe(true);
  });
  it("is busy when an appointment overlaps", async () => {
    query.mockResolvedValueOnce([{ starts_at: "2026-07-09T10:00:00Z", ends_at: "2026-07-09T11:00:00Z" }]);
    const free = await isStaffAvailable("st1", "2026-07-09T10:30:00Z", "2026-07-09T11:30:00Z");
    expect(free).toBe(false);
  });
});

describe("bookAppointment", () => {
  const mockBookingQueries = (opts: { commission_pct: number | null; staffDefault: number; conflict?: boolean }) => {
    query
      .mockResolvedValueOnce([{ id: "s1", name: "Cut", price: 1000, duration_min: 30, commission_pct: opts.commission_pct }]) // services
      .mockResolvedValueOnce([{ id: "st1", display_name: "Amina", commission_default_pct: opts.staffDefault }])                // staff
      .mockResolvedValueOnce(opts.conflict ? [{ starts_at: "2026-07-09T08:00:00Z", ends_at: "2026-07-09T09:00:00Z" }] : [])   // availability
      .mockResolvedValueOnce([{ n: "3" }]);                                                                                    // appt number
  };

  it("sets end from duration + uses the service commission pct", async () => {
    mockBookingQueries({ commission_pct: 10, staffDefault: 20 });
    transaction.mockResolvedValueOnce(undefined);
    const res = await bookAppointment({ staff_id: "st1", starts_at: "2026-07-09T08:00:00.000Z", service_ids: ["s1"] });
    expect(res.appt_number).toMatch(/^AP-\d{4}-00004$/);
    const stmts = transaction.mock.calls[0][0] as { sql: string; params: unknown[] }[];
    // appointment insert ends_at = start + 30m
    expect(stmts[0].params[6]).toBe("2026-07-09T08:30:00.000Z");
    // service line commission = 1000 * 10%
    expect(stmts[1].sql).toMatch(/salon_appointment_services/);
    expect(stmts[1].params[7]).toBe(100);
  });

  it("falls back to the staff default commission when the service has none", async () => {
    mockBookingQueries({ commission_pct: null, staffDefault: 20 });
    transaction.mockResolvedValueOnce(undefined);
    await bookAppointment({ staff_id: "st1", starts_at: "2026-07-09T08:00:00.000Z", service_ids: ["s1"] });
    const stmts = transaction.mock.calls[0][0] as { params: unknown[] }[];
    expect(stmts[1].params[7]).toBe(200); // 1000 * 20%
  });

  it("refuses a conflicting slot", async () => {
    mockBookingQueries({ commission_pct: 10, staffDefault: 20, conflict: true });
    await expect(
      bookAppointment({ staff_id: "st1", starts_at: "2026-07-09T08:00:00.000Z", service_ids: ["s1"] }),
    ).rejects.toThrow(/already booked/i);
    expect(transaction).not.toHaveBeenCalled();
  });
});


describe("setServiceProducts (back-bar mapping)", () => {
  it("replaces the mapping: delete then insert each product", async () => {
    transaction.mockResolvedValueOnce(undefined);
    await setServiceProducts("svc1", [
      { product_id: "p1", quantity: 2 },
      { product_id: "p2", quantity: 0.5 },
    ]);
    const stmts = transaction.mock.calls[0][0] as { sql: string; params: unknown[] }[];
    expect(stmts[0].sql).toMatch(/DELETE FROM salon_service_products/);
    expect(stmts).toHaveLength(3); // delete + 2 inserts
    expect(stmts[1].params).toContain("p1");
    expect(stmts[1].params).toContain(2);
  });
});


describe("sellPackage", () => {
  it("bills the package then records the prepaid balance", async () => {
    const pkgRow = { id: "pk1", product_id: "prod1", name: "10 massages", service_id: "svc1", sessions: 10, price: 9000, validity_days: 90 };
    query.mockResolvedValueOnce([pkgRow]);   // sellPackage: load package
    completeSale.mockResolvedValueOnce({ saleId: "sale1", saleItemIds: [] });
    query.mockResolvedValueOnce([pkgRow]);   // grantClientPackage: re-load package
    execute.mockResolvedValue(undefined);
    const res = await sellPackage({ client_id: "c1", package_id: "pk1", userId: "u1", payments: [{ method_id: "m1", method_name: "Cash", amount: 9000 }] });
    expect(res.saleId).toBe("sale1");
    // client_packages insert: sessions_total = sessions_remaining = 10
    const params = execute.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
    expect(params).toContain("c1");
    expect(params).toContain("sale1");
  });
});


describe("resources", () => {
  it("isResourceAvailable is busy when a booking overlaps", async () => {
    query.mockResolvedValueOnce([{ starts_at: "2026-07-09T10:00:00Z", ends_at: "2026-07-09T11:00:00Z" }]);
    expect(await isResourceAvailable("r1", "2026-07-09T10:30:00Z", "2026-07-09T11:30:00Z")).toBe(false);
  });

  it("bookAppointment refuses a double-booked resource", async () => {
    query
      .mockResolvedValueOnce([{ id: "s1", name: "Massage", price: 2000, duration_min: 60, commission_pct: 10 }]) // services
      .mockResolvedValueOnce([{ id: "st1", display_name: "Amina", commission_default_pct: 20 }])                 // staff
      .mockResolvedValueOnce([])                                                                                  // staff availability (free)
      .mockResolvedValueOnce([{ starts_at: "2026-07-09T08:00:00.000Z", ends_at: "2026-07-09T09:00:00.000Z" }]); // resource busy
    await expect(
      bookAppointment({ staff_id: "st1", starts_at: "2026-07-09T08:00:00.000Z", service_ids: ["s1"], resource_id: "r1" }),
    ).rejects.toThrow(/room \/ resource is already booked/i);
    expect(transaction).not.toHaveBeenCalled();
  });
});

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

vi.mock("@/lib/db", () => ({
  query: (...a: unknown[]) => query(...a),
  execute: (...a: unknown[]) => execute(...a),
  transaction: (...a: unknown[]) => transaction(...a),
}));
vi.mock("@/services/rbac", () => ({ requirePermission: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/stores/active-branch", () => ({ getActiveBranchId: () => "" }));
vi.mock("@/services/sales", () => ({ completeSale: vi.fn(), getPaymentMethods: vi.fn() }));

import {
  timeToMin, addMinutesIso, intervalsOverlap, canTransitionAppt,
  isStaffAvailable, bookAppointment,
} from "@/services/salon";

beforeEach(() => { query.mockReset(); execute.mockReset(); transaction.mockReset(); });

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
    expect(stmts[0].params[5]).toBe("2026-07-09T08:30:00.000Z");
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

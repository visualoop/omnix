import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import { query, execute } from "@/lib/db";
import { useCountry, getBusinessCurrencyCode } from "@/stores/country";
import { useActiveBranch } from "@/stores/active-branch";
import type { Branch } from "@/services/branches";
import { toIntlDigits } from "@/lib/phone";
import { isFeatureEnabledForCountry, requireCountryFeature } from "@/lib/features";
import { calculatePayroll } from "@/services/payroll";
import { getEtimsConfig } from "@/services/etims";
import { runPpbAutoSubmission } from "@/services/ppb-submissions";
import { settingsRegistry } from "@/lib/settings-registry";

const queryMock = vi.mocked(query);
const executeMock = vi.mocked(execute);
let persistedCountry: string | null;
let persistedCurrency: string | null;
let transactionsExist: boolean;

beforeEach(() => {
  localStorage.clear();
  persistedCountry = null;
  persistedCurrency = null;
  transactionsExist = false;
  queryMock.mockReset();
  executeMock.mockReset();

  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes("sqlite_master")) return transactionsExist ? [{ name: "sales" }] : [];
    if (sql.includes("SELECT 1 AS present FROM sales")) return transactionsExist ? [{ present: 1 }] : [];
    if (sql.includes("WHERE key = ?1 LIMIT 1")) {
      return persistedCountry ? [{ value: persistedCountry }] : [];
    }
    if (sql.includes("WHERE key IN (?1, ?2)")) {
      return [
        ...(persistedCountry ? [{ key: "country_code", value: persistedCountry }] : []),
        ...(persistedCurrency ? [{ key: "business_currency", value: persistedCurrency }] : []),
      ];
    }
    return [];
  });

  executeMock.mockImplementation(async (_sql: string, params?: unknown[]) => {
    if (params?.[0] === "country_code") {
      persistedCountry = String(params[1]);
      persistedCurrency = String(params[3]);
    }
    return 1;
  });

  useCountry.setState({ code: null, currencyCode: null, loaded: false });
  useActiveBranch.getState().clear();
});

describe("business country persistence", () => {
  it("restores the selected country and currency after a simulated restart", async () => {
    await useCountry.getState().set("UG");
    expect(useCountry.getState()).toMatchObject({ code: "UG", currencyCode: "UGX", loaded: true });
    expect(localStorage.getItem("omnix.country_code")).toBe("UG");

    useCountry.setState({ code: null, currencyCode: null, loaded: false });
    await useCountry.getState().load();

    expect(useCountry.getState()).toMatchObject({ code: "UG", currencyCode: "UGX", loaded: true });
    expect(getBusinessCurrencyCode()).toBe("UGX");
  });

  it("rejects a country/currency change after transactional history exists", async () => {
    persistedCountry = "KE";
    persistedCurrency = "KES";
    transactionsExist = true;
    useCountry.setState({ code: "KE", currencyCode: "KES", loaded: true });

    await expect(useCountry.getState().set("TZ")).rejects.toThrow("cannot be changed after transactions exist");
    expect(useCountry.getState()).toMatchObject({ code: "KE", currencyCode: "KES" });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("never derives currency from branch switching", async () => {
    useCountry.setState({ code: "RW", currencyCode: "RWF", loaded: true });
    const branch = (id: string): Branch => ({
      id,
      code: id.toUpperCase(),
      name: id,
      address: null,
      phone: null,
      email: null,
      manager_id: null,
      is_default: id === "one" ? 1 : 0,
      active: 1,
      timezone: id === "one" ? "Africa/Kigali" : "Africa/Nairobi",
      kra_pin: id === "two" ? "STALE-KRA-PIN" : null,
      etims_device_id: null,
      open_time: null,
      close_time: null,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const first = branch("one");
    const second = branch("two");

    useActiveBranch.setState({
      active: first,
      available: [first, second],
      loaded: true,
      scope: "branch",
      revision: 0,
    });
    expect(getBusinessCurrencyCode()).toBe("RWF");
    await useActiveBranch.getState().switchTo(second);
    expect(getBusinessCurrencyCode()).toBe("RWF");
  });
});

describe("country-aware phone normalization", () => {
  it.each([
    ["KE", "0712345678", "254712345678"],
    ["UG", "0772123456", "256772123456"],
    ["TZ", "0712123456", "255712123456"],
    ["RW", "0788123456", "250788123456"],
  ] as const)("normalizes local %s numbers", (code, input, expected) => {
    const currency = code === "KE" ? "KES" : code === "UG" ? "UGX" : code === "TZ" ? "TZS" : "RWF";
    useCountry.setState({ code, currencyCode: currency, loaded: true });
    expect(toIntlDigits(input)).toBe(expected);
  });
});

describe("Kenya compliance gating", () => {
  it("enables Kenya compliance only for Kenya", () => {
    for (const feature of ["etims", "sha", "kra_pin", "ppb_register", "vat3"] as const) {
      expect(isFeatureEnabledForCountry("KE", feature)).toBe(true);
      expect(isFeatureEnabledForCountry("UG", feature)).toBe(false);
      expect(isFeatureEnabledForCountry("TZ", feature)).toBe(false);
      expect(isFeatureEnabledForCountry("RW", feature)).toBe(false);
    }
  });

  it("removes Kenya settings and makes background services no-op outside Kenya", async () => {
    useCountry.setState({ code: "TZ", currencyCode: "TZS", loaded: true });
    const paths = settingsRegistry().map((item) => item.to);
    expect(paths).not.toContain("/settings/etims");
    expect(paths).not.toContain("/settings/insurance");
    expect(paths).not.toContain("/settings/pharmacy-licenses");
    expect(paths).not.toContain("/settings/pharmacy-ppb");
    expect(() => requireCountryFeature("etims", "KRA eTIMS")).toThrow("not available");
    await expect(getEtimsConfig()).resolves.toBeNull();
    await expect(runPpbAutoSubmission()).resolves.toEqual({ ran: false });
  });

  it.each(["UG", "TZ", "RW"] as const)("does not apply Kenya statutory payroll in %s", (code) => {
    const result = calculatePayroll({ country_code: code, base_salary: 100_000 });
    expect(result).toMatchObject({
      paye: 0,
      nssf_employee: 0,
      nssf_employer: 0,
      shif: 0,
      housing_levy_employee: 0,
      housing_levy_employer: 0,
      nita_levy: 0,
      deductions_total: 0,
      net_pay: 100_000,
      total_employer_cost: 100_000,
    });
  });

  it("keeps the Kenya statutory engine active for Kenya", () => {
    const result = calculatePayroll({ country_code: "KE", base_salary: 100_000 });
    expect(result.paye).toBeGreaterThan(0);
    expect(result.nssf_employee).toBeGreaterThan(0);
    expect(result.shif).toBeGreaterThan(0);
    expect(result.housing_levy_employee).toBeGreaterThan(0);
    expect(result.nita_levy).toBe(50);
  });
});

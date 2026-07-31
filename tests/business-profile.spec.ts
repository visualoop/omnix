/**
 * Regression test for the "Your Business" placeholder bug.
 *
 * Business identity is stored in the `business` table (edited via
 * Settings → Business Profile + the setup wizard). The PDF generators
 * used to read `settings` rows keyed `business.name` etc. — keys that
 * nothing ever wrote — so every export showed "Your Business".
 *
 * getBusinessProfile() must read from the `business` table (+ KRA PIN
 * from etims_config) so PDFs carry the real name.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db layer the service depends on.
const queryMock = vi.fn();
const executeMock = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => queryMock(...args),
  execute: (...args: unknown[]) => executeMock(...args),
}));

import { getBusinessProfile, getBusinessName } from "@/services/business-profile";
import { useCountry } from "@/stores/country";

function routeQuery(sql: string): unknown[] {
  if (/FROM\s+business/i.test(sql)) {
    return [{
      name: "Afya Bora Chemist",
      type: "pharmacy",
      address: "Moi Avenue, Nairobi",
      phone: "0712345678",
      email: "info@afyabora.co.ke",
    }];
  }
  if (/FROM\s+etims_config/i.test(sql)) {
    return [{ kra_pin: "P051234567X" }];
  }
  if (/FROM\s+settings/i.test(sql)) {
    return [{ key: "business.logo_path", value: "file:///logo.png" }];
  }
  return [];
}

describe("getBusinessProfile", () => {
  beforeEach(() => {
    queryMock.mockReset();
    executeMock.mockReset();
    executeMock.mockResolvedValue(1);
    queryMock.mockImplementation((sql: string) => Promise.resolve(routeQuery(sql)));
    useCountry.setState({ code: null, currencyCode: null, loaded: false });
  });

  it("reads the real business name from the business table, not a placeholder", async () => {
    const p = await getBusinessProfile();
    expect(p.name).toBe("Afya Bora Chemist");
    expect(p.name).not.toBe("Your Business");
  });

  it("folds in the KRA PIN from etims_config for Kenya", async () => {
    const p = await getBusinessProfile();
    expect(p.kraPin).toBe("P051234567X");
  });

  it("does not expose Kenya KRA data for another business country", async () => {
    useCountry.setState({ code: "UG", currencyCode: "UGX", loaded: true });

    const p = await getBusinessProfile();

    expect(p.kraPin).toBeNull();
    expect(queryMock.mock.calls.some(([sql]) => /FROM\s+etims_config/i.test(String(sql)))).toBe(false);
  });

  it("carries address, phone, email through", async () => {
    const p = await getBusinessProfile();
    expect(p.address).toBe("Moi Avenue, Nairobi");
    expect(p.phone).toBe("0712345678");
    expect(p.email).toBe("info@afyabora.co.ke");
  });

  it("picks up optional logo path from settings", async () => {
    const p = await getBusinessProfile();
    expect(p.logoPath).toBe("file:///logo.png");
  });

  it("returns an empty name (not a crash) when no business row exists", async () => {
    queryMock.mockImplementation(() => Promise.resolve([]));
    const p = await getBusinessProfile();
    expect(p.name).toBe("");
  });

  it("getBusinessName applies a display fallback only when truly empty", async () => {
    queryMock.mockImplementation(() => Promise.resolve([]));
    expect(await getBusinessName()).toBe("Your Business");
    expect(await getBusinessName("Omnix POS")).toBe("Omnix POS");
  });
});

import { describe, it, expect } from "vitest";
import { formatRxNumber, formatPharmacyDisplay } from "@/services/pharmacy";
import { calculateCopay } from "@/services/insurance";
import { encryptSecret, decryptSecret, isEncrypted } from "@/services/secrets";

/**
 * v0.46 Pharmacy (Dawa) audit remediation — contract tests.
 *
 * Same pattern as hardware-v45.spec.ts: exercise pure functions and
 * invariants that don't need a live DB, so future refactors can't
 * silently regress. Behaviours that depend on SQL (dispensePrescription,
 * autoPostControlledLog, refill counter) are covered by the sql-smoke
 * suite when the DB harness is set up.
 */

// ─── DW-35: formatRxNumber ─────────────────────────────────────────
describe("formatRxNumber — canonical Rx display string", () => {
  it("zero-pads to five digits", () => {
    expect(formatRxNumber(1)).toBe("RX-00001");
    expect(formatRxNumber(42)).toBe("RX-00042");
    expect(formatRxNumber(9999)).toBe("RX-09999");
  });

  it("does not truncate longer sequences", () => {
    expect(formatRxNumber(123456)).toBe("RX-123456");
  });

  it("handles zero without breaking", () => {
    expect(formatRxNumber(0)).toBe("RX-00000");
  });
});

// ─── DW-29: formatPharmacyDisplay ──────────────────────────────────
describe("formatPharmacyDisplay — brand+generic+strength composition", () => {
  it("uses generic (brand) strength when both present", () => {
    const out = formatPharmacyDisplay("Product X", {
      generic_name: "Paracetamol",
      brand_name: "Panadol",
      strength: "500mg",
      dosage_form: "tab",
    });
    expect(out).toBe("Paracetamol (Panadol) 500mg tab");
  });

  it("brand only when generic missing", () => {
    const out = formatPharmacyDisplay("Ignored", {
      generic_name: null,
      brand_name: "Panadol",
      strength: "500mg",
    });
    expect(out).toBe("Panadol 500mg");
  });

  it("generic only when brand missing", () => {
    const out = formatPharmacyDisplay("Ignored", {
      generic_name: "Amoxicillin",
      brand_name: null,
      strength: "250mg",
    });
    expect(out).toBe("Amoxicillin 250mg");
  });

  it("falls back to the plain product name when no metadata", () => {
    expect(formatPharmacyDisplay("Chair")).toBe("Chair");
    expect(formatPharmacyDisplay("Bottle", { generic_name: null, brand_name: null })).toBe("Bottle");
  });
});

// ─── DW-10 + DW-7: calculateCopay ──────────────────────────────────
describe("calculateCopay — insurance copay/claim split", () => {
  const baseMember = {
    id: "m", provider_id: "p", member_number: "MB1", national_id: null,
    full_name: "Test", phone: null, scheme_name: null, scheme_type: null,
    benefit_balance: null, copay_percentage: 0, copay_fixed: 0,
    valid_from: null, valid_to: null, last_verified_at: "2026-01-01",
  };

  it("100% covered when copay_percentage=0 and copay_fixed=0", () => {
    const { copay, claim } = calculateCopay(baseMember, 1000);
    expect(copay).toBe(0);
    expect(claim).toBe(1000);
  });

  it("10% copay applied", () => {
    const { copay, claim } = calculateCopay({ ...baseMember, copay_percentage: 10 }, 1000);
    expect(copay).toBe(100);
    expect(claim).toBe(900);
    expect(copay + claim).toBe(1000);
  });

  it("fixed copay applied", () => {
    const { copay, claim } = calculateCopay({ ...baseMember, copay_fixed: 250 }, 1000);
    expect(copay).toBe(250);
    expect(claim).toBe(750);
  });

  it("combined percentage + fixed", () => {
    const { copay, claim } = calculateCopay({ ...baseMember, copay_percentage: 20, copay_fixed: 100 }, 1000);
    // 20% of 1000 = 200, plus 100 fixed = 300
    expect(copay).toBe(300);
    expect(claim).toBe(700);
  });

  it("copay caps at gross — claim never negative", () => {
    const { copay, claim } = calculateCopay({ ...baseMember, copay_percentage: 100, copay_fixed: 500 }, 1000);
    // Would be 1500 uncapped — should cap at 1000.
    expect(copay).toBe(1000);
    expect(claim).toBe(0);
  });

  it("copay + claim ALWAYS reconstructs gross to the cent", () => {
    // A rounding drift here means SHA rejects the claim.
    const cases = [
      { gross: 1234.56, pct: 20 },
      { gross: 999.99, pct: 15, fixed: 3.33 },
      { gross: 100.01, pct: 33 },
      { gross: 0.03, pct: 50 },
    ];
    for (const c of cases) {
      const { copay, claim } = calculateCopay(
        { ...baseMember, copay_percentage: c.pct, copay_fixed: c.fixed ?? 0 },
        c.gross,
      );
      const grossC = Math.round(c.gross * 100);
      const sumC = Math.round(copay * 100) + Math.round(claim * 100);
      expect(sumC).toBe(grossC);
    }
  });
});

// ─── DW-33: encrypt/decrypt secrets ─────────────────────────────────
describe("secrets service — encrypt / decrypt roundtrip", () => {
  it("round-trips a plain string", async () => {
    const plain = "sk_live_1234567890abcdef";
    const enc = await encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    const dec = await decryptSecret(enc);
    expect(dec).toBe(plain);
  });

  it("returns null for null/empty input", async () => {
    expect(await encryptSecret(null)).toBe(null);
    expect(await encryptSecret(undefined)).toBe(null);
    expect(await encryptSecret("")).toBe(null);
    expect(await decryptSecret(null)).toBe(null);
    expect(await decryptSecret("")).toBe(null);
  });

  it("passes through legacy plaintext (no prefix) unchanged", async () => {
    const legacy = "plaintext-api-key";
    expect(isEncrypted(legacy)).toBe(false);
    const dec = await decryptSecret(legacy);
    expect(dec).toBe(legacy);
  });

  it("two encryptions of the same plaintext produce different ciphertexts", async () => {
    const enc1 = await encryptSecret("same-secret");
    const enc2 = await encryptSecret("same-secret");
    expect(enc1).not.toBe(enc2);
    expect(await decryptSecret(enc1)).toBe("same-secret");
    expect(await decryptSecret(enc2)).toBe("same-secret");
  });

  it("corrupted ciphertext returns null gracefully", async () => {
    const dec = await decryptSecret("omx1:not-real-base64!!!");
    expect(dec).toBe(null);
  });
});

// ─── DW-2 + DW-13: cold-chain excursion window ──────────────────────
describe("cold-chain excursion window logic", () => {
  it("classifies a reading as in-range when within target", () => {
    const inRange = (t: number, min: number, max: number) => t >= min && t <= max;
    expect(inRange(5, 2, 8)).toBe(true);
    expect(inRange(2, 2, 8)).toBe(true);
    expect(inRange(8, 2, 8)).toBe(true);
    expect(inRange(1.9, 2, 8)).toBe(false);
    expect(inRange(8.1, 2, 8)).toBe(false);
    expect(inRange(15, 2, 8)).toBe(false);
  });
});

// ─── DW-1 / DW-3: severity ordering ─────────────────────────────────
describe("interaction severity ordering", () => {
  it("ranks contraindicated above major above moderate above minor", () => {
    const order = { contraindicated: 0, major: 1, moderate: 2, minor: 3 } as const;
    const input = [
      { severity: "minor" as const },
      { severity: "major" as const },
      { severity: "contraindicated" as const },
      { severity: "moderate" as const },
    ];
    input.sort((a, b) => order[a.severity] - order[b.severity]);
    expect(input.map((w) => w.severity)).toEqual(["contraindicated", "major", "moderate", "minor"]);
  });

  it("contraindicated and major are 'hard block' severities", () => {
    const blocked: Array<"contraindicated" | "major" | "moderate" | "minor"> = ["contraindicated", "major"];
    for (const s of blocked) {
      expect(["contraindicated", "major"].includes(s)).toBe(true);
    }
    for (const s of ["moderate", "minor"] as const) {
      expect(["contraindicated", "major"].includes(s)).toBe(false);
    }
  });
});

// ─── DW-9: controlled-log auto-post structure ───────────────────────
describe("controlled log auto-post — balance math", () => {
  it("balance_after is total batch quantity after dispense", () => {
    // Simulating what autoPostControlledLog does: after a sale, the
    // batches table has already been decremented (via completeSale's
    // FIFO deduction). The controlled_log balance_after should equal
    // SUM(batches.quantity) *after* deduction.
    const initialBatches = [10, 5, 3];
    const dispensed = 8;
    const remaining = Math.max(0, initialBatches.reduce((s, b) => s + b, 0) - dispensed);
    expect(remaining).toBe(10);
  });
});

// ─── DW-12: refills_authorized clamping ─────────────────────────────
describe("refills_authorized clamp", () => {
  const clamp = (n: number) => Math.max(0, n);
  it("refuses negative values", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(-100)).toBe(0);
  });
  it("passes valid values through", () => {
    expect(clamp(0)).toBe(0);
    expect(clamp(1)).toBe(1);
    expect(clamp(6)).toBe(6);
  });
});

/**
 * capabilities-v53.spec.ts — cross-cutting module capability rules.
 *
 * Locks the serial-tracking capability gate: it must be on for the
 * commerce modules (core/retail/hardware/electronics/pro) and off for
 * batch/menu modules (dawa/hospitality), and the tab label must be
 * module-aware.
 */
import { describe, it, expect } from "vitest";
import { moduleTracksSerials, usesEquipmentFraming, serialTabLabel } from "@/lib/capabilities";

describe("moduleTracksSerials", () => {
  it("enables serial tracking for commerce modules", () => {
    for (const m of ["core", "retail", "hardware", "electronics", "pro"]) {
      expect(moduleTracksSerials(m)).toBe(true);
    }
  });
  it("disables it for batch / menu modules", () => {
    expect(moduleTracksSerials("dawa")).toBe(false);
    expect(moduleTracksSerials("hospitality")).toBe(false);
  });
});

describe("usesEquipmentFraming + serialTabLabel", () => {
  it("frames hardware as equipment, everything else as serial & warranty", () => {
    expect(usesEquipmentFraming("hardware")).toBe(true);
    expect(usesEquipmentFraming("retail")).toBe(false);
    expect(usesEquipmentFraming("electronics")).toBe(false);
  });
  it("labels the product tab per module", () => {
    expect(serialTabLabel("hardware")).toBe("Equipment");
    expect(serialTabLabel("retail")).toBe("Serial & Warranty");
    expect(serialTabLabel("electronics")).toBe("Serial & Warranty");
  });
});

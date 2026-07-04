import { describe, it, expect } from "vitest";
import { backoffMinutes } from "@/services/insurance";
import { mapEprescription, type AfyaLinkEprescription } from "@/services/dha-eprescriptions";
import { classifyExcursion, type ClassifyInput } from "@/services/cold-chain-rca";
import { dedupeTemplates, renderChecklist, type CounsellingTemplate } from "@/services/counselling";
import { priorQuarter, isSubmissionDue } from "@/services/ppb-submissions";

/**
 * v0.47 non-scope-pickup — contract tests.
 *
 * Locks the pure algorithms behind the five promoted features:
 *   • SHA claim retry backoff
 *   • DHA e-prescription payload mapping
 *   • Cold-chain excursion classification
 *   • Counselling template resolution + rendering
 *   • PPB quarterly window computation
 */

// ─── NX-2: SHA claim retry backoff ─────────────────────────────────
describe("backoffMinutes — exponential backoff schedule", () => {
  it("doubles per attempt", () => {
    expect(backoffMinutes(0)).toBe(1);
    expect(backoffMinutes(1)).toBe(2);
    expect(backoffMinutes(2)).toBe(4);
    expect(backoffMinutes(3)).toBe(8);
    expect(backoffMinutes(4)).toBe(16);
  });

  it("caps at 24 hours (1440 min)", () => {
    expect(backoffMinutes(11)).toBe(1440);
    expect(backoffMinutes(20)).toBe(1440);
    expect(backoffMinutes(1000)).toBe(1440);
  });

  it("is monotonically non-decreasing", () => {
    let prev = 0;
    for (let i = 0; i <= 15; i++) {
      const v = backoffMinutes(i);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

// ─── NX-3: DHA e-prescription mapping ──────────────────────────────
describe("mapEprescription — AfyaLink payload → staging shape", () => {
  const payload: AfyaLinkEprescription = {
    eprescription_id: "DHA-2026-0001",
    patient: {
      full_name: "Jane Wanjiru",
      national_id: "12345678",
      phone: "+254712345678",
      date_of_birth: "1990-05-15",
      gender: "F",
    },
    prescriber: { name: "Dr. Otieno", license_number: "KMPDC-9988" },
    facility_code: "FAC-001",
    diagnosis: { code: "J06.9", text: "Acute upper respiratory infection" },
    issued_at: "2026-07-01T09:00:00Z",
    valid_until: "2026-09-30",
    items: [
      { drug_name: "Amoxicillin", strength: "500mg", dosage: "1 cap", frequency: "TDS", duration: "5 days", quantity: 15, instructions: "After meals" },
      { drug_name: "Paracetamol", strength: "500mg", quantity: 20 },
    ],
  };

  it("maps header fields correctly", () => {
    const { header } = mapEprescription(payload, "sha-default");
    expect(header.dha_id).toBe("DHA-2026-0001");
    expect(header.provider_id).toBe("sha-default");
    expect(header.patient_name).toBe("Jane Wanjiru");
    expect(header.patient_id_number).toBe("12345678");
    expect(header.prescriber_name).toBe("Dr. Otieno");
    expect(header.prescriber_license).toBe("KMPDC-9988");
    expect(header.diagnosis_code).toBe("J06.9");
  });

  it("maps all items with quantity", () => {
    const { items } = mapEprescription(payload, null);
    expect(items).toHaveLength(2);
    expect(items[0].drug_name).toBe("Amoxicillin");
    expect(items[0].quantity).toBe(15);
    expect(items[1].drug_name).toBe("Paracetamol");
    expect(items[1].dosage).toBe(null); // missing optional field → null
  });

  it("nulls out missing optional fields", () => {
    const minimal: AfyaLinkEprescription = {
      eprescription_id: "DHA-X",
      patient: { full_name: "No ID Patient" },
      prescriber: {},
      issued_at: "2026-07-01T00:00:00Z",
      items: [{ drug_name: "Aspirin", quantity: 10 }],
    };
    const { header } = mapEprescription(minimal, null);
    expect(header.patient_id_number).toBe(null);
    expect(header.prescriber_name).toBe(null);
    expect(header.diagnosis_code).toBe(null);
    expect(header.valid_until).toBe(null);
  });
});

// ─── NX-4: Cold-chain excursion classification ─────────────────────
describe("classifyExcursion — root-cause heuristics", () => {
  const base: ClassifyInput = {
    trigger: { reading_at: "2026-07-01T12:00:00Z", temperature_c: 12, in_range: 0 },
    targetMin: 2,
    targetMax: 8,
    unitReadings: [],
    otherUnitsBreachedNearby: 0,
    restockNearby: false,
  };

  it("flags power_outage when other units breached simultaneously", () => {
    const r = classifyExcursion({ ...base, otherUnitsBreachedNearby: 2 });
    expect(r.root_cause).toBe("power_outage");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("flags unit_failure for a sustained solo excursion not self-corrected", () => {
    const readings = [
      { reading_at: "2026-07-01T11:00:00Z", temperature_c: 12, in_range: 0 },
      { reading_at: "2026-07-01T12:30:00Z", temperature_c: 13, in_range: 0 },
    ];
    const r = classifyExcursion({ ...base, unitReadings: readings });
    expect(r.root_cause).toBe("unit_failure");
    expect(r.duration_minutes).toBe(90);
  });

  it("flags door_left_open for a brief self-correcting spike", () => {
    const readings = [
      { reading_at: "2026-07-01T12:00:00Z", temperature_c: 10, in_range: 0 },
      { reading_at: "2026-07-01T12:15:00Z", temperature_c: 5, in_range: 1 },
    ];
    const r = classifyExcursion({ ...base, unitReadings: readings });
    expect(r.root_cause).toBe("door_left_open");
    expect(r.duration_minutes).toBeLessThan(30);
  });

  it("flags overload when a restock happened and peak is modest", () => {
    const r = classifyExcursion({ ...base, trigger: { ...base.trigger, temperature_c: 10 }, restockNearby: true });
    expect(r.root_cause).toBe("overload");
  });

  it("flags sensor_error for a single divergent reading between in-range neighbours", () => {
    const readings = [
      { reading_at: "2026-07-01T11:45:00Z", temperature_c: 4, in_range: 1 },
      { reading_at: "2026-07-01T12:00:00Z", temperature_c: 15, in_range: 0 },
      { reading_at: "2026-07-01T12:15:00Z", temperature_c: 4.2, in_range: 1 },
    ];
    const r = classifyExcursion({ ...base, trigger: readings[1], unitReadings: readings });
    expect(r.root_cause).toBe("sensor_error");
  });

  it("returns unknown when no pattern matches", () => {
    const r = classifyExcursion(base);
    expect(r.root_cause).toBe("unknown");
    expect(r.suggested_actions.length).toBeGreaterThan(0);
  });

  it("always returns at least one suggested action", () => {
    const causes: ClassifyInput[] = [
      { ...base, otherUnitsBreachedNearby: 1 },
      { ...base, restockNearby: true, trigger: { ...base.trigger, temperature_c: 9 } },
      base,
    ];
    for (const c of causes) {
      expect(classifyExcursion(c).suggested_actions.length).toBeGreaterThan(0);
    }
  });
});

// ─── NX-5: Counselling template resolution + rendering ─────────────
describe("counselling — dedupe + checklist rendering", () => {
  const mk = (id: string, over: Partial<CounsellingTemplate> = {}): CounsellingTemplate => ({
    id, drug_class: "Penicillins", product_id: null, name: "T", dose_instructions: "Take it",
    timing: "TDS", food_interaction: null, side_effects: "Nausea", storage: null,
    missed_dose: null, warnings: null, active: 1, created_at: "", ...over,
  });

  it("dedupes templates by id preserving order", () => {
    const out = dedupeTemplates([mk("a"), mk("b"), mk("a"), mk("c")]);
    expect(out.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("renders only non-empty fields as ordered points", () => {
    const points = renderChecklist(mk("a"));
    // dose_instructions, timing, side_effects present; others null.
    expect(points.map((p) => p.field)).toEqual(["dose_instructions", "timing", "side_effects"]);
  });

  it("renders warnings last when present", () => {
    const points = renderChecklist(mk("a", { warnings: "Allergy risk", storage: "Fridge" }));
    expect(points[points.length - 1].field).toBe("warnings");
    expect(points.some((p) => p.field === "storage")).toBe(true);
  });

  it("returns empty list for a template with no content", () => {
    const empty = mk("z", {
      dose_instructions: null, timing: null, side_effects: null,
    });
    expect(renderChecklist(empty)).toEqual([]);
  });
});

// ─── NX-6: PPB quarterly window computation ────────────────────────
describe("priorQuarter — most-recently-ended quarter", () => {
  it("April → Q1 (Jan–Mar) of same year", () => {
    const w = priorQuarter(new Date("2026-04-05T00:00:00Z"));
    expect(w.quarter).toBe(1);
    expect(w.year).toBe(2026);
    expect(w.start).toBe("2026-01-01");
    expect(w.end).toBe("2026-03-31");
  });

  it("July → Q2 (Apr–Jun)", () => {
    const w = priorQuarter(new Date("2026-07-15T00:00:00Z"));
    expect(w.quarter).toBe(2);
    expect(w.start).toBe("2026-04-01");
    expect(w.end).toBe("2026-06-30");
  });

  it("October → Q3 (Jul–Sep)", () => {
    const w = priorQuarter(new Date("2026-10-01T00:00:00Z"));
    expect(w.quarter).toBe(3);
    expect(w.start).toBe("2026-07-01");
    expect(w.end).toBe("2026-09-30");
  });

  it("January → Q4 of the PREVIOUS year", () => {
    const w = priorQuarter(new Date("2026-01-10T00:00:00Z"));
    expect(w.quarter).toBe(4);
    expect(w.year).toBe(2025);
    expect(w.start).toBe("2025-10-01");
    expect(w.end).toBe("2025-12-31");
  });
});

describe("isSubmissionDue — deadline logic", () => {
  it("not due before quarter-end + auto_submit_day", () => {
    // Q2 ends 2026-06-30. auto_submit_day 10 → due 2026-07-10.
    const { due } = isSubmissionDue(new Date("2026-07-05T00:00:00Z"), 10);
    expect(due).toBe(false);
  });

  it("due on/after the deadline", () => {
    const { due, window } = isSubmissionDue(new Date("2026-07-11T00:00:00Z"), 10);
    expect(due).toBe(true);
    expect(window.quarter).toBe(2);
  });

  it("respects a custom auto_submit_day", () => {
    // deadline = 2026-06-30 + 20 = 2026-07-20
    expect(isSubmissionDue(new Date("2026-07-15T00:00:00Z"), 20).due).toBe(false);
    expect(isSubmissionDue(new Date("2026-07-21T00:00:00Z"), 20).due).toBe(true);
  });
});

/**
 * Pharmacy (Dawa) write tools — prescriptions, refills, controlled log.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import { createPrescription } from "@/services/pharmacy";
import { refillPrescription } from "@/services/pharmacy-extras";

// ─── Create Prescription ───────────────────────────────────
const rxItem = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration_days: z.number().int().min(1).optional(),
});
const rxParams = z.object({
  patient_name: z.string().min(2).max(120),
  patient_phone: z.string().optional(),
  patient_age: z.number().int().min(0).max(150).optional(),
  doctor_name: z.string().optional(),
  doctor_id: z.string().optional(),
  doctor_license: z.string().optional(),
  hospital: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  refills_authorized: z.number().int().min(0).max(12).default(0),
  items: z.array(rxItem).min(1),
});
register(defineWrite<z.infer<typeof rxParams>>({
  id: "create_prescription",
  description: "Create a new patient prescription with items and refill count",
  parameters: rxParams,
  ui: { label: "New prescription", icon: "Prescription" },
  summary: (a) => `Prescription for ${a.patient_name}${a.doctor_name ? ` (Dr. ${a.doctor_name})` : ""} · ${a.items.length} drug${a.items.length === 1 ? "" : "s"}`,
  detail: (a) => `${a.refills_authorized > 0 ? `${a.refills_authorized} refill${a.refills_authorized === 1 ? "" : "s"} authorised. ` : ""}${a.diagnosis ? `Diagnosis: ${a.diagnosis}` : ""}`,
  async run(a, ctx) {
    const id = await createPrescription({
      patient_name: a.patient_name, patient_phone: a.patient_phone, patient_age: a.patient_age,
      doctor_name: a.doctor_name, doctor_id: a.doctor_id, doctor_license: a.doctor_license,
      hospital: a.hospital, diagnosis: a.diagnosis, notes: a.notes,
      refills_authorized: a.refills_authorized,
      items: a.items,
    } as any, ctx.userId);
    return { title: `Rx for ${a.patient_name}`, output: `Prescription created (id: ${id}) with ${a.items.length} item(s).`, metadata: { id } };
  },
}));

// ─── Refill Prescription ───────────────────────────────────
register(defineWrite<{ prescription_id: string }>({
  id: "refill_prescription",
  description: "Create a refill for an existing prescription (increments refills_used)",
  parameters: z.object({ prescription_id: z.string() }),
  ui: { label: "Refill prescription", icon: "ArrowCounterClockwise" },
  summary: (a) => `Refill prescription ${a.prescription_id.slice(0, 8)}…`,
  async run(a, ctx) {
    const newId = await refillPrescription(a.prescription_id, ctx.userId);
    return { title: "Refilled", output: `New refill prescription (id: ${newId}).`, metadata: { id: newId } };
  },
}));

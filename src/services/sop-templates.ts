/**
 * PPB SOP (Standard Operating Procedure) template generator.
 *
 * Kenyan retail pharmacies must have documented SOPs on-site for PPB
 * inspection. This module generates a starter document per SOP type
 * with the mandatory sections filled in — pharmacies edit the content
 * to match their premises, then print and file physically.
 *
 * The templates are intentionally editable text (not locked forms) so
 * pharmacies can tailor them without reverse-engineering a rigid
 * template system.
 */
import {
  type BrandHeader,
  newDoc,
  drawMasthead,
  drawFooter,
  toBytes,
  PAGE_WIDTH_MM,
  MARGIN_MM,
} from "@/services/pdf-engine";

export type SopKind = "cold_chain" | "controlled_substances" | "prescription_handling" | "expiry_disposal";

interface SopSection {
  heading: string;
  body: string;
}

const TEMPLATES: Record<SopKind, { title: string; sections: SopSection[] }> = {
  cold_chain: {
    title: "Cold Chain Management SOP",
    sections: [
      {
        heading: "1. Purpose",
        body: "To ensure vaccines, insulins, and other refrigerated medicinal products are stored between 2°C and 8°C at all times as required by WHO PQS and the Pharmacy and Poisons Board (PPB).",
      },
      {
        heading: "2. Scope",
        body: "Applies to all cold-chain storage units on the premises including fridges, walk-in cold rooms, and cool boxes used for transport. Covers receipt, storage, monitoring, and dispensing of all cold-chain products.",
      },
      {
        heading: "3. Responsibilities",
        body: "The Superintendent Pharmacist is accountable for cold-chain compliance. Pharmacists on duty record temperature readings at start-of-day and end-of-day. Cleaning + defrost happens monthly per the schedule below.",
      },
      {
        heading: "4. Temperature monitoring",
        body: "Record each unit's temperature at 08:00 and 18:00 every day the pharmacy is open. Use the digital log in the Omnix Cold Chain module. Any reading outside 2°C–8°C triggers an immediate excursion review — do not dispense products from that unit until reviewed.",
      },
      {
        heading: "5. Excursion handling",
        body: "If temperature is out of range: (a) note reading + time in the log, (b) inspect fridge / power supply, (c) if excursion > 30 minutes, quarantine products until PPB / manufacturer guidance received, (d) document the corrective action.",
      },
      {
        heading: "6. Power failure",
        body: "In event of a power outage: keep fridge closed. If outage exceeds 2 hours, move products to a validated cool box with ice packs. Document time, temperature, and duration in the log.",
      },
      {
        heading: "7. Records retention",
        body: "Retain daily temperature logs and excursion records for a minimum of 5 years for PPB inspection.",
      },
    ],
  },
  controlled_substances: {
    title: "Controlled Substances Handling SOP",
    sections: [
      {
        heading: "1. Purpose",
        body: "To ensure controlled substances (as scheduled under the Narcotic Drugs and Psychotropic Substances Act, Cap 245) are stored, dispensed, and reconciled in compliance with the PPB register requirements.",
      },
      {
        heading: "2. Storage",
        body: "All controlled substances are stored in a locked cabinet accessible only to the Superintendent Pharmacist and delegated pharmacists on duty. Keys are held on person during shift.",
      },
      {
        heading: "3. Prescription requirements",
        body: "Every dispense requires a valid prescription from a KMPDC-registered prescriber. The prescription must state: patient name + ID, drug name + strength, dose, frequency, duration, prescriber name + license + signature, and date. Retain the original prescription for 5 years.",
      },
      {
        heading: "4. Register entry",
        body: "Every receipt and dispense is recorded in the Omnix Controlled Register module within 24 hours. Entries include: date, drug, quantity, patient details, prescriber, running balance, and pharmacist initials.",
      },
      {
        heading: "5. Daily reconciliation",
        body: "At end-of-day, the on-duty pharmacist counts the physical stock of each controlled drug and reconciles against the register. Any discrepancy is reported to the Superintendent Pharmacist within 24 hours.",
      },
      {
        heading: "6. PPB reporting",
        body: "Submit the quarterly Controlled Substances Return via the PPB e-Portal. Export the CSV from the Omnix Controlled Register (PPB CSV button) and attach it to the submission.",
      },
      {
        heading: "7. Discrepancy investigation",
        body: "For any missing / unaccounted stock, initiate an incident report, notify PPB in writing within 48 hours, and cooperate with any subsequent audit.",
      },
    ],
  },
  prescription_handling: {
    title: "Prescription Handling & Dispensing SOP",
    sections: [
      {
        heading: "1. Prescription receipt",
        body: "Verify the prescription is legible, dated, and signed. Confirm the prescriber's KMPDC license number matches the doctors database. Refuse expired prescriptions (typically > 90 days old).",
      },
      {
        heading: "2. Patient identification",
        body: "Confirm the patient identity via national ID or an established relationship with the pharmacy. For controlled substances, record the ID number in the register.",
      },
      {
        heading: "3. Clinical review",
        body: "Before dispensing: check patient allergies, chronic conditions, and current medications. Screen for drug-drug interactions using the Omnix interaction check. Escalate any contraindicated / major interactions to the prescribing doctor before dispensing.",
      },
      {
        heading: "4. Substitution",
        body: "Only substitute a branded product with a generic if the prescription explicitly allows it OR the branded product is unavailable AND the patient has consented. Document the substitution in the dispensing record.",
      },
      {
        heading: "5. Labelling",
        body: "Every dispensed item receives a label with: patient name, drug + strength, dosage instructions, quantity, dispense date, and pharmacy name + phone. Include any cold-chain / controlled / hazard warnings automatically generated by the label module.",
      },
      {
        heading: "6. Counselling",
        body: "The dispensing pharmacist counsels the patient on: correct dose, timing relative to meals, expected side effects, storage, and what to do if a dose is missed. Ask the patient to confirm understanding.",
      },
      {
        heading: "7. Refills",
        body: "Only refill if the original prescription authorises refills. Refills follow the same clinical review workflow as the first dispense.",
      },
    ],
  },
  expiry_disposal: {
    title: "Expiry & Waste Disposal SOP",
    sections: [
      {
        heading: "1. Expiry monitoring",
        body: "Run the Omnix Expiry report weekly. Any batch expiring within 90 days is flagged for priority dispense (FEFO — first-expiry-first-out). Any batch expiring within 30 days is moved to a quarantine shelf pending review.",
      },
      {
        heading: "2. Write-off",
        body: "Expired stock is written off via the Omnix Wastage module (reason = 'expired'). This zeroes the batch quantity and records the KES value as a wastage expense.",
      },
      {
        heading: "3. Physical disposal",
        body: "Physical destruction of expired medicines follows PPB guidelines: (a) segregate controlled from non-controlled, (b) render unusable via crushing / cutting / mixing, (c) dispose via a NEMA-licensed medical waste contractor. Retain the disposal certificate for 5 years.",
      },
      {
        heading: "4. Controlled disposal",
        body: "Expired controlled substances require witnessed destruction. Two pharmacists sign the destruction record. PPB is notified in writing within 30 days.",
      },
      {
        heading: "5. Documentation",
        body: "Every write-off and physical disposal event is documented in the disposal register with date, product, batch, quantity, method, and witnessing pharmacist signatures.",
      },
    ],
  },
};

export function renderSopTemplatePdf(brand: BrandHeader, kind: SopKind): Uint8Array {
  const template = TEMPLATES[kind];
  const doc = newDoc();
  const startY = drawMasthead(doc, brand, template.title, `Standard Operating Procedure · ${new Date().toLocaleDateString()}`);

  let y = startY + 6;
  const bodyWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;

  for (const section of template.sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.heading, MARGIN_MM, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(section.body, bodyWidth);
    for (const line of lines) {
      // 6mm gutter at the bottom before wrapping to a new page.
      if (y > 280) {
        doc.addPage();
        y = MARGIN_MM;
      }
      doc.text(line, MARGIN_MM, y);
      y += 4.5;
    }
    y += 3;
  }

  // Signature line at the end of the doc.
  y += 8;
  if (y > 270) { doc.addPage(); y = MARGIN_MM + 30; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Superintendent Pharmacist signature:", MARGIN_MM, y);
  doc.line(MARGIN_MM + 60, y, MARGIN_MM + 140, y);
  y += 8;
  doc.text("Date:", MARGIN_MM, y);
  doc.line(MARGIN_MM + 15, y, MARGIN_MM + 70, y);

  drawFooter(doc, brand, 1, 1);
  return toBytes(doc);
}

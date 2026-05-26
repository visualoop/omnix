/**
 * Drug Label Service
 *
 * Generates printable thermal labels for dispensed prescriptions.
 * Labels follow Kenya Pharmacy & Poisons Board guidance:
 * patient name, drug + strength, dosage, quantity, dispense date,
 * pharmacy name, dispenser initials, warnings.
 */
import { query } from "@/lib/db";
import { BRAND } from "@/lib/brand";

export interface DrugLabel {
  prescription_id: string;
  rx_number: number;
  patient_name: string;
  patient_age: number | null;
  drug_name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  instructions: string | null;
  pharmacy_name: string;
  pharmacy_phone: string | null;
  dispenser: string;
  dispense_date: string;
  warnings: string[];
}

export async function getDrugLabelsForPrescription(prescriptionId: string): Promise<DrugLabel[]> {
  const rows = await query<{
    prescription_id: string;
    rx_number: number;
    patient_name: string;
    patient_age: number | null;
    drug_name: string;
    generic_name: string | null;
    strength: string | null;
    dosage_form: string | null;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    quantity: number;
    instructions: string | null;
    requires_prescription: number;
    is_controlled: number;
    cold_chain: number;
    storage_conditions: string | null;
    pharmacy_name: string;
    pharmacy_phone: string | null;
    dispenser: string;
    created_at: string;
  }>(
    `SELECT
       p.id AS prescription_id,
       p.rx_number,
       p.patient_name,
       p.patient_age,
       pi.product_name AS drug_name,
       ph.generic_name,
       ph.strength,
       ph.dosage_form,
       pi.dosage,
       pi.frequency,
       pi.duration,
       pi.quantity_dispensed AS quantity,
       pi.instructions,
       COALESCE(ph.requires_prescription, 0) AS requires_prescription,
       COALESCE(ph.is_controlled, 0) AS is_controlled,
       COALESCE(ph.cold_chain, 0) AS cold_chain,
       ph.storage_conditions,
       COALESCE((SELECT value FROM business_settings WHERE key = 'business.name'), ?2) AS pharmacy_name,
       (SELECT value FROM business_settings WHERE key = 'business.phone') AS pharmacy_phone,
       COALESCE(u.full_name, u.username) AS dispenser,
       p.created_at
     FROM prescriptions p
     JOIN prescription_items pi ON pi.prescription_id = p.id
     LEFT JOIN pharmacy_products ph ON ph.product_id = pi.product_id
     LEFT JOIN users u ON u.id = p.dispensed_by
     WHERE p.id = ?1 AND pi.quantity_dispensed > 0
     ORDER BY pi.product_name`,
    [prescriptionId, BRAND.module.fullName],
  );

  return rows.map((r) => {
    const warnings: string[] = [];
    if (r.is_controlled) warnings.push("CONTROLLED — keep secure");
    if (r.cold_chain) warnings.push("STORE IN FRIDGE 2-8°C");
    if (r.storage_conditions) warnings.push(r.storage_conditions);
    return {
      prescription_id: r.prescription_id,
      rx_number: r.rx_number,
      patient_name: r.patient_name,
      patient_age: r.patient_age,
      drug_name: r.drug_name,
      generic_name: r.generic_name,
      strength: r.strength,
      dosage_form: r.dosage_form,
      dosage: r.dosage,
      frequency: r.frequency,
      duration: r.duration,
      quantity: r.quantity,
      instructions: r.instructions,
      pharmacy_name: r.pharmacy_name,
      pharmacy_phone: r.pharmacy_phone,
      dispenser: r.dispenser,
      dispense_date: r.created_at,
      warnings,
    };
  });
}

export function renderDrugLabelHtml(labels: DrugLabel[]): string {
  const css = `
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #000; }
      .label {
        width: 100mm; height: 60mm;
        padding: 3mm; box-sizing: border-box;
        page-break-after: always;
        border-bottom: 1px dashed #999;
        display: flex; flex-direction: column; gap: 1mm;
      }
      .label:last-child { page-break-after: auto; border-bottom: none; }
      .header { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
      .pt-name { font-size: 11pt; font-weight: 700; margin-top: 0.5mm; }
      .pt-meta { font-size: 8pt; color: #555; }
      .drug { font-size: 10pt; font-weight: 700; margin-top: 1mm; }
      .strength { font-size: 8pt; color: #444; font-weight: 500; }
      .dosage-box {
        background: #f3f4f6; padding: 1.5mm 2mm; margin-top: 1mm;
        border-radius: 1mm; font-size: 9pt; font-weight: 600;
      }
      .footer {
        display: flex; justify-content: space-between;
        margin-top: auto; font-size: 7.5pt; color: #333;
        border-top: 1px solid #ccc; padding-top: 1mm;
      }
      .warn {
        background: #fef3c7; color: #92400e;
        padding: 1mm 2mm; font-size: 7.5pt; font-weight: 700;
        border-radius: 1mm; text-transform: uppercase;
      }
      @media print { .no-print { display: none; } }
    </style>
  `;
  const fmtDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
  };
  const labelHtml = labels.map((l) => `
    <div class="label">
      <div class="header">${escape(l.pharmacy_name)}${l.pharmacy_phone ? ` · ${escape(l.pharmacy_phone)}` : ""}</div>
      <div class="pt-name">${escape(l.patient_name)}</div>
      <div class="pt-meta">
        Rx#${l.rx_number}${l.patient_age ? ` · Age ${l.patient_age}` : ""}
        · ${fmtDate(l.dispense_date)}
      </div>
      <div class="drug">
        ${escape(l.drug_name)}
        ${l.strength ? `<span class="strength"> · ${escape(l.strength)}</span>` : ""}
        ${l.dosage_form ? `<span class="strength"> (${escape(l.dosage_form)})</span>` : ""}
      </div>
      <div class="dosage-box">
        ${escape([l.dosage, l.frequency, l.duration].filter(Boolean).join(" · ") || "Take as directed by doctor")}
        · Qty ${l.quantity}
      </div>
      ${l.instructions ? `<div style="font-size: 8pt; font-style: italic;">"${escape(l.instructions)}"</div>` : ""}
      ${l.warnings.length > 0 ? `<div class="warn">${l.warnings.map(escape).join(" · ")}</div>` : ""}
      <div class="footer">
        <span>Dispensed by ${escape(l.dispenser)}</span>
        <span>Keep out of reach of children</span>
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Drug Label</title>${css}</head>
    <body>${labelHtml}
      <script>window.onload = () => { window.print(); };</script>
    </body></html>`;
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

export async function printDrugLabels(prescriptionId: string): Promise<void> {
  const labels = await getDrugLabelsForPrescription(prescriptionId);
  if (labels.length === 0) {
    throw new Error("No dispensed items to print labels for");
  }
  const html = renderDrugLabelHtml(labels);
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) throw new Error("Pop-up blocked. Allow pop-ups to print labels.");
  w.document.write(html);
  w.document.close();
}

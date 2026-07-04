/**
 * DHA e-prescription import.
 *
 * Kenya's Digital Health Agency (DHA) runs the AfyaLink Health
 * Information Exchange (HIE). Prescribers issue e-scripts that flow to
 * the patient's chosen pharmacy. This service:
 *   1. Pulls pending e-scripts for the pharmacy's facility_code.
 *   2. Stages them in dha_eprescriptions for pharmacist review.
 *   3. On import, maps the payload to a local prescription + items,
 *      matching each drug to inventory by name and matching / creating
 *      the patient.
 *
 * The mapping is deterministic and unit-testable (see mapEprescription).
 * The HTTP fetch reuses the same AfyaLink auth flow as verifyMember.
 */
import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";
import { getProvider } from "@/services/insurance";

export interface DhaEprescription {
  id: string;
  dha_id: string;
  provider_id: string | null;
  patient_name: string;
  patient_id_number: string | null;
  patient_phone: string | null;
  patient_dob: string | null;
  patient_gender: string | null;
  prescriber_name: string | null;
  prescriber_license: string | null;
  facility_code: string | null;
  diagnosis_code: string | null;
  diagnosis_text: string | null;
  issued_at: string;
  valid_until: string | null;
  status: "pending" | "imported" | "rejected" | "expired";
  imported_prescription_id: string | null;
  fetched_at: string;
}

export interface DhaEprescriptionItem {
  id: string;
  eprescription_id: string;
  drug_name: string;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  instructions: string | null;
  matched_product_id: string | null;
}

/** Shape of an AfyaLink e-prescription payload (subset we consume). */
export interface AfyaLinkEprescription {
  eprescription_id: string;
  patient: {
    full_name: string;
    national_id?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
  };
  prescriber: {
    name?: string;
    license_number?: string;
  };
  facility_code?: string;
  diagnosis?: { code?: string; text?: string };
  issued_at: string;
  valid_until?: string;
  items: Array<{
    drug_name: string;
    strength?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity: number;
    instructions?: string;
  }>;
}

/**
 * Pure mapper — turns an AfyaLink payload into our staging-row shape.
 * Kept separate from the DB write so it's unit-testable offline.
 */
export function mapEprescription(payload: AfyaLinkEprescription, providerId: string | null): {
  header: Omit<DhaEprescription, "id" | "status" | "imported_prescription_id" | "fetched_at">;
  items: Array<Omit<DhaEprescriptionItem, "id" | "eprescription_id" | "matched_product_id">>;
} {
  return {
    header: {
      dha_id: payload.eprescription_id,
      provider_id: providerId,
      patient_name: payload.patient.full_name,
      patient_id_number: payload.patient.national_id ?? null,
      patient_phone: payload.patient.phone ?? null,
      patient_dob: payload.patient.date_of_birth ?? null,
      patient_gender: payload.patient.gender ?? null,
      prescriber_name: payload.prescriber.name ?? null,
      prescriber_license: payload.prescriber.license_number ?? null,
      facility_code: payload.facility_code ?? null,
      diagnosis_code: payload.diagnosis?.code ?? null,
      diagnosis_text: payload.diagnosis?.text ?? null,
      issued_at: payload.issued_at,
      valid_until: payload.valid_until ?? null,
    },
    items: payload.items.map((it) => ({
      drug_name: it.drug_name,
      strength: it.strength ?? null,
      dosage: it.dosage ?? null,
      frequency: it.frequency ?? null,
      duration: it.duration ?? null,
      quantity: it.quantity,
      instructions: it.instructions ?? null,
    })),
  };
}

/** Stage a payload into dha_eprescriptions (+ items). Idempotent on dha_id. */
export async function stageEprescription(payload: AfyaLinkEprescription, providerId: string | null): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM dha_eprescriptions WHERE dha_id = ?1`,
    [payload.eprescription_id],
  );
  if (existing[0]) return existing[0].id;

  const { header, items } = mapEprescription(payload, providerId);
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO dha_eprescriptions
       (id, dha_id, provider_id, patient_name, patient_id_number, patient_phone,
        patient_dob, patient_gender, prescriber_name, prescriber_license, facility_code,
        diagnosis_code, diagnosis_text, issued_at, valid_until, payload_json, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'pending')`,
    [
      id, header.dha_id, header.provider_id, header.patient_name, header.patient_id_number,
      header.patient_phone, header.patient_dob, header.patient_gender, header.prescriber_name,
      header.prescriber_license, header.facility_code, header.diagnosis_code, header.diagnosis_text,
      header.issued_at, header.valid_until, JSON.stringify(payload),
    ],
  );

  for (const item of items) {
    // Best-effort product match by name (case-insensitive contains).
    const match = await query<{ id: string }>(
      `SELECT id FROM products WHERE active = 1 AND LOWER(name) LIKE '%' || LOWER(?1) || '%' LIMIT 1`,
      [item.drug_name],
    ).catch(() => []);
    await execute(
      `INSERT INTO dha_eprescription_items
         (id, eprescription_id, drug_name, strength, dosage, frequency, duration, quantity, instructions, matched_product_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      [
        crypto.randomUUID(), id, item.drug_name, item.strength, item.dosage,
        item.frequency, item.duration, item.quantity, item.instructions,
        match[0]?.id ?? null,
      ],
    );
  }
  return id;
}

/** Fetch pending e-scripts from AfyaLink for the SHA provider's facility. */
export async function pullEprescriptions(providerId: string): Promise<{ ok: boolean; imported: number; error?: string }> {
  const provider = await getProvider(providerId);
  if (!provider) return { ok: false, imported: 0, error: "Provider not found" };
  if (!provider.api_key || !provider.api_secret) {
    return { ok: false, imported: 0, error: "AfyaLink credentials not configured" };
  }
  try {
    const baseUrl = provider.test_mode === 1
      ? "https://afyalink.dha.go.ke"
      : (provider.api_endpoint || "https://afyalink.dha.go.ke");

    const tokenRes = await fetch(`${baseUrl}/v1/hie-auth?key=${encodeURIComponent(provider.api_key)}`, {
      method: "GET",
      headers: { "Authorization": `Basic ${btoa(`${provider.api_key}:${provider.api_secret}`)}` },
    });
    if (!tokenRes.ok) return { ok: false, imported: 0, error: `HIE auth failed (${tokenRes.status})` };
    const tokenData = await tokenRes.json() as { token?: string; access_token?: string };
    const jwt = tokenData.token || tokenData.access_token;
    if (!jwt) return { ok: false, imported: 0, error: "No JWT in HIE auth response" };

    const res = await fetch(`${baseUrl}/v1/hie-eprescription-list?facility_code=${encodeURIComponent(provider.facility_code ?? "")}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${jwt}` },
    });
    if (!res.ok) return { ok: false, imported: 0, error: `HTTP ${res.status}` };
    const body = await res.json() as { prescriptions?: AfyaLinkEprescription[] };
    const list = body.prescriptions ?? [];
    let imported = 0;
    for (const p of list) {
      await stageEprescription(p, providerId);
      imported++;
    }
    return { ok: true, imported };
  } catch (e) {
    return { ok: false, imported: 0, error: String(e) };
  }
}

export async function listEprescriptions(status?: DhaEprescription["status"]): Promise<DhaEprescription[]> {
  return query<DhaEprescription>(
    `SELECT * FROM dha_eprescriptions ${status ? "WHERE status = ?1" : ""} ORDER BY issued_at DESC LIMIT 200`,
    status ? [status] : [],
  );
}

export async function getEprescriptionItems(eprescriptionId: string): Promise<DhaEprescriptionItem[]> {
  return query<DhaEprescriptionItem>(
    `SELECT * FROM dha_eprescription_items WHERE eprescription_id = ?1`,
    [eprescriptionId],
  );
}

/**
 * Promote a staged e-script to a local prescription. Matches the patient
 * by national ID or phone, creating a customer + patient_profile if none
 * exists. Maps items to matched products (skips unmatched — the
 * pharmacist resolves those manually afterward).
 */
export async function importEprescription(eprescriptionId: string, userId: string): Promise<string> {
  const [erx] = await query<DhaEprescription>(
    `SELECT * FROM dha_eprescriptions WHERE id = ?1`,
    [eprescriptionId],
  );
  if (!erx) throw new Error("E-prescription not found");
  if (erx.status === "imported") throw new Error("Already imported");

  const items = await getEprescriptionItems(eprescriptionId);
  const matched = items.filter((it) => it.matched_product_id);
  if (matched.length === 0) {
    throw new Error("No items could be matched to inventory. Match products first, then re-import.");
  }

  // Match / create patient.
  let customerId: string | null = null;
  if (erx.patient_id_number) {
    const found = await query<{ id: string }>(
      `SELECT id FROM customers WHERE national_id = ?1 LIMIT 1`,
      [erx.patient_id_number],
    ).catch(() => []);
    customerId = found[0]?.id ?? null;
  }
  if (!customerId && erx.patient_phone) {
    const found = await query<{ id: string }>(
      `SELECT id FROM customers WHERE phone = ?1 LIMIT 1`,
      [erx.patient_phone],
    ).catch(() => []);
    customerId = found[0]?.id ?? null;
  }
  if (!customerId) {
    customerId = crypto.randomUUID();
    await execute(
      `INSERT INTO customers (id, name, phone, national_id) VALUES (?1, ?2, ?3, ?4)`,
      [customerId, erx.patient_name, erx.patient_phone, erx.patient_id_number],
    ).catch(async () => {
      // national_id column may not exist on very old installs; retry without it.
      await execute(`INSERT INTO customers (id, name, phone) VALUES (?1, ?2, ?3)`,
        [customerId, erx.patient_name, erx.patient_phone]);
    });
    await execute(`INSERT OR IGNORE INTO patient_profiles (customer_id) VALUES (?1)`, [customerId]);
  }

  // Create the prescription via the standard service so doctor + rx_number
  // handling stays consistent.
  const { createPrescription } = await import("@/services/pharmacy");
  const rxId = await createPrescription({
    customer_id: customerId,
    patient_name: erx.patient_name,
    patient_phone: erx.patient_phone ?? undefined,
    doctor_name: erx.prescriber_name ?? undefined,
    doctor_license: erx.prescriber_license ?? undefined,
    diagnosis: erx.diagnosis_text ?? undefined,
    notes: `Imported from DHA e-prescription ${erx.dha_id}`,
    items: matched.map((it) => ({
      product_id: it.matched_product_id!,
      product_name: it.drug_name,
      dosage: it.dosage ?? "",
      frequency: it.frequency ?? "",
      duration: it.duration ?? "",
      quantity_prescribed: it.quantity,
      substitution_allowed: 1,
      instructions: it.instructions,
    })),
  }, userId);

  await execute(
    `UPDATE dha_eprescriptions SET status = 'imported', imported_prescription_id = ?2, imported_at = datetime('now') WHERE id = ?1`,
    [eprescriptionId, rxId],
  );
  return rxId;
}

export async function rejectEprescription(eprescriptionId: string, reason: string): Promise<void> {
  await execute(
    `UPDATE dha_eprescriptions SET status = 'rejected', rejection_reason = ?2 WHERE id = ?1`,
    [eprescriptionId, reason],
  );
}

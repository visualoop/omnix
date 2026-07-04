/**
 * Pharmacy license expiry tracker.
 *
 * Every retail pharmacy in Kenya must maintain live copies of the
 * premises registration, the superintendent pharmacist practicing
 * license, and (where applicable) a controlled-substances handling
 * permit. Expiry sneaks up — this service surfaces upcoming lapses so
 * renewal packets can be filed before PPB inspectors show up.
 */
import { query, execute } from "@/lib/db";

export type LicenseType =
  | "premises"
  | "pharmacist"
  | "ppb_annual"
  | "superintendent"
  | "controlled_permit"
  | "other";

export interface PharmacyLicense {
  id: string;
  license_type: LicenseType;
  license_number: string;
  holder_name: string | null;
  issued_at: string | null;
  expires_at: string;
  status: "active" | "expiring_soon" | "expired" | "renewed";
  notes: string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
  /** Computed at read-time: days until expiry (negative when past). */
  days_to_expiry: number;
  /** Computed at read-time: derived from days_to_expiry and stored status. */
  computed_status: "active" | "expiring_soon" | "expired" | "renewed";
}

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  premises: "Premises registration",
  pharmacist: "Pharmacist practicing license",
  ppb_annual: "PPB annual retention",
  superintendent: "Superintendent pharmacist attachment",
  controlled_permit: "Controlled substances handling permit",
  other: "Other",
};

/** List all licenses with computed days-to-expiry. Sorted by expiry ASC
 *  so the most urgent renewal is at the top. */
export async function listLicenses(): Promise<PharmacyLicense[]> {
  const rows = await query<Omit<PharmacyLicense, "days_to_expiry" | "computed_status">>(
    `SELECT * FROM pharmacy_licenses ORDER BY expires_at ASC`,
  );
  const today = new Date();
  return rows.map((r) => {
    const exp = new Date(r.expires_at);
    const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
    let computed: PharmacyLicense["computed_status"] = "active";
    if (r.status === "renewed") computed = "renewed";
    else if (days < 0) computed = "expired";
    else if (days <= 90) computed = "expiring_soon";
    return { ...r, days_to_expiry: days, computed_status: computed };
  });
}

export async function upsertLicense(input: Partial<PharmacyLicense> & {
  license_type: LicenseType;
  license_number: string;
  expires_at: string;
}): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE pharmacy_licenses SET
         license_type = ?2, license_number = ?3, holder_name = ?4,
         issued_at = ?5, expires_at = ?6, status = ?7, notes = ?8,
         document_path = ?9, updated_at = datetime('now')
       WHERE id = ?1`,
      [
        id, input.license_type, input.license_number, input.holder_name || null,
        input.issued_at || null, input.expires_at, input.status || "active",
        input.notes || null, input.document_path || null,
      ],
    );
  } else {
    await execute(
      `INSERT INTO pharmacy_licenses
         (id, license_type, license_number, holder_name, issued_at, expires_at, status, notes, document_path)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [
        id, input.license_type, input.license_number, input.holder_name || null,
        input.issued_at || null, input.expires_at, input.status || "active",
        input.notes || null, input.document_path || null,
      ],
    );
  }
  return id;
}

export async function removeLicense(id: string): Promise<void> {
  await execute(`DELETE FROM pharmacy_licenses WHERE id = ?1`, [id]);
}

/** Called by dashboards to surface a single alert count. */
export async function countExpiringLicenses(withinDays = 90): Promise<{
  expired: number;
  expiring_soon: number;
}> {
  const rows = await query<{ expired: number; expiring_soon: number }>(
    `SELECT
       SUM(CASE WHEN julianday(expires_at) < julianday('now') THEN 1 ELSE 0 END) AS expired,
       SUM(CASE WHEN julianday(expires_at) >= julianday('now')
                 AND julianday(expires_at) - julianday('now') <= ?1
                THEN 1 ELSE 0 END) AS expiring_soon
     FROM pharmacy_licenses
     WHERE status != 'renewed'`,
    [withinDays],
  );
  return rows[0] ?? { expired: 0, expiring_soon: 0 };
}

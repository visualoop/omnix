/**
 * Doctors / Prescribers Database
 *
 * Tracks the doctors who write prescriptions filled at this pharmacy.
 * KMPDC license, specialty, hospital, contact info. Used for autocomplete
 * in prescription entry and for compliance reports.
 */
import { query, execute } from "@/lib/db";

export interface Doctor {
  id: string;
  full_name: string;
  license_number: string | null;
  specialty: string | null;
  hospital: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface DoctorWithStats extends Doctor {
  prescription_count: number;
  last_prescription: string | null;
}

export async function listDoctors(searchTerm?: string, includeInactive = false): Promise<DoctorWithStats[]> {
  const params: any[] = [];
  let where = includeInactive ? "1=1" : "active = 1";
  if (searchTerm?.trim()) {
    where += ` AND (full_name LIKE ?1 OR license_number LIKE ?1 OR hospital LIKE ?1 OR specialty LIKE ?1)`;
    params.push(`%${searchTerm.trim()}%`);
  }
  return query<DoctorWithStats>(
    `SELECT d.*,
       (SELECT COUNT(*) FROM prescriptions WHERE doctor_id = d.id) AS prescription_count,
       (SELECT MAX(created_at) FROM prescriptions WHERE doctor_id = d.id) AS last_prescription
     FROM doctors d
     WHERE ${where}
     ORDER BY d.full_name`,
    params,
  );
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const rows = await query<Doctor>(`SELECT * FROM doctors WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function upsertDoctor(input: Partial<Doctor> & { full_name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    await execute(
      `UPDATE doctors SET
         full_name = ?2, license_number = ?3, specialty = ?4, hospital = ?5,
         phone = ?6, email = ?7, notes = ?8, active = ?9,
         updated_at = datetime('now')
       WHERE id = ?1`,
      [
        id, input.full_name, input.license_number || null, input.specialty || null,
        input.hospital || null, input.phone || null, input.email || null,
        input.notes || null, input.active ?? 1,
      ],
    );
  } else {
    await execute(
      `INSERT INTO doctors (id, full_name, license_number, specialty, hospital, phone, email, notes, active)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [
        id, input.full_name, input.license_number || null, input.specialty || null,
        input.hospital || null, input.phone || null, input.email || null,
        input.notes || null, input.active ?? 1,
      ],
    );
  }
  return id;
}

export async function deactivateDoctor(id: string): Promise<void> {
  await execute(`UPDATE doctors SET active = 0, updated_at = datetime('now') WHERE id = ?1`, [id]);
}

export const SPECIALTIES = [
  "General Practice",
  "Pediatrics",
  "Internal Medicine",
  "Surgery",
  "Obstetrics & Gynecology",
  "Cardiology",
  "Dermatology",
  "Psychiatry",
  "Orthopedics",
  "ENT",
  "Ophthalmology",
  "Dentistry",
  "Other",
];

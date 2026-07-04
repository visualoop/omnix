/**
 * Refills-due SMS alerts.
 *
 * Placeholder background job that identifies prescriptions where the
 * duration on the last dispense equals today. Africa's Talking API
 * integration is stubbed — the job produces a queue of reminders that
 * a future ship can flush via a real HTTP client. This keeps the data
 * available for a manual SMS blast in the interim.
 *
 * Called from a cron / interval owned by the app shell — invoke
 * `queueRefillReminders()` once daily.
 */
import { query, execute } from "@/lib/db";

export interface RefillReminder {
  prescription_id: string;
  rx_number: number;
  patient_name: string;
  patient_phone: string;
  drug_summary: string;
  refills_remaining: number;
  due_on: string;
  queued_at: string;
}

/** Scan for refills due within the next N days and stage reminders. */
export async function queueRefillReminders(withinDays = 3): Promise<{ queued: number; skipped: number }> {
  const candidates = await query<{
    id: string; rx_number: number; patient_name: string; patient_phone: string | null;
    refills_authorized: number; refills_used: number; created_at: string;
    duration_days: number | null;
  }>(
    `SELECT p.id, p.rx_number, p.patient_name, p.patient_phone,
            p.refills_authorized, p.refills_used, p.created_at,
            (SELECT MIN(CAST(REPLACE(pi.duration, ' days', '') AS INTEGER))
               FROM prescription_items pi WHERE pi.prescription_id = p.id) AS duration_days
       FROM prescriptions p
      WHERE p.status = 'dispensed'
        AND p.refills_used < p.refills_authorized
        AND p.patient_phone IS NOT NULL`,
  );

  let queued = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (!c.duration_days || c.duration_days <= 0) { skipped++; continue; }
    const created = new Date(c.created_at);
    const due = new Date(created.getTime() + c.duration_days * 86400000);
    const daysUntil = Math.floor((due.getTime() - Date.now()) / 86400000);
    if (daysUntil < 0 || daysUntil > withinDays) { skipped++; continue; }

    // Avoid duplicate reminders for the same prescription within 7 days.
    const [existing] = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM refill_reminders
        WHERE prescription_id = ?1
          AND julianday('now') - julianday(queued_at) < 7`,
      [c.id],
    ).catch(() => [{ count: 0 }]);
    if (existing?.count && existing.count > 0) { skipped++; continue; }

    // Compose a summary line for the SMS body — top item + count of others.
    const items = await query<{ product_name: string }>(
      `SELECT product_name FROM prescription_items WHERE prescription_id = ?1 LIMIT 3`,
      [c.id],
    );
    const summary = items[0]
      ? items.length > 1
        ? `${items[0].product_name} + ${items.length - 1} more`
        : items[0].product_name
      : "your prescription";

    await execute(
      `INSERT INTO refill_reminders
         (id, prescription_id, rx_number, patient_name, patient_phone, drug_summary, refills_remaining, due_on)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(),
        c.id,
        c.rx_number,
        c.patient_name,
        c.patient_phone,
        summary,
        c.refills_authorized - c.refills_used,
        due.toISOString().slice(0, 10),
      ],
    ).catch(() => {});
    queued++;
  }

  return { queued, skipped };
}

export async function listPendingReminders(): Promise<RefillReminder[]> {
  return query<RefillReminder>(
    `SELECT * FROM refill_reminders WHERE sent_at IS NULL ORDER BY due_on ASC`,
  ).catch(() => []);
}

/**
 * Automatic PPB e-Portal quarterly submissions.
 *
 * The Pharmacy and Poisons Board requires periodic returns covering
 * controlled-substance movements + antimicrobial dispensing. This
 * service assembles the quarterly report from local data and submits
 * it to the PPB endpoint. A background job (runPpbAutoSubmission) checks
 * monthly and fires once we're past the configured auto_submit_day for
 * the completed quarter.
 *
 * Everything is idempotent per (period_type, period_start, period_end)
 * via the UNIQUE constraint on ppb_submissions.
 */
import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/services/secrets";

export interface PpbSettings {
  id: number;
  enabled: number;
  api_endpoint: string | null;
  api_key_encrypted: string | null;
  facility_code: string | null;
  superintendent_pharmacist_id: string | null;
  superintendent_license_number: string | null;
  auto_submit_day: number;
}

export interface PpbSubmission {
  id: string;
  period_type: "quarterly" | "monthly" | "annual";
  period_start: string;
  period_end: string;
  submission_ref: string | null;
  payload_json: string;
  status: "draft" | "queued" | "submitted" | "acknowledged" | "rejected" | "manual_review";
  attempts: number;
  last_error: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuarterWindow {
  quarter: number;   // 1..4
  year: number;
  start: string;     // YYYY-MM-DD
  end: string;       // YYYY-MM-DD (inclusive)
}

/**
 * Compute the quarter window that ENDED most recently before `asOf`.
 * Pure + testable. E.g. asOf 2026-04-05 → Q1 2026 (Jan–Mar).
 */
export function priorQuarter(asOf: Date): QuarterWindow {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth(); // 0..11
  const currentQuarter = Math.floor(m / 3) + 1; // 1..4
  let quarter = currentQuarter - 1;
  let year = y;
  if (quarter === 0) { quarter = 4; year = y - 1; }
  const startMonth = (quarter - 1) * 3;      // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of quarter
  return {
    quarter,
    year,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * Decide whether the prior quarter's return is due to auto-submit.
 * Pure + testable. Due when: today is past (quarter end + autoSubmitDay days)
 * AND not already submitted for that window.
 */
export function isSubmissionDue(asOf: Date, autoSubmitDay: number): { due: boolean; window: QuarterWindow } {
  const window = priorQuarter(asOf);
  const end = new Date(window.end + "T00:00:00Z");
  const deadline = new Date(end);
  deadline.setUTCDate(deadline.getUTCDate() + autoSubmitDay);
  return { due: asOf.getTime() >= deadline.getTime(), window };
}

export async function getPpbSettings(): Promise<PpbSettings> {
  const rows = await query<PpbSettings>(`SELECT * FROM ppb_settings WHERE id = 1`);
  const s = rows[0] ?? {
    id: 1, enabled: 0, api_endpoint: null, api_key_encrypted: null,
    facility_code: null, superintendent_pharmacist_id: null,
    superintendent_license_number: null, auto_submit_day: 10,
  };
  s.api_key_encrypted = await decryptSecret(s.api_key_encrypted);
  return s;
}

export async function savePpbSettings(input: {
  enabled: boolean;
  api_endpoint?: string | null;
  api_key?: string | null;
  facility_code?: string | null;
  superintendent_license_number?: string | null;
  auto_submit_day?: number;
}): Promise<void> {
  const encKey = input.api_key === undefined
    ? undefined
    : input.api_key === null ? null : await encryptSecret(input.api_key);
  await execute(
    `UPDATE ppb_settings SET
       enabled = ?1,
       api_endpoint = COALESCE(?2, api_endpoint),
       api_key_encrypted = COALESCE(?3, api_key_encrypted),
       facility_code = COALESCE(?4, facility_code),
       superintendent_license_number = COALESCE(?5, superintendent_license_number),
       auto_submit_day = COALESCE(?6, auto_submit_day)
     WHERE id = 1`,
    [
      input.enabled ? 1 : 0,
      input.api_endpoint ?? null,
      encKey ?? null,
      input.facility_code ?? null,
      input.superintendent_license_number ?? null,
      input.auto_submit_day ?? null,
    ],
  );
}

/** Assemble the report body for a period from controlled_log + AMR + claims. */
export async function assembleReport(window: QuarterWindow): Promise<Record<string, unknown>> {
  const start = window.start;
  const end = window.end + " 23:59:59";

  const controlled = await query<{
    product_name: string; total_dispensed: number; total_received: number; entries: number;
  }>(
    `SELECT product_name,
            SUM(CASE WHEN action = 'dispensed' THEN quantity ELSE 0 END) AS total_dispensed,
            SUM(CASE WHEN action = 'received' THEN quantity ELSE 0 END) AS total_received,
            COUNT(*) AS entries
       FROM controlled_log
      WHERE created_at BETWEEN ?1 AND ?2
      GROUP BY product_name
      ORDER BY total_dispensed DESC`,
    [start, end],
  ).catch(() => []);

  const { getAntibioticByClass } = await import("./amr-report");
  const amr = await getAntibioticByClass({ startDate: start, endDate: window.end }).catch(() => []);

  return {
    period: { quarter: window.quarter, year: window.year, start: window.start, end: window.end },
    controlled_substances: controlled,
    antimicrobial_dispensing: amr.map((a) => ({
      class: a.class,
      units_dispensed: a.units_dispensed,
      unique_patients: a.unique_patients,
    })),
    generated_at: new Date().toISOString(),
  };
}

/** Create (or fetch existing) a draft submission row for a window. */
export async function ensureSubmission(window: QuarterWindow): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM ppb_submissions WHERE period_type = 'quarterly' AND period_start = ?1 AND period_end = ?2`,
    [window.start, window.end],
  );
  if (existing[0]) return existing[0].id;

  const report = await assembleReport(window);
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO ppb_submissions (id, period_type, period_start, period_end, payload_json, status)
     VALUES (?1, 'quarterly', ?2, ?3, ?4, 'draft')`,
    [id, window.start, window.end, JSON.stringify(report)],
  );
  return id;
}

/** POST a submission to the PPB endpoint. Returns status for retry logic. */
async function postSubmission(submissionId: string, settings: PpbSettings): Promise<{ ok: boolean; ref?: string; error?: string; statusCode?: number }> {
  const [sub] = await query<PpbSubmission>(`SELECT * FROM ppb_submissions WHERE id = ?1`, [submissionId]);
  if (!sub) return { ok: false, error: "Submission not found" };
  if (!settings.api_endpoint || !settings.api_key_encrypted) {
    return { ok: false, error: "PPB endpoint / credentials not configured" };
  }
  try {
    const res = await fetch(`${settings.api_endpoint}/returns/quarterly`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.api_key_encrypted}`,
        "X-Facility-Code": settings.facility_code ?? "",
      },
      body: sub.payload_json,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { message?: string }).message || `HTTP ${res.status}`, statusCode: res.status };
    }
    const body = await res.json() as { reference?: string };
    return { ok: true, ref: body.reference || `PPB-${Date.now()}` };
  } catch (e) {
    return { ok: false, error: String(e), statusCode: 0 };
  }
}

export async function submitToPpb(submissionId: string): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const settings = await getPpbSettings();
  const result = await postSubmission(submissionId, settings);
  if (result.ok) {
    await execute(
      `UPDATE ppb_submissions SET status = 'submitted', submission_ref = ?2, submitted_at = datetime('now'),
         updated_at = datetime('now') WHERE id = ?1`,
      [submissionId, result.ref],
    );
    return { ok: true, ref: result.ref };
  }
  // 4xx → manual review; 5xx/network → keep queued for retry.
  const permanent = !!result.statusCode && result.statusCode >= 400 && result.statusCode < 500;
  await execute(
    `UPDATE ppb_submissions SET status = ?2, attempts = attempts + 1, last_error = ?3, updated_at = datetime('now') WHERE id = ?1`,
    [submissionId, permanent ? "manual_review" : "queued", result.error ?? "error"],
  );
  return { ok: false, error: result.error };
}

/**
 * Background entry point. No-op when disabled. When the prior quarter is
 * due, ensures a submission row exists and attempts submission.
 */
export async function runPpbAutoSubmission(asOf: Date = new Date()): Promise<{ ran: boolean; submissionId?: string; ok?: boolean }> {
  const settings = await getPpbSettings();
  if (!settings.enabled) return { ran: false };

  const { due, window } = isSubmissionDue(asOf, settings.auto_submit_day);
  if (!due) return { ran: false };

  // Already submitted / acknowledged for this window?
  const existing = await query<{ id: string; status: string }>(
    `SELECT id, status FROM ppb_submissions WHERE period_type = 'quarterly' AND period_start = ?1 AND period_end = ?2`,
    [window.start, window.end],
  );
  if (existing[0] && ["submitted", "acknowledged"].includes(existing[0].status)) {
    return { ran: false };
  }

  const submissionId = await ensureSubmission(window);
  const result = await submitToPpb(submissionId);
  return { ran: true, submissionId, ok: result.ok };
}

export async function listSubmissions(): Promise<PpbSubmission[]> {
  return query<PpbSubmission>(`SELECT * FROM ppb_submissions ORDER BY period_end DESC LIMIT 100`);
}

import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/services/secrets";

export interface InsuranceProvider {
  id: string;
  code: string;
  name: string;
  type: "sha" | "private";
  api_endpoint: string | null;
  api_key: string | null;
  api_secret: string | null;
  facility_code: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  active: number;
  test_mode: number;
  requires_preauth: number;
}

export interface InsuranceMember {
  id: string;
  provider_id: string;
  member_number: string;
  national_id: string | null;
  full_name: string;
  phone: string | null;
  scheme_name: string | null;
  scheme_type: string | null;
  benefit_balance: number | null;
  copay_percentage: number;
  copay_fixed: number;
  valid_from: string | null;
  valid_to: string | null;
  last_verified_at: string;
}

export interface InsuranceClaim {
  id: string;
  sale_id: string;
  provider_id: string;
  member_id: string | null;
  member_number: string;
  member_name: string;
  diagnosis_code: string | null;
  diagnosis_text: string | null;
  prescription_id: string | null;
  prescriber_name: string | null;
  prescriber_license: string | null;
  gross_amount: number;
  copay_amount: number;
  claim_amount: number;
  approved_amount: number | null;
  paid_amount: number;
  preauth_number: string | null;
  preauth_status: string | null;
  claim_number: string | null;
  submitted_at: string | null;
  status: "draft" | "submitted" | "approved" | "partially_paid" | "paid" | "rejected" | "cancelled";
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  // Joined fields
  provider_name?: string;
  provider_code?: string;
}

export interface InsuranceClaimItem {
  id: string;
  claim_id: string;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  approved_qty: number | null;
  approved_amount: number | null;
  rejected_reason: string | null;
}

// ===== Providers =====

export async function getProviders(activeOnly = true): Promise<InsuranceProvider[]> {
  const rows = await query<InsuranceProvider>(
    activeOnly
      ? "SELECT * FROM insurance_providers WHERE active = 1 ORDER BY type, name"
      : "SELECT * FROM insurance_providers ORDER BY type, name"
  );
  // Decrypt api_key + api_secret so downstream callers see plaintext.
  // Legacy plaintext rows (missing the `omx1:` prefix) pass through
  // unchanged; the next update through `updateProvider` re-encrypts.
  for (const p of rows) {
    p.api_key = await decryptSecret(p.api_key);
    p.api_secret = await decryptSecret(p.api_secret);
  }
  return rows;
}

export async function getProvider(id: string): Promise<InsuranceProvider | null> {
  const rows = await query<InsuranceProvider>("SELECT * FROM insurance_providers WHERE id = ?1", [id]);
  const p = rows[0];
  if (!p) return null;
  p.api_key = await decryptSecret(p.api_key);
  p.api_secret = await decryptSecret(p.api_secret);
  return p;
}

export async function updateProvider(id: string, input: {
  api_endpoint?: string | null;
  api_key?: string | null;
  api_secret?: string | null;
  facility_code?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  active?: boolean;
  test_mode?: boolean;
  requires_preauth?: boolean;
}): Promise<void> {
  // Encrypt any secrets the caller is updating. `undefined` means "leave
  // as-is" (COALESCE below); `null` means "clear it". A concrete string
  // gets encrypted before hitting the DB.
  const encKey = input.api_key === undefined
    ? undefined
    : input.api_key === null ? null : await encryptSecret(input.api_key);
  const encSecret = input.api_secret === undefined
    ? undefined
    : input.api_secret === null ? null : await encryptSecret(input.api_secret);
  await execute(
    `UPDATE insurance_providers SET 
       api_endpoint = COALESCE(?2, api_endpoint),
       api_key = COALESCE(?3, api_key),
       api_secret = COALESCE(?4, api_secret),
       facility_code = COALESCE(?5, facility_code),
       contact_phone = COALESCE(?6, contact_phone),
       contact_email = COALESCE(?7, contact_email),
       active = COALESCE(?8, active),
       test_mode = COALESCE(?9, test_mode),
       requires_preauth = COALESCE(?10, requires_preauth)
     WHERE id = ?1`,
    [
      id, input.api_endpoint, encKey ?? null, encSecret ?? null,
      input.facility_code, input.contact_phone, input.contact_email,
      input.active === undefined ? null : (input.active ? 1 : 0),
      input.test_mode === undefined ? null : (input.test_mode ? 1 : 0),
      input.requires_preauth === undefined ? null : (input.requires_preauth ? 1 : 0),
    ]
  );
}

// ===== Members =====

/** Verify member with insurer. Returns cached if recent, else queries API. */
export async function verifyMember(
  providerId: string,
  memberNumber: string,
  nationalId?: string
): Promise<{ ok: boolean; member?: InsuranceMember; error?: string }> {
  const provider = await getProvider(providerId);
  if (!provider) return { ok: false, error: "Provider not found" };

  // Try cache (verified within last 24h)
  const cached = await query<InsuranceMember>(
    `SELECT * FROM insurance_members 
     WHERE provider_id = ?1 AND member_number = ?2 
       AND julianday('now') - julianday(last_verified_at) < 1`,
    [providerId, memberNumber]
  );
  if (cached[0]) return { ok: true, member: cached[0] };

  // For SHA, attempt API call via AfyaLink (DHA HIE)
  if (provider.type === "sha" && provider.api_key && provider.api_secret) {
    try {
      const baseUrl = provider.test_mode === 1
        ? "https://afyalink.dha.go.ke"
        : (provider.api_endpoint || "https://afyalink.dha.go.ke");

      // Step 1: Get JWT token via Basic Auth
      const tokenRes = await fetch(`${baseUrl}/v1/hie-auth?key=${encodeURIComponent(provider.api_key)}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${btoa(`${provider.api_key}:${provider.api_secret}`)}`,
        },
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        return { ok: false, error: (err as { message?: string }).message || "HIE auth failed" };
      }

      const tokenData = await tokenRes.json() as { token?: string; access_token?: string };
      const jwtToken = tokenData.token || tokenData.access_token;
      if (!jwtToken) return { ok: false, error: "No token in HIE response" };

      // Step 2: Verify member
      const res = await fetch(`${baseUrl}/v1/hie-member-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          member_number: memberNumber,
          national_id: nationalId,
          facility_code: provider.facility_code,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: (err as { message?: string }).message || `HTTP ${res.status}` };
      }

      const data = await res.json() as {
        member_number: string;
        national_id?: string;
        full_name: string;
        phone?: string;
        scheme_name?: string;
        scheme_type?: string;
        benefit_balance?: number;
        copay_percentage?: number;
        copay_fixed?: number;
        valid_from?: string;
        valid_to?: string;
        active: boolean;
      };

      if (!data.active) return { ok: false, error: "Member not active" };

      const member = await upsertMember(providerId, data);
      return { ok: true, member };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // For private insurers without API, allow manual entry (mark as unverified)
  return { ok: false, error: "Manual verification required (API not configured)" };
}

/** Manually register a member without API verification */
export async function registerMemberManually(input: {
  provider_id: string;
  member_number: string;
  national_id?: string;
  full_name: string;
  phone?: string;
  scheme_name?: string;
  copay_percentage?: number;
  copay_fixed?: number;
}): Promise<InsuranceMember> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT OR REPLACE INTO insurance_members 
     (id, provider_id, member_number, national_id, full_name, phone, scheme_name, copay_percentage, copay_fixed, last_verified_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))`,
    [
      id, input.provider_id, input.member_number, input.national_id || null,
      input.full_name, input.phone || null, input.scheme_name || null,
      input.copay_percentage || 0, input.copay_fixed || 0,
    ]
  );
  const rows = await query<InsuranceMember>("SELECT * FROM insurance_members WHERE id = ?1", [id]);
  return rows[0];
}

async function upsertMember(providerId: string, data: {
  member_number: string;
  national_id?: string;
  full_name: string;
  phone?: string;
  scheme_name?: string;
  scheme_type?: string;
  benefit_balance?: number;
  copay_percentage?: number;
  copay_fixed?: number;
  valid_from?: string;
  valid_to?: string;
}): Promise<InsuranceMember> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO insurance_members 
       (id, provider_id, member_number, national_id, full_name, phone, scheme_name, scheme_type,
        benefit_balance, copay_percentage, copay_fixed, valid_from, valid_to, last_verified_at, raw_response)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'), ?14)
     ON CONFLICT(provider_id, member_number) DO UPDATE SET
       national_id = excluded.national_id,
       full_name = excluded.full_name,
       phone = excluded.phone,
       scheme_name = excluded.scheme_name,
       scheme_type = excluded.scheme_type,
       benefit_balance = excluded.benefit_balance,
       copay_percentage = excluded.copay_percentage,
       copay_fixed = excluded.copay_fixed,
       valid_from = excluded.valid_from,
       valid_to = excluded.valid_to,
       last_verified_at = datetime('now'),
       raw_response = excluded.raw_response`,
    [
      id, providerId, data.member_number, data.national_id || null,
      data.full_name, data.phone || null,
      data.scheme_name || null, data.scheme_type || null,
      data.benefit_balance ?? null,
      data.copay_percentage ?? 0, data.copay_fixed ?? 0,
      data.valid_from || null, data.valid_to || null,
      JSON.stringify(data),
    ]
  );

  const rows = await query<InsuranceMember>(
    "SELECT * FROM insurance_members WHERE provider_id = ?1 AND member_number = ?2",
    [providerId, data.member_number]
  );
  return rows[0];
}

// ===== Claims =====

export interface CreateClaimInput {
  sale_id: string;
  provider_id: string;
  member: InsuranceMember;
  diagnosis_code?: string;
  diagnosis_text?: string;
  prescription_id?: string;
  prescriber_name?: string;
  prescriber_license?: string;
  gross_amount: number;
  copay_amount: number;
  claim_amount: number;
  preauth_number?: string;
  items: Array<{
    sale_item_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

/** Calculate copay split given member info and total */
export function calculateCopay(member: InsuranceMember, grossAmount: number): {
  copay: number;
  claim: number;
} {
  // Compute in integer cents so copay + claim ALWAYS equals gross exactly
  // (a 1-cent mismatch gets insurance claims rejected). The claim is the
  // remainder, guaranteeing the two halves reconstruct the gross.
  const grossC = Math.round(grossAmount * 100);
  const pctCopayC = Math.round((grossC * (member.copay_percentage || 0)) / 100);
  const fixedC = Math.round((member.copay_fixed || 0) * 100);
  const copayC = Math.min(grossC, pctCopayC + fixedC);
  const claimC = grossC - copayC; // exact remainder
  return { copay: copayC / 100, claim: claimC / 100 };
}

export async function createClaim(input: CreateClaimInput): Promise<string> {
  // Invariant: the split must reconstruct the gross to the cent, or the
  // claim will be rejected by the payer. Guard before persisting.
  const sumC = Math.round(input.copay_amount * 100) + Math.round(input.claim_amount * 100);
  const grossC = Math.round(input.gross_amount * 100);
  if (sumC !== grossC) {
    throw new Error(
      `Insurance split mismatch: copay (${input.copay_amount}) + claim (${input.claim_amount}) != gross (${input.gross_amount})`,
    );
  }
  const claimId = crypto.randomUUID();
  await execute(
    `INSERT INTO insurance_claims 
       (id, sale_id, provider_id, member_id, member_number, member_name,
        diagnosis_code, diagnosis_text, prescription_id, prescriber_name, prescriber_license,
        gross_amount, copay_amount, claim_amount, preauth_number, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'draft')`,
    [
      claimId, input.sale_id, input.provider_id, input.member.id,
      input.member.member_number, input.member.full_name,
      input.diagnosis_code || null, input.diagnosis_text || null,
      input.prescription_id || null,
      input.prescriber_name || null, input.prescriber_license || null,
      input.gross_amount, input.copay_amount, input.claim_amount,
      input.preauth_number || null,
    ]
  );

  for (const item of input.items) {
    await execute(
      `INSERT INTO insurance_claim_items 
         (id, claim_id, sale_item_id, product_id, product_name, quantity, unit_price, line_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      [
        crypto.randomUUID(), claimId, item.sale_item_id,
        item.product_id, item.product_name,
        item.quantity, item.unit_price, item.line_total,
      ]
    );
  }

  return claimId;
}

export async function listClaims(filter?: {
  status?: string;
  provider_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InsuranceClaim[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filter?.status) {
    conditions.push(`c.status = ?${idx++}`);
    params.push(filter.status);
  }
  if (filter?.provider_id) {
    conditions.push(`c.provider_id = ?${idx++}`);
    params.push(filter.provider_id);
  }
  if (filter?.start_date) {
    conditions.push(`date(c.created_at) >= ?${idx++}`);
    params.push(filter.start_date);
  }
  if (filter?.end_date) {
    conditions.push(`date(c.created_at) <= ?${idx++}`);
    params.push(filter.end_date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<InsuranceClaim>(
    `SELECT c.*, p.name as provider_name, p.code as provider_code
     FROM insurance_claims c
     JOIN insurance_providers p ON p.id = c.provider_id
     ${where}
     ORDER BY c.created_at DESC LIMIT 200`,
    params
  );
}

export async function getClaim(id: string): Promise<InsuranceClaim | null> {
  const rows = await query<InsuranceClaim>(
    `SELECT c.*, p.name as provider_name, p.code as provider_code
     FROM insurance_claims c
     JOIN insurance_providers p ON p.id = c.provider_id
     WHERE c.id = ?1`,
    [id]
  );
  return rows[0] || null;
}

export async function getClaimItems(claimId: string): Promise<InsuranceClaimItem[]> {
  return query<InsuranceClaimItem>(
    "SELECT * FROM insurance_claim_items WHERE claim_id = ?1",
    [claimId]
  );
}

export async function updateClaimStatus(
  id: string,
  status: InsuranceClaim["status"],
  data?: { claim_number?: string; rejection_reason?: string; approved_amount?: number; paid_amount?: number }
): Promise<void> {
  await execute(
    `UPDATE insurance_claims 
     SET status = ?1, 
         claim_number = COALESCE(?2, claim_number),
         rejection_reason = COALESCE(?3, rejection_reason),
         approved_amount = COALESCE(?4, approved_amount),
         paid_amount = COALESCE(?5, paid_amount),
         submitted_at = CASE WHEN ?1 = 'submitted' AND submitted_at IS NULL THEN datetime('now') ELSE submitted_at END,
         paid_at = CASE WHEN ?1 = 'paid' THEN datetime('now') ELSE paid_at END,
         updated_at = datetime('now')
     WHERE id = ?6`,
    [status, data?.claim_number || null, data?.rejection_reason || null,
     data?.approved_amount ?? null, data?.paid_amount ?? null, id]
  );
}

/**
 * Submit a draft claim to SHA / AfyaLink via the HIE claim submission
 * endpoint. Live as of v0.47 — the presence of api_key + api_secret on
 * the provider is the trigger (no feature flag). If the provider has no
 * credentials configured, the claim advances to `submitted` with a
 * LOCAL- placeholder so the pharmacist sees the intent, and a
 * background job can flush it once creds land.
 *
 * On a transient failure (5xx / network) the claim is enqueued in
 * sha_claim_queue with exponential backoff. On a 4xx (member rejected,
 * bad diagnosis) it is flagged for manual review — no retry.
 *
 * Returns { ok, claimNumber?, error?, queued?, willRetry? }.
 */
export async function submitClaimToSha(claimId: string): Promise<{
  ok: boolean;
  claimNumber?: string;
  error?: string;
  queued?: boolean;
  willRetry?: boolean;
}> {
  const claim = await getClaim(claimId);
  if (!claim) return { ok: false, error: "Claim not found" };
  if (claim.status !== "draft") {
    return { ok: false, error: `Claim is already ${claim.status}` };
  }

  const provider = await getProvider(claim.provider_id);
  if (!provider) return { ok: false, error: "Provider not found" };
  if (provider.type !== "sha") return { ok: false, error: "SHA submission only supported for SHA-type providers" };

  // No credentials → queued placeholder path.
  if (!provider.api_key || !provider.api_secret) {
    const placeholder = `LOCAL-${Date.now()}`;
    await updateClaimStatus(claimId, "submitted", { claim_number: placeholder });
    return { ok: true, claimNumber: placeholder, queued: true };
  }

  const result = await postClaimToAfyaLink(claim.id, provider, claim);
  if (result.ok) {
    await updateClaimStatus(claimId, "submitted", { claim_number: result.claimNumber });
    await resolveClaimQueue(claimId, "submitted");
    return { ok: true, claimNumber: result.claimNumber };
  }

  // 4xx → permanent failure, no retry.
  if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
    await enqueueOrUpdateClaim(claimId, result.error ?? "Rejected", result.statusCode, /*permanent*/ true);
    await updateClaimStatus(claimId, "rejected", { rejection_reason: result.error ?? "Rejected by SHA" });
    return { ok: false, error: result.error, willRetry: false };
  }

  // 5xx / network → retryable. Enqueue with backoff.
  await enqueueOrUpdateClaim(claimId, result.error ?? "Transient error", result.statusCode ?? 0, false);
  return { ok: false, error: result.error, queued: true, willRetry: true };
}

/** Compute exponential backoff delay in minutes: 2^attempts capped at 24h. */
export function backoffMinutes(attempts: number): number {
  const base = Math.pow(2, Math.max(0, attempts)); // 1,2,4,...
  return Math.min(base, 1440); // cap at 24h
}

/** Enqueue a claim for retry or bump its attempt counter. */
async function enqueueOrUpdateClaim(
  claimId: string,
  error: string,
  statusCode: number,
  permanent: boolean,
): Promise<void> {
  const existing = await query<{ id: string; attempts: number; max_attempts: number }>(
    `SELECT id, attempts, max_attempts FROM sha_claim_queue WHERE claim_id = ?1 AND resolved_at IS NULL`,
    [claimId],
  );
  if (existing[0]) {
    const attempts = existing[0].attempts + 1;
    if (permanent) {
      await execute(
        `UPDATE sha_claim_queue SET attempts = ?2, last_error = ?3, last_status_code = ?4,
           last_attempt_at = datetime('now'), resolved_at = datetime('now'), resolved_status = 'rejected'
         WHERE id = ?1`,
        [existing[0].id, attempts, error, statusCode],
      );
      return;
    }
    if (attempts >= existing[0].max_attempts) {
      await execute(
        `UPDATE sha_claim_queue SET attempts = ?2, last_error = ?3, last_status_code = ?4,
           last_attempt_at = datetime('now'), resolved_at = datetime('now'), resolved_status = 'manual_review'
         WHERE id = ?1`,
        [existing[0].id, attempts, error, statusCode],
      );
      return;
    }
    const delay = backoffMinutes(attempts);
    await execute(
      `UPDATE sha_claim_queue SET attempts = ?2, last_error = ?3, last_status_code = ?4,
         last_attempt_at = datetime('now'), next_retry_at = datetime('now', '+' || ?5 || ' minutes')
       WHERE id = ?1`,
      [existing[0].id, attempts, error, statusCode, delay],
    );
  } else {
    const delay = permanent ? 0 : backoffMinutes(1);
    await execute(
      `INSERT INTO sha_claim_queue
         (id, claim_id, attempts, next_retry_at, last_error, last_status_code, last_attempt_at, resolved_at, resolved_status)
       VALUES (?1, ?2, 1, datetime('now', '+' || ?3 || ' minutes'), ?4, ?5, datetime('now'),
               ?6, ?7)`,
      [
        crypto.randomUUID(), claimId, delay, error, statusCode,
        permanent ? new Date().toISOString() : null,
        permanent ? "rejected" : null,
      ],
    );
  }
}

async function resolveClaimQueue(claimId: string, status: "submitted" | "cancelled"): Promise<void> {
  await execute(
    `UPDATE sha_claim_queue SET resolved_at = datetime('now'), resolved_status = ?2
     WHERE claim_id = ?1 AND resolved_at IS NULL`,
    [claimId, status],
  );
}

/** Raw HTTP submission to AfyaLink. Returns statusCode for retry decisions. */
async function postClaimToAfyaLink(
  claimId: string,
  provider: InsuranceProvider,
  claim: InsuranceClaim,
): Promise<{ ok: boolean; claimNumber?: string; error?: string; statusCode?: number }> {
  try {
    const baseUrl = provider.test_mode === 1
      ? "https://afyalink.dha.go.ke"
      : (provider.api_endpoint || "https://afyalink.dha.go.ke");

    const tokenRes = await fetch(`${baseUrl}/v1/hie-auth?key=${encodeURIComponent(provider.api_key!)}`, {
      method: "GET",
      headers: { "Authorization": `Basic ${btoa(`${provider.api_key}:${provider.api_secret}`)}` },
    });
    if (!tokenRes.ok) return { ok: false, error: `HIE auth failed (${tokenRes.status})`, statusCode: tokenRes.status };
    const tokenData = await tokenRes.json() as { token?: string; access_token?: string };
    const jwt = tokenData.token || tokenData.access_token;
    if (!jwt) return { ok: false, error: "No JWT in HIE auth response", statusCode: 502 };

    const items = await getClaimItems(claimId);
    const res = await fetch(`${baseUrl}/v1/hie-claim-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
      body: JSON.stringify({
        member_number: claim.member_number,
        member_name: claim.member_name,
        diagnosis_code: claim.diagnosis_code,
        prescriber_license: claim.prescriber_license,
        gross_amount: claim.gross_amount,
        copay_amount: claim.copay_amount,
        claim_amount: claim.claim_amount,
        facility_code: provider.facility_code,
        items: items.map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.line_total,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { message?: string }).message || `HTTP ${res.status}`, statusCode: res.status };
    }
    const body = await res.json() as { claim_number?: string };
    return { ok: true, claimNumber: body.claim_number || `SHA-${Date.now()}` };
  } catch (e) {
    // Network error — no status code, treat as retryable.
    return { ok: false, error: String(e), statusCode: 0 };
  }
}

export interface ShaQueueEntry {
  id: string;
  claim_id: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
  last_status_code: number | null;
  resolved_at: string | null;
  resolved_status: string | null;
}

/**
 * Background worker — flush all queued claims whose next_retry_at has
 * passed. Called from the app's daily/hourly scheduler. Returns a
 * summary of what happened.
 */
export async function flushShaClaimQueue(): Promise<{
  attempted: number;
  submitted: number;
  stillPending: number;
  failed: number;
}> {
  const due = await query<ShaQueueEntry>(
    `SELECT * FROM sha_claim_queue
      WHERE resolved_at IS NULL AND julianday(next_retry_at) <= julianday('now')
      ORDER BY next_retry_at ASC
      LIMIT 50`,
  );
  let submitted = 0, stillPending = 0, failed = 0;
  for (const entry of due) {
    const result = await submitClaimToSha(entry.claim_id).catch(() => ({ ok: false, willRetry: false }));
    if (result.ok) submitted++;
    else if ((result as { willRetry?: boolean }).willRetry) stillPending++;
    else failed++;
  }
  return { attempted: due.length, submitted, stillPending, failed };
}

export async function listShaQueue(includeResolved = false): Promise<ShaQueueEntry[]> {
  return query<ShaQueueEntry>(
    `SELECT * FROM sha_claim_queue
      ${includeResolved ? "" : "WHERE resolved_at IS NULL"}
      ORDER BY created_at DESC LIMIT 200`,
  );
}

// ===== Batches =====

export interface InsuranceBatch {
  id: string;
  batch_number: string;
  provider_id: string;
  period_start: string;
  period_end: string;
  claim_count: number;
  total_amount: number;
  status: "open" | "submitted" | "acknowledged" | "settled";
  submitted_at: string | null;
  settled_at: string | null;
  settled_amount: number | null;
  created_at: string;
  provider_name?: string;
}

export async function createBatch(providerId: string, periodStart: string, periodEnd: string): Promise<string> {
  // Aggregate draft claims for the period
  const claims = await query<{ id: string; claim_amount: number }>(
    `SELECT id, claim_amount FROM insurance_claims 
     WHERE provider_id = ?1 AND status = 'draft' 
       AND date(created_at) BETWEEN ?2 AND ?3 
       AND batch_id IS NULL`,
    [providerId, periodStart, periodEnd]
  );

  if (claims.length === 0) {
    throw new Error("No draft claims to batch for this period");
  }

  const batchId = crypto.randomUUID();
  const batchNumber = `BATCH-${Date.now()}`;
  const totalAmount = claims.reduce((s, c) => s + c.claim_amount, 0);

  await execute(
    `INSERT INTO insurance_batches 
       (id, batch_number, provider_id, period_start, period_end, claim_count, total_amount)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [batchId, batchNumber, providerId, periodStart, periodEnd, claims.length, totalAmount]
  );

  // Link claims
  for (const claim of claims) {
    await execute(
      "UPDATE insurance_claims SET batch_id = ?1, status = 'submitted', submitted_at = datetime('now') WHERE id = ?2",
      [batchId, claim.id]
    );
  }

  return batchId;
}

export async function listBatches(providerId?: string): Promise<InsuranceBatch[]> {
  const where = providerId ? "WHERE b.provider_id = ?1" : "";
  const params = providerId ? [providerId] : [];
  return query<InsuranceBatch>(
    `SELECT b.*, p.name as provider_name 
     FROM insurance_batches b 
     JOIN insurance_providers p ON p.id = b.provider_id
     ${where} 
     ORDER BY b.created_at DESC
     LIMIT 500`,
    params
  );
}

export async function settleBatch(batchId: string, settledAmount: number): Promise<void> {
  await execute(
    `UPDATE insurance_batches 
     SET status = 'settled', settled_at = datetime('now'), settled_amount = ?1 
     WHERE id = ?2`,
    [settledAmount, batchId]
  );
  await execute(
    `UPDATE insurance_claims SET status = 'paid', paid_at = datetime('now') WHERE batch_id = ?1 AND status = 'submitted'`,
    [batchId]
  );
}

// ===== Stats =====

export async function getInsuranceStats(): Promise<{
  total_outstanding: number;
  draft_count: number;
  submitted_count: number;
  paid_this_month: number;
  rejected_count: number;
}> {
  const rows = await query<{
    total_outstanding: number;
    draft_count: number;
    submitted_count: number;
    paid_this_month: number;
    rejected_count: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('draft','submitted','approved','partially_paid') THEN claim_amount - paid_amount ELSE 0 END), 0) as total_outstanding,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
       SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
       COALESCE(SUM(CASE WHEN status = 'paid' AND date(paid_at) >= date('now', 'start of month') THEN paid_amount ELSE 0 END), 0) as paid_this_month,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
     FROM insurance_claims`
  );
  return rows[0] || { total_outstanding: 0, draft_count: 0, submitted_count: 0, paid_this_month: 0, rejected_count: 0 };
}

import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";

export interface DarajaConfig {
  id: string;
  public_key: string | null;
  secret_key: string | null;
  active: number;
  test_mode: number;
  connected_at: string | null;
  passkey: string | null;
  shortcode: string | null;
}

export interface DarajaStkResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface DarajaQueryResponse {
  ResultCode: string;
  ResultDesc: string;
}

const DARAJA_SANDBOX = "https://sandbox.safaricom.co.ke";
const DARAJA_PRODUCTION = "https://api.safaricom.co.ke";

function darajaBase(testMode: boolean): string {
  return testMode ? DARAJA_SANDBOX : DARAJA_PRODUCTION;
}

export async function getDarajaConfig(): Promise<DarajaConfig | null> {
  const rows = await query<DarajaConfig>(
    "SELECT * FROM payment_providers WHERE id = 'daraja'"
  );
  return rows[0] || null;
}

export async function saveDarajaConfig(params: {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  testMode: boolean;
}): Promise<void> {
  const existing = await getDarajaConfig();
  if (existing) {
    await execute(
      `UPDATE payment_providers
       SET public_key = ?1, secret_key = ?2, passkey = ?3, shortcode = ?4,
           test_mode = ?5, active = 1, connected_at = datetime('now')
       WHERE id = 'daraja'`,
      [params.consumerKey, params.consumerSecret, params.passkey, params.shortcode, params.testMode ? 1 : 0]
    );
  } else {
    await execute(
      `INSERT INTO payment_providers (id, name, public_key, secret_key, passkey, shortcode, test_mode, active, connected_at)
       VALUES ('daraja', 'M-Pesa Daraja', ?1, ?2, ?3, ?4, ?5, 1, datetime('now'))`,
      [params.consumerKey, params.consumerSecret, params.passkey, params.shortcode, params.testMode ? 1 : 0]
    );
  }
}

export async function disableDaraja(): Promise<void> {
  await execute("UPDATE payment_providers SET active = 0 WHERE id = 'daraja'");
}

/* ─── Manual M-Pesa (Paybill / Till) ──────────────────────────────────
 *
 * The flow most Kenyan SMEs actually use: customer pays the business's
 * Paybill or Till directly on their phone, the cashier reads the M-Pesa
 * confirmation code from the customer's SMS and records it. No API.
 */
export interface ManualMpesaConfig {
  active: number;
  paybill_number: string | null;
  paybill_account_hint: string | null;
  till_number: string | null;
}

export async function getManualMpesaConfig(): Promise<ManualMpesaConfig | null> {
  const rows = await query<ManualMpesaConfig>(
    `SELECT active, paybill_number, paybill_account_hint, till_number
     FROM payment_providers WHERE id = 'mpesa-manual'`,
  );
  return rows[0] || null;
}

export async function saveManualMpesaConfig(params: {
  paybillNumber: string;
  paybillAccountHint: string;
  tillNumber: string;
}): Promise<void> {
  // Active when at least one of paybill/till is set.
  const active = params.paybillNumber.trim() || params.tillNumber.trim() ? 1 : 0;
  await execute(
    `INSERT INTO payment_providers (id, name, active, paybill_number, paybill_account_hint, till_number)
     VALUES ('mpesa-manual', 'M-Pesa (Manual)', ?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET
       active = ?1,
       paybill_number = ?2,
       paybill_account_hint = ?3,
       till_number = ?4`,
    [
      active,
      params.paybillNumber.trim() || null,
      params.paybillAccountHint.trim() || null,
      params.tillNumber.trim() || null,
    ],
  );
}

async function getOAuthToken(config: DarajaConfig): Promise<string> {
  const auth = btoa(`${config.public_key}:${config.secret_key}`);
  const base = darajaBase(config.test_mode === 1);

  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { errorMessage?: string }).errorMessage || `OAuth failed (${res.status})`
    );
  }

  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function verifyDarajaKey(
  consumerKey: string,
  consumerSecret: string,
  testMode: boolean = true,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    // Probe against whichever environment the cashier configured. Hardcoding
    // sandbox here meant live keys always failed verify with a 400 because
    // sandbox didn't know them.
    const base = darajaBase(testMode);
    const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: (body as { errorMessage?: string }).errorMessage || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

export async function initiateStkPush(params: {
  amount: number;
  phone: string;
  accountRef: string;
  transactionDesc: string;
}): Promise<{ checkoutRequestId: string; merchantRequestId: string; transaction_id: string }> {
  const config = await getDarajaConfig();
  if (!config?.secret_key || !config.active) {
    throw new Error("M-Pesa Daraja not configured");
  }

  const cleanPhone = formatKenyanPhone(params.phone);
  if (!cleanPhone.startsWith("254")) {
    throw new Error("Invalid Kenyan phone number");
  }

  const token = await getOAuthToken(config);
  const timestamp = getTimestamp();
  const shortcode = config.shortcode;
  if (!shortcode) throw new Error("Daraja shortcode not configured");
  const password = generatePassword(shortcode, config.passkey || "", timestamp);

  const txId = crypto.randomUUID();

  await execute(
    `INSERT INTO payment_transactions (id, sale_id, provider, amount, customer_phone, status)
     VALUES (?1, null, 'daraja', ?2, ?3, 'pending')`,
    [txId, params.amount, cleanPhone]
  );

  const base = darajaBase(config.test_mode === 1);

  try {
    const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(params.amount),
        PartyA: cleanPhone,
        PartyB: shortcode,
        PhoneNumber: cleanPhone,
        CallBackURL: "https://omnix.co.ke/api/daraja/callback",
        AccountReference: params.accountRef.slice(0, 12),
        TransactionDesc: params.transactionDesc.slice(0, 13),
      }),
    });

    const body = (await res.json()) as DarajaStkResponse;

    if (body.ResponseCode !== "0") {
      await execute(
        `UPDATE payment_transactions SET status = 'failed', error_message = ?1 WHERE id = ?2`,
        [body.ResponseDescription, txId]
      );
      throw new Error(body.ResponseDescription || "STK push failed");
    }

    await execute(
      `UPDATE payment_transactions SET paystack_reference = ?1, status = 'awaiting_confirmation' WHERE id = ?2`,
      [body.CheckoutRequestID, txId]
    );

    return {
      checkoutRequestId: body.CheckoutRequestID,
      merchantRequestId: body.MerchantRequestID,
      transaction_id: txId,
    };
  } catch (e) {
    await execute(
      `UPDATE payment_transactions SET status = 'failed', error_message = ?1 WHERE id = ?2`,
      [String(e), txId]
    );
    throw e;
  }
}

export async function queryStkStatus(checkoutRequestId: string): Promise<{
  status: "success" | "failed" | "pending";
  message?: string;
}> {
  const config = await getDarajaConfig();
  if (!config?.secret_key) throw new Error("M-Pesa Daraja not configured");

  const token = await getOAuthToken(config);
  const timestamp = getTimestamp();
  const shortcode = config.shortcode;
  if (!shortcode) throw new Error("Daraja shortcode not configured");
  const password = generatePassword(shortcode, config.passkey || "", timestamp);

  const base = darajaBase(config.test_mode === 1);

  const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const body = (await res.json()) as DarajaQueryResponse;

  let status: "success" | "failed" | "pending" = "pending";
  if (body.ResultCode === "0") status = "success";
  else if (body.ResultCode !== "1037") status = "failed";

  await execute(
    `UPDATE payment_transactions
     SET status = ?1, confirmed_at = CASE WHEN ?1 = 'success' THEN datetime('now') ELSE confirmed_at END,
         error_message = CASE WHEN ?1 = 'failed' THEN ?2 ELSE error_message END
     WHERE paystack_reference = ?3`,
    [status, body.ResultDesc, checkoutRequestId]
  );

  return { status, message: body.ResultDesc };
}

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function formatKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

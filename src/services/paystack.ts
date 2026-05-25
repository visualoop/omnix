import { fetch } from "@tauri-apps/plugin-http";
import { query, execute } from "@/lib/db";

export interface PaystackConfig {
  id: string;
  public_key: string | null;
  secret_key: string | null;
  active: number;
  test_mode: number;
  connected_at: string | null;
}

export interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    display_text?: string;
  };
}

export interface PaymentTransaction {
  id: string;
  sale_id: string | null;
  provider: string;
  paystack_reference: string | null;
  amount: number;
  currency: string;
  status: string;
  customer_phone: string | null;
  initiated_at: string;
  confirmed_at: string | null;
  error_message: string | null;
}

const PAYSTACK_BASE = "https://api.paystack.co";

// Configuration
export async function getPaystackConfig(): Promise<PaystackConfig | null> {
  const rows = await query<PaystackConfig>(
    "SELECT * FROM payment_providers WHERE id = 'paystack'"
  );
  return rows[0] || null;
}

export async function savePaystackConfig(publicKey: string, secretKey: string, testMode: boolean): Promise<void> {
  const existing = await getPaystackConfig();
  if (existing) {
    await execute(
      `UPDATE payment_providers 
       SET public_key = ?1, secret_key = ?2, test_mode = ?3, active = 1, connected_at = datetime('now')
       WHERE id = 'paystack'`,
      [publicKey, secretKey, testMode ? 1 : 0]
    );
  } else {
    await execute(
      `INSERT INTO payment_providers (id, name, public_key, secret_key, test_mode, active, connected_at)
       VALUES ('paystack', 'Paystack', ?1, ?2, ?3, 1, datetime('now'))`,
      [publicKey, secretKey, testMode ? 1 : 0]
    );
  }
}

export async function disablePaystack(): Promise<void> {
  await execute("UPDATE payment_providers SET active = 0 WHERE id = 'paystack'");
}

// Verify Paystack credentials by calling /bank endpoint (lightweight check)
export async function verifyPaystackKey(secretKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${PAYSTACK_BASE}/bank?country=kenya`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: (body as { message?: string }).message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Initiate M-Pesa charge via Paystack
export async function initiateMpesaCharge(params: {
  amount: number;
  phone: string;
  email: string;
  saleId?: string;
}): Promise<{ reference: string; display_text?: string; transaction_id: string }> {
  const config = await getPaystackConfig();
  if (!config?.secret_key || !config.active) {
    throw new Error("Paystack not configured");
  }

  const cleanPhone = formatKenyanPhone(params.phone);
  const txId = crypto.randomUUID();

  // Record pending transaction
  await execute(
    `INSERT INTO payment_transactions (id, sale_id, provider, amount, customer_phone, status)
     VALUES (?1, ?2, 'paystack', ?3, ?4, 'pending')`,
    [txId, params.saleId || null, params.amount, cleanPhone]
  );

  try {
    const res = await fetch(`${PAYSTACK_BASE}/charge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amount * 100), // Paystack uses kobo/cents
        currency: "KES",
        mobile_money: {
          phone: cleanPhone,
          provider: "mpesa",
        },
      }),
    });

    const body = (await res.json()) as PaystackChargeResponse;

    if (!body.status || !body.data) {
      await execute(
        `UPDATE payment_transactions SET status = 'failed', error_message = ?1 WHERE id = ?2`,
        [body.message || "Unknown error", txId]
      );
      throw new Error(body.message || "Charge failed");
    }

    await execute(
      `UPDATE payment_transactions SET paystack_reference = ?1, status = ?2 WHERE id = ?3`,
      [body.data.reference, body.data.status === "send_otp" ? "awaiting_otp" : "awaiting_confirmation", txId]
    );

    return {
      reference: body.data.reference,
      display_text: body.data.display_text,
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

// Verify a transaction status
export async function verifyTransaction(reference: string): Promise<{
  status: "success" | "failed" | "pending";
  amount?: number;
  channel?: string;
  paid_at?: string;
  message?: string;
}> {
  const config = await getPaystackConfig();
  if (!config?.secret_key) throw new Error("Paystack not configured");

  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.secret_key}` },
  });

  const body = await res.json() as {
    status: boolean;
    data?: { status: string; amount: number; channel: string; paid_at: string; gateway_response?: string };
    message?: string;
  };

  if (!body.status || !body.data) {
    return { status: "failed", message: body.message };
  }

  let status: "success" | "failed" | "pending" = "pending";
  if (body.data.status === "success") status = "success";
  else if (["failed", "abandoned", "reversed"].includes(body.data.status)) status = "failed";

  // Update local transaction record
  await execute(
    `UPDATE payment_transactions 
     SET status = ?1, confirmed_at = CASE WHEN ?1 = 'success' THEN datetime('now') ELSE confirmed_at END
     WHERE paystack_reference = ?2`,
    [status, reference]
  );

  return {
    status,
    amount: body.data.amount / 100,
    channel: body.data.channel,
    paid_at: body.data.paid_at,
    message: body.data.gateway_response,
  };
}

// Submit OTP if Paystack requires it
export async function submitChargeOtp(reference: string, otp: string): Promise<{
  status: "success" | "failed" | "pending";
  message?: string;
}> {
  const config = await getPaystackConfig();
  if (!config?.secret_key) throw new Error("Paystack not configured");

  const res = await fetch(`${PAYSTACK_BASE}/charge/submit_otp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secret_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ otp, reference }),
  });

  const body = await res.json() as { status: boolean; data?: { status: string }; message?: string };

  if (!body.status || !body.data) return { status: "failed", message: body.message };

  let status: "success" | "failed" | "pending" = "pending";
  if (body.data.status === "success") status = "success";
  else if (body.data.status === "failed") status = "failed";

  return { status, message: body.message };
}

// Get transactions for reconciliation
export async function getRecentTransactions(limit = 50): Promise<PaymentTransaction[]> {
  return query<PaymentTransaction>(
    "SELECT * FROM payment_transactions ORDER BY initiated_at DESC LIMIT ?1",
    [limit]
  );
}

// Helper: format Kenyan phone to 254XXXXXXXXX
function formatKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

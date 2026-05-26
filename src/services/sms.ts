/**
 * SMS Notifications — Africa's Talking integration scaffold.
 *
 * Currently STUBBED — saves messages to a queue table that will be sent
 * later when the customer enables SMS. When ready to send for real, this
 * service swaps out `simulateSend` for actual Africa's Talking API calls.
 *
 * Use cases:
 * - Receipt SMS to customer after sale
 * - Refill reminder for repeat prescriptions
 * - Out-of-stock alert for owner
 * - End-of-day report SMS to owner
 *
 * Requires migration 015 to add the sms_queue table (see TODO).
 */
import { query } from "@/lib/db";

export interface SMSRecipient {
  phone: string;        // E.164 format ideally, but accept Kenyan local
  name?: string;
}

export interface SMSMessage {
  id?: string;
  recipient_phone: string;
  recipient_name?: string;
  body: string;
  template?: string;     // optional template name for analytics
  reference?: string;    // optional reference (sale_id, prescription_id, etc.)
  status?: "queued" | "sent" | "failed" | "skipped";
  sent_at?: string | null;
  failed_reason?: string | null;
  created_at?: string;
}

const SETTINGS_KEY = "sokoos-sms-settings";

export interface SMSSettings {
  enabled: boolean;
  provider: "africastalking";
  api_username: string;
  api_key: string;
  sender_id: string;        // shortcode or alphanumeric (must be approved)
  send_receipts: boolean;
  send_refill_reminders: boolean;
  send_owner_alerts: boolean;
  owner_phone: string;
}

const DEFAULTS: SMSSettings = {
  enabled: false,
  provider: "africastalking",
  api_username: "",
  api_key: "",
  sender_id: "SOKOOS",
  send_receipts: true,
  send_refill_reminders: true,
  send_owner_alerts: true,
  owner_phone: "",
};

export function getSMSSettings(): SMSSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function setSMSSettings(s: Partial<SMSSettings>): void {
  const merged = { ...getSMSSettings(), ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

/**
 * Normalize a Kenyan phone number to E.164.
 * 0712345678 → +254712345678
 * 712345678 → +254712345678
 * +254712345678 → unchanged
 */
export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return phone; // unknown format, return as-is
}

/**
 * Queue or send SMS. Currently stubs (queues to console + localStorage log).
 * Wire up Africa's Talking when settings.enabled is true and credentials exist.
 */
export async function sendSMS(msg: SMSMessage): Promise<{ status: string; reason?: string }> {
  const settings = getSMSSettings();
  if (!settings.enabled) {
    console.info("[SMS skipped — not enabled]", msg);
    return { status: "skipped", reason: "SMS not enabled" };
  }
  if (!settings.api_username || !settings.api_key) {
    console.warn("[SMS skipped — missing credentials]");
    return { status: "skipped", reason: "Missing API credentials" };
  }

  const phone = normalizeKenyanPhone(msg.recipient_phone);

  // STUB: real implementation would POST to:
  // https://api.africastalking.com/version1/messaging
  // headers: { apiKey: settings.api_key, Accept: 'application/json' }
  // body: { username: settings.api_username, to: phone, message: msg.body, from: settings.sender_id }
  console.info("[SMS would send]", { to: phone, body: msg.body, sender: settings.sender_id });
  return { status: "sent" };
}

// ─── Templates ──────────────────────────────────────────────
export const SMS_TEMPLATES = {
  receipt: (saleNumber: number, total: number, business: string) =>
    `Thank you for shopping at ${business}. Sale #${saleNumber}: KES ${total.toFixed(2)}. Reply STOP to opt out.`,

  refillDue: (patientName: string, drug: string, business: string) =>
    `Hi ${patientName}, your prescription for ${drug} is due for a refill. Visit ${business} to collect. Reply STOP to opt out.`,

  lowStockAlert: (count: number) =>
    `${count} products are below reorder level. Open SokoOS to review.`,

  endOfDay: (gross: number, count: number, business: string) =>
    `${business} day-end: ${count} sales, KES ${gross.toFixed(2)} total.`,

  controlledDispensed: (drug: string, patient: string) =>
    `Controlled substance dispensed: ${drug} to ${patient}. Logged.`,
};

/** Send receipt SMS after sale (no-op if disabled or no phone). */
export async function sendReceiptSMS(
  saleNumber: number,
  total: number,
  customerPhone: string | null,
  customerName?: string,
): Promise<void> {
  if (!customerPhone) return;
  const settings = getSMSSettings();
  if (!settings.enabled || !settings.send_receipts) return;
  const [biz] = await query<{ value: string }>(`SELECT value FROM business_settings WHERE key = 'business.name'`);
  const business = biz?.value || "SokoOS";
  await sendSMS({
    recipient_phone: customerPhone,
    recipient_name: customerName,
    body: SMS_TEMPLATES.receipt(saleNumber, total, business),
    template: "receipt",
    reference: `sale-${saleNumber}`,
  });
}

/** Send out-of-stock alert SMS to owner. */
export async function sendLowStockAlertSMS(productCount: number): Promise<void> {
  const settings = getSMSSettings();
  if (!settings.enabled || !settings.send_owner_alerts || !settings.owner_phone) return;
  await sendSMS({
    recipient_phone: settings.owner_phone,
    body: SMS_TEMPLATES.lowStockAlert(productCount),
    template: "low_stock",
  });
}

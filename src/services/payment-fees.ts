/**
 * Per-provider payment fees.
 *
 * Stored in `settings` (key/value) so it's easy to roll back without a
 * schema change. The defaults reflect the standard published rates for
 * each provider in Kenya as of 2026, but each merchant negotiates their
 * own tariff so the operator MUST be able to override:
 *
 *   - Paystack Kenya — M-Pesa channel: 1.5% (no fixed fee)
 *   - Paystack Kenya — local card:     2.9%
 *   - Safaricom Daraja (STK Push, C2B Lipa Na M-Pesa Online): variable
 *     by tariff. For most merchants the CUSTOMER is the one charged, so
 *     the merchant fee defaults to 0%. Operators with a 'pay on behalf
 *     of customer' arrangement can flip this.
 *
 * Used by the payment-settings UI to display + persist, and by the
 * sales reports to compute net revenue (gross minus provider fees).
 */
import { query, execute } from "@/lib/db";

export interface PaymentFees {
  paystack_mpesa_percent: number;
  paystack_card_percent: number;
  daraja_percent: number;
}

const DEFAULTS: PaymentFees = {
  paystack_mpesa_percent: 1.5,
  paystack_card_percent: 2.9,
  daraja_percent: 0,
};

const KEYS: Record<keyof PaymentFees, string> = {
  paystack_mpesa_percent: "payment.fees.paystack.mpesa_percent",
  paystack_card_percent:  "payment.fees.paystack.card_percent",
  daraja_percent:         "payment.fees.daraja.percent",
};

/** Read every fee from settings; missing rows fall back to the published default. */
export async function getPaymentFees(): Promise<PaymentFees> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (?1, ?2, ?3)`,
    [KEYS.paystack_mpesa_percent, KEYS.paystack_card_percent, KEYS.daraja_percent],
  );
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const parse = (k: keyof PaymentFees): number => {
    const raw = m.get(KEYS[k]);
    if (raw === undefined) return DEFAULTS[k];
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULTS[k];
  };
  return {
    paystack_mpesa_percent: parse("paystack_mpesa_percent"),
    paystack_card_percent: parse("paystack_card_percent"),
    daraja_percent: parse("daraja_percent"),
  };
}

/** Persist any subset of fees. Pass only the keys you want to change. */
export async function savePaymentFees(input: Partial<PaymentFees>): Promise<void> {
  for (const [k, v] of Object.entries(input) as [keyof PaymentFees, number | undefined][]) {
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < 0) continue;
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'payment_fees')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [KEYS[k], String(v)],
    );
  }
}

/** Compute the merchant's net take after the provider's cut. */
export function applyFee(amount: number, percent: number): { fee: number; net: number } {
  const safePct = Math.max(0, percent);
  const fee = Math.round((amount * safePct) / 100 * 100) / 100;
  return { fee, net: Math.round((amount - fee) * 100) / 100 };
}

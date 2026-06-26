/**
 * Paystack Popup (InlineJS V2) wrapper.
 *
 * WHY POPUP, NOT A CUSTOM CARD FORM:
 * Paystack's risk engine (RAMS) flags custom card UIs more aggressively
 * because they fingerprint like card-testing scripts. Building our own
 * card form would also pull us into PCI scope (we'd be handling PANs).
 * The hosted Popup iframe keeps card data entirely inside Paystack —
 * they handle 3-D Secure, OTP, and fraud checks — so we stay out of PCI
 * scope and out of the fraud-flag penalty box.
 *
 * Mobile-money (Paystack M-Pesa) keeps using the /charge flow elsewhere
 * because there's no card data to protect there.
 *
 * The onSuccess callback is NOT proof of payment on its own. The caller
 * must verify the transaction server-side (GET /transaction/verify/:ref
 * with the secret key) before marking the sale paid. This wrapper just
 * drives the client-side popup and reports what the popup told us.
 */
import PaystackPop from "@paystack/inline-js";

export interface PaystackPopupArgs {
  /** Paystack PUBLIC key (pk_test_… / pk_live_…). Never the secret. */
  publicKey: string;
  /** Customer email — Paystack requires one. Use a store-level fallback
   *  (e.g. sales@business) when the customer is anonymous. */
  email: string;
  /** Amount in KES (major units). Converted to the minor unit inside. */
  amountKes: number;
  /** Our transaction reference so we can reconcile + verify server-side. */
  reference: string;
  /** Optional metadata surfaced in the Paystack dashboard. */
  metadata?: Record<string, unknown>;
}

export interface PaystackPopupResult {
  status: "success" | "cancelled" | "error";
  reference: string;
  message?: string;
}

/**
 * Open the Paystack Popup for a transaction. Resolves when the customer
 * completes or dismisses the popup.
 *
 * KES is a zero-subunit-sensitive currency on Paystack: amounts are
 * still passed in the minor unit (cents), so we multiply by 100.
 */
export function payByPaystackPopup(args: PaystackPopupArgs): Promise<PaystackPopupResult> {
  return new Promise((resolve) => {
    try {
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: args.publicKey,
        email: args.email,
        amount: Math.round(args.amountKes * 100),
        currency: "KES",
        reference: args.reference,
        metadata: args.metadata,
        onSuccess: (txn: { reference: string }) => {
          resolve({ status: "success", reference: txn.reference || args.reference });
        },
        onCancel: () => {
          resolve({ status: "cancelled", reference: args.reference });
        },
        onError: (err: { message?: string }) => {
          resolve({ status: "error", reference: args.reference, message: err?.message });
        },
      });
    } catch (e) {
      resolve({
        status: "error",
        reference: args.reference,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

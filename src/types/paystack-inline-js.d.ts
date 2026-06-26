/**
 * Minimal type declaration for @paystack/inline-js (Popup V2).
 *
 * The package ships without bundled types. We declare only the surface
 * we use — newTransaction with the V2 callback names (onSuccess /
 * onCancel / onError).
 */
declare module "@paystack/inline-js" {
  export interface NewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
    onSuccess?: (transaction: { reference: string; [k: string]: unknown }) => void;
    onCancel?: () => void;
    onError?: (error: { message?: string; [k: string]: unknown }) => void;
  }

  export default class PaystackPop {
    newTransaction(options: NewTransactionOptions): void;
  }
}

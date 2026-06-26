/**
 * Payment-brand iconography for POS, Settings → Payment Settings, and
 * the customer display.
 *
 * Every icon is rendered inline as SVG so we don't ship raster logos,
 * don't ship official brand assets we don't own, and don't need a
 * network round-trip. They render the BRAND SHAPE + colour cue so the
 * cashier (and the customer on the second screen) recognises them at
 * a glance — exactly what the user asked for: "the stk push ui in pos
 * looks like mpesa and for paystack when initiating pay via paystack
 * looks like paystack".
 *
 * These are deliberately simplified — not pixel-perfect reproductions
 * of the official marks (which would need licensing). They're
 * silhouettes + tone-matched colours that read instantly.
 */
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  size?: number;
};

/** Safaricom M-Pesa — green wordmark on a rounded green chip. */
export function MpesaIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="M-Pesa"
      {...props}
    >
      {/* Safaricom green tile */}
      <rect width="32" height="32" rx="6" fill="#43B02A" />
      {/* Stylised 'M' that reads like the M-Pesa wordmark glyph */}
      <path
        d="M8 22 V10 H11 L13.5 16 L16 10 H19 V22 H16.5 V14.6 L14.2 21 H12.8 L10.5 14.6 V22 Z"
        fill="#FFFFFF"
      />
      {/* Red dot — Safaricom brand accent */}
      <circle cx="22" cy="20" r="2" fill="#E60012" />
    </svg>
  );
}

/** Paystack — copper/orange P on a charcoal chip. */
export function PaystackIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="Paystack"
      {...props}
    >
      <rect width="32" height="32" rx="6" fill="#011B33" />
      {/* Four-bar 'P' silhouette matching the Paystack identity */}
      <rect x="6"  y="8"  width="20" height="3" rx="0.5" fill="#00C3F7" />
      <rect x="6"  y="13" width="14" height="3" rx="0.5" fill="#00C3F7" />
      <rect x="6"  y="18" width="20" height="3" rx="0.5" fill="#00C3F7" />
      <rect x="6"  y="23" width="6"  height="3" rx="0.5" fill="#00C3F7" />
    </svg>
  );
}

/** Visa — blue rounded rect with the V/I/S/A wordmark suggestion. */
export function VisaIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * (20 / 32)}
      viewBox="0 0 32 20"
      className={className}
      aria-label="Visa"
      {...props}
    >
      <rect width="32" height="20" rx="3" fill="#1A1F71" />
      <text
        x="16"
        y="14"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="900"
        fontSize="11"
        letterSpacing="0.5"
        fill="#FFFFFF"
      >
        VISA
      </text>
      {/* Yellow tail accent under the wordmark */}
      <rect x="3" y="16" width="26" height="1.5" fill="#F7B600" />
    </svg>
  );
}

/** Mastercard — interlocking red + yellow circles on dark chip. */
export function MastercardIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * (20 / 32)}
      viewBox="0 0 32 20"
      className={className}
      aria-label="Mastercard"
      {...props}
    >
      <rect width="32" height="20" rx="3" fill="#000000" />
      <circle cx="13" cy="10" r="6" fill="#EB001B" />
      <circle cx="19" cy="10" r="6" fill="#F79E1B" />
      {/* Overlap region appears orange */}
      <path
        d="M16 14a6 6 0 0 0 0-8 6 6 0 0 0 0 8z"
        fill="#FF5F00"
      />
    </svg>
  );
}

/** Cash — KES note silhouette in green. */
export function CashIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="Cash"
      {...props}
    >
      <rect x="3" y="9" width="26" height="14" rx="2" fill="#1F8B3A" />
      <circle cx="16" cy="16" r="3.5" fill="#FFFFFF" />
      <text
        x="16"
        y="18.5"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="4.5"
        fill="#1F8B3A"
      >
        KES
      </text>
      {/* Corner pip dots like real notes */}
      <circle cx="6.5" cy="12.5" r="0.7" fill="#FFFFFF" />
      <circle cx="25.5" cy="19.5" r="0.7" fill="#FFFFFF" />
    </svg>
  );
}

/** Generic card — neutral chip when the method is unspecified card. */
export function CardIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * (20 / 32)}
      viewBox="0 0 32 20"
      className={className}
      aria-label="Card"
      {...props}
    >
      <rect x="0.5" y="0.5" width="31" height="19" rx="3" fill="#1A1F36" stroke="#2A3148" />
      {/* Chip */}
      <rect x="4" y="6" width="5" height="4" rx="0.8" fill="#D4A24C" />
      {/* Number bar suggestion */}
      <rect x="4" y="13" width="6" height="1.5" rx="0.5" fill="#9BA4C7" />
      <rect x="12" y="13" width="6" height="1.5" rx="0.5" fill="#9BA4C7" />
      <rect x="20" y="13" width="6" height="1.5" rx="0.5" fill="#9BA4C7" />
    </svg>
  );
}

/** Bank — neutral building silhouette for bank-transfer methods. */
export function BankIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="Bank"
      {...props}
    >
      <rect width="32" height="32" rx="6" fill="#1A2438" />
      <path d="M16 6 L26 11 H6 Z" fill="#9BA4C7" />
      <rect x="7" y="13" width="2" height="9" fill="#9BA4C7" />
      <rect x="12" y="13" width="2" height="9" fill="#9BA4C7" />
      <rect x="18" y="13" width="2" height="9" fill="#9BA4C7" />
      <rect x="23" y="13" width="2" height="9" fill="#9BA4C7" />
      <rect x="5" y="23" width="22" height="2" fill="#9BA4C7" />
    </svg>
  );
}

/** Insurance — shield. */
export function InsuranceIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="Insurance"
      {...props}
    >
      <path
        d="M16 4 L26 8 V16 C26 22 21 26.5 16 28 C11 26.5 6 22 6 16 V8 Z"
        fill="#0EA5E9"
      />
      <path d="M11 16 L14.5 19.5 L21 13" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Resolve a brand icon for a payment-method id or name. Falls back to
 * a generic CardIcon when nothing matches so the UI never renders an
 * empty chip.
 */
export function paymentBrandIcon(idOrName: string): (props: IconProps) => React.ReactElement {
  const k = idOrName.toLowerCase();
  if (k.includes("mpesa") || k.includes("m-pesa")) return MpesaIcon;
  if (k.includes("paystack")) return PaystackIcon;
  if (k.includes("visa")) return VisaIcon;
  if (k.includes("master")) return MastercardIcon;
  if (k.includes("cash")) return CashIcon;
  if (k.includes("bank")) return BankIcon;
  if (k.includes("insur") || k.includes("sha") || k.includes("nhif")) return InsuranceIcon;
  return CardIcon;
}

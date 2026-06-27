/**
 * Payment-brand iconography for POS, Settings → Payment Settings, and
 * the customer display.
 *
 * Rendered inline as SVG — no raster logos, no network round-trip, no
 * shipping of official brand assets we don't own. Each icon reads the
 * BRAND SHAPE + tone-matched colours so the cashier (and the customer
 * on the second screen) recognises the method instantly. This is what
 * the user asked for: "the stk push ui in pos looks like mpesa and for
 * paystack when initiating pay via paystack looks like paystack".
 *
 * These are deliberately simplified silhouettes, not pixel-perfect
 * reproductions of the official marks (which need licensing). They're
 * recognisable + tasteful, sized for chips and section headers.
 */
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  size?: number;
};

/**
 * Safaricom M-Pesa — green tile, lowercase "m-pesa" wordmark feel with
 * the signature red accent dot. We draw a bold lowercase 'm' glyph and
 * place the brand's red pip to the right.
 */
export function MpesaIcon({ className, size = 28, ...props }: IconProps) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="M-Pesa" role="img" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4FC52E" />
          <stop offset="1" stopColor="#3FA323" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill={`url(#${id}-g)`} />
      {/* bold lowercase m — three legs */}
      <path
        d="M9 27 V16.5 C9 14.6 10.4 13.2 12.3 13.2 C13.8 13.2 15 14 15.5 15.2 C16 14 17.2 13.2 18.7 13.2 C20.6 13.2 22 14.6 22 16.5 V27 H18.7 V17.3 C18.7 16.7 18.3 16.3 17.7 16.3 C17.1 16.3 16.7 16.7 16.7 17.3 V27 H14.3 V17.3 C14.3 16.7 13.9 16.3 13.3 16.3 C12.7 16.3 12.3 16.7 12.3 17.3 V27 Z"
        fill="#FFFFFF"
      />
      {/* Safaricom red accent pip */}
      <circle cx="27.5" cy="24.5" r="2.6" fill="#E2231A" />
    </svg>
  );
}

/**
 * Paystack — deep-navy tile + the four ascending cyan bars that form
 * the Paystack 'P' identity.
 */
export function PaystackIcon({ className, size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="Paystack" role="img" {...props}>
      <rect width="40" height="40" rx="9" fill="#011B33" />
      <g fill="#13B7F5">
        <rect x="9"  y="11" width="22" height="3.4" rx="1.2" />
        <rect x="9"  y="17" width="16" height="3.4" rx="1.2" />
        <rect x="9"  y="23" width="22" height="3.4" rx="1.2" />
        <rect x="9"  y="29" width="9"  height="3.4" rx="1.2" />
      </g>
    </svg>
  );
}

/** Visa — deep-blue card, italic wordmark suggestion + yellow tail. */
export function VisaIcon({ className, size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size * (26 / 40)} viewBox="0 0 40 26" className={className} aria-label="Visa" role="img" {...props}>
      <rect width="40" height="26" rx="4" fill="#1A1F71" />
      <text
        x="20" y="17.5" textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700" fontStyle="italic" fontSize="13" letterSpacing="0.5"
        fill="#FFFFFF"
      >VISA</text>
      <rect x="5" y="20.5" width="30" height="1.8" fill="#F7B600" rx="0.9" />
    </svg>
  );
}

/** Mastercard — black chip + interlocking red/amber circles with the
 *  signature orange overlap. */
export function MastercardIcon({ className, size = 28, ...props }: IconProps) {
  const id = React.useId();
  return (
    <svg width={size} height={size * (26 / 40)} viewBox="0 0 40 26" className={className} aria-label="Mastercard" role="img" {...props}>
      <defs>
        <radialGradient id={`${id}-o`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF8A00" />
          <stop offset="1" stopColor="#FF5F00" />
        </radialGradient>
      </defs>
      <rect width="40" height="26" rx="4" fill="#16140F" />
      <circle cx="16.5" cy="13" r="7.5" fill="#EB001B" />
      <circle cx="23.5" cy="13" r="7.5" fill="#F79E1B" />
      {/* overlap lens */}
      <path d="M20 7.2 a7.5 7.5 0 0 1 0 11.6 a7.5 7.5 0 0 1 0 -11.6 Z" fill={`url(#${id}-o)`} />
    </svg>
  );
}

/** Cash — KES note in green with a centred denomination disc. */
export function CashIcon({ className, size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="Cash" role="img" {...props}>
      <rect x="3" y="10" width="34" height="20" rx="3" fill="#1F8B3A" />
      <rect x="3" y="10" width="34" height="20" rx="3" fill="none" stroke="#16702D" strokeWidth="0.8" />
      <circle cx="20" cy="20" r="5.5" fill="#FFFFFF" />
      <text x="20" y="22.4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="5.5" fill="#1F8B3A">KES</text>
      <circle cx="8" cy="14.5" r="1" fill="#FFFFFF" opacity="0.85" />
      <circle cx="32" cy="25.5" r="1" fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

/** Generic card — dark body, metallic EMV chip + contactless waves. */
export function CardIcon({ className, size = 28, ...props }: IconProps) {
  const id = React.useId();
  return (
    <svg width={size} height={size * (26 / 40)} viewBox="0 0 40 26" className={className} aria-label="Card" role="img" {...props}>
      <defs>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A3148" />
          <stop offset="1" stopColor="#161B2C" />
        </linearGradient>
        <linearGradient id={`${id}-chip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4D58D" />
          <stop offset="1" stopColor="#C99A3A" />
        </linearGradient>
      </defs>
      <rect width="40" height="26" rx="4" fill={`url(#${id}-c)`} />
      <rect x="5" y="8" width="7" height="5.4" rx="1.1" fill={`url(#${id}-chip)`} />
      <line x1="8.5" y1="8" x2="8.5" y2="13.4" stroke="#9A7526" strokeWidth="0.5" />
      {/* contactless waves */}
      <g stroke="#9BA4C7" strokeWidth="1" fill="none" strokeLinecap="round">
        <path d="M15 9 q2 2 0 4" />
        <path d="M17.5 7.5 q3.5 3.5 0 7" />
      </g>
      <rect x="5" y="18" width="9" height="2" rx="1" fill="#9BA4C7" />
      <rect x="16" y="18" width="9" height="2" rx="1" fill="#9BA4C7" opacity="0.7" />
    </svg>
  );
}

/** Bank — navy tile + classical pillar facade. */
export function BankIcon({ className, size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="Bank" role="img" {...props}>
      <rect width="40" height="40" rx="9" fill="#1A2438" />
      <path d="M20 8 L31 14 H9 Z" fill="#9BA4C7" />
      <g fill="#9BA4C7">
        <rect x="10" y="16" width="2.6" height="11" />
        <rect x="15.5" y="16" width="2.6" height="11" />
        <rect x="21.9" y="16" width="2.6" height="11" />
        <rect x="27.4" y="16" width="2.6" height="11" />
      </g>
      <rect x="8" y="28" width="24" height="2.6" rx="1" fill="#9BA4C7" />
    </svg>
  );
}

/** Insurance — sky shield with a white tick. */
export function InsuranceIcon({ className, size = 28, ...props }: IconProps) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="Insurance" role="img" {...props}>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22B0F0" />
          <stop offset="1" stopColor="#0E84C7" />
        </linearGradient>
      </defs>
      <path d="M20 5 L32 10 V19 C32 27 26.5 32.8 20 35 C13.5 32.8 8 27 8 19 V10 Z" fill={`url(#${id}-s)`} />
      <path d="M14 20 L18 24 L26.5 15.5" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Credit / account — IOU note silhouette in neutral tone. */
export function CreditIcon({ className, size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-label="Credit account" role="img" {...props}>
      <rect width="40" height="40" rx="9" fill="#3A2F1A" />
      <rect x="9" y="12" width="22" height="16" rx="2" fill="none" stroke="#E2B658" strokeWidth="1.6" />
      <line x1="13" y1="18" x2="27" y2="18" stroke="#E2B658" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13" y1="22" x2="22" y2="22" stroke="#E2B658" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/** Brand tints — used to colour the full-width method blocks in the
 *  rebuilt payment modal so each method reads in its brand palette. */
export const PAYMENT_BRAND_TINTS: Record<string, { bg: string; ring: string; text: string }> = {
  mpesa:     { bg: "bg-[#4FC52E]/10",  ring: "ring-[#4FC52E]/40",  text: "text-[#2E7D1B] dark:text-[#7BE35C]" },
  paystack:  { bg: "bg-[#13B7F5]/10",  ring: "ring-[#13B7F5]/40",  text: "text-[#0A6F9E] dark:text-[#5FD0FB]" },
  cash:      { bg: "bg-[#1F8B3A]/10",  ring: "ring-[#1F8B3A]/35",  text: "text-[#16702D] dark:text-[#5FC97E]" },
  card:      { bg: "bg-foreground/[0.05]", ring: "ring-foreground/15", text: "text-foreground/80" },
  bank:      { bg: "bg-foreground/[0.05]", ring: "ring-foreground/15", text: "text-foreground/80" },
  insurance: { bg: "bg-[#0E84C7]/10",  ring: "ring-[#0E84C7]/35",  text: "text-[#0A6F9E] dark:text-[#5FD0FB]" },
  credit:    { bg: "bg-[#E2B658]/12",  ring: "ring-[#E2B658]/40",  text: "text-[#8A6A1F] dark:text-[#E2B658]" },
};

/**
 * Resolve a brand tint for a method id/name. Falls back to a neutral
 * card tint so the chip always renders cleanly.
 */
export function paymentBrandTint(idOrName: string) {
  const k = idOrName.toLowerCase();
  if (k.includes("mpesa") || k.includes("m-pesa") || k.includes("lipa")) return PAYMENT_BRAND_TINTS.mpesa;
  if (k.includes("paystack")) return PAYMENT_BRAND_TINTS.paystack;
  if (k.includes("cash")) return PAYMENT_BRAND_TINTS.cash;
  if (k.includes("bank")) return PAYMENT_BRAND_TINTS.bank;
  if (k.includes("insur") || k.includes("sha") || k.includes("nhif")) return PAYMENT_BRAND_TINTS.insurance;
  if (k.includes("credit")) return PAYMENT_BRAND_TINTS.credit;
  return PAYMENT_BRAND_TINTS.card;
}

/**
 * Resolve a brand icon component for a payment-method id or name.
 * Falls back to CardIcon so the UI never renders an empty chip.
 */
export function paymentBrandIcon(idOrName: string): (props: IconProps) => React.ReactElement {
  const k = idOrName.toLowerCase();
  if (k.includes("mpesa") || k.includes("m-pesa") || k.includes("lipa")) return MpesaIcon;
  if (k.includes("paystack")) return PaystackIcon;
  if (k.includes("visa")) return VisaIcon;
  if (k.includes("master")) return MastercardIcon;
  if (k.includes("cash")) return CashIcon;
  if (k.includes("bank")) return BankIcon;
  if (k.includes("insur") || k.includes("sha") || k.includes("nhif")) return InsuranceIcon;
  if (k.includes("credit")) return CreditIcon;
  return CardIcon;
}

/* ─── Full brand lockups ──────────────────────────────────────────────
 *
 * Horizontal symbol + wordmark used in the LARGE moments (the spinner /
 * waiting state of the Daraja and Paystack charge panels) where the
 * user is staring at it for several seconds. These are deliberately
 * brand-faithful renditions — not the small tile chips — built from
 * the published brand cues (M-Pesa: phone silhouette + lowercase
 * wordmark + red swoosh; Paystack: stacked rounded rects forming a P
 * + lowercase wordmark in navy). Public-domain text logos; no
 * copyrighted asset is shipped.
 */
interface LockupProps extends React.SVGProps<SVGSVGElement> {
  /** px height. The intrinsic aspect ratio is preserved. */
  height?: number;
}

export function MpesaLockup({ className, height = 56, ...props }: LockupProps) {
  const w = height * (200 / 56);
  const id = React.useId();
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 200 56"
      className={className}
      aria-label="M-Pesa"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient id={`${id}-phone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5DD43A" />
          <stop offset="1" stopColor="#3FA323" />
        </linearGradient>
      </defs>

      {/* Phone silhouette — tall rounded rect with a screen + red swoosh */}
      <rect x="6" y="4" width="38" height="48" rx="6" fill={`url(#${id}-phone)`} />
      <rect x="11" y="9" width="28" height="38" rx="3" fill="#FFFFFF" />
      {/* speaker tick */}
      <rect x="22" y="48" width="6" height="1.4" rx="0.7" fill="#FFFFFF" opacity="0.85" />
      {/* red swoosh on the screen (Safaricom red) */}
      <path
        d="M16 30 Q22 24 28 28 T38 26"
        stroke="#E2231A"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="38" cy="26" r="2.2" fill="#E2231A" />

      {/* Wordmark — lowercase 'mpesa' in Safaricom green, bold */}
      <text
        x="56"
        y="38"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="30"
        letterSpacing="-0.8"
        fill="#3FA323"
      >
        m-pesa
      </text>
    </svg>
  );
}

export function PaystackLockup({ className, height = 56, ...props }: LockupProps) {
  const w = height * (220 / 56);
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 220 56"
      className={className}
      aria-label="Paystack"
      role="img"
      {...props}
    >
      {/* The 'P' built from stacked rounded rectangles. The lower-left
          tail is shorter than the upper bars — that's the Paystack
          identity per their 2019 brand reveal. */}
      <g fill="#011B33">
        <rect x="6"  y="6"  width="40" height="9" rx="3" />
        <rect x="6"  y="19" width="28" height="9" rx="3" />
        <rect x="6"  y="32" width="40" height="9" rx="3" />
        <rect x="6"  y="45" width="16" height="6" rx="3" opacity="0.85" />
      </g>

      {/* Wordmark — 'paystack' in navy */}
      <text
        x="58"
        y="36"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="-0.5"
        fill="#011B33"
      >
        paystack
      </text>
    </svg>
  );
}

/**
 * Module-specific brand marks. Each vertical gets its own logo so when
 * the user installs that module, the app feels purpose-built for them.
 *
 * All logos: 512×512 viewBox, rounded square (rx=112) like the Omnix
 * mark, but with module-specific gradients + glyphs.
 */
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

interface LogoProps {
  size?: number;
  className?: string;
  rounded?: boolean;
}

const ROUNDED_RX = 112;

// ─── Dawa (Pharmacy) — Mortar & Pestle ──────────────────────────────
export function DawaLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `dawa-${size}`;
  // Read country pharmacy term so aria-label flips per country
  // (Dawa in Kenya, Pharmacy elsewhere, Pharmacie in Rwanda, etc.).
  const code = useCountry((s) => s.code);
  const term = pharmacyTerm(code);
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label={`${term} module logo`}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#065F46" />
        </linearGradient>
        <linearGradient id={`${id}-pill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#A7F3D0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx={rounded ? ROUNDED_RX : 0} fill={`url(#${id}-bg)`} />
      {/* Diagonal capsule (pill) */}
      <g transform="translate(256 256) rotate(-30) translate(-160 -56)">
        <rect x="0" y="0" width="320" height="112" rx="56" fill={`url(#${id}-pill)`} />
        <rect x="160" y="0" width="160" height="112" rx="56" fill="rgba(255,255,255,0.4)" />
        <line x1="160" y1="0" x2="160" y2="112" stroke="#059669" strokeWidth="6" />
      </g>
    </svg>
  );
}

// ─── Hardware Store — Wrench + Hammer Cross ─────────────────────────
export function HardwareLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `hw-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Hardware">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx={rounded ? ROUNDED_RX : 0} fill={`url(#${id}-bg)`} />
      {/* Wrench */}
      <g transform="translate(256 256) rotate(-45)" stroke="#DBEAFE" strokeWidth="32" strokeLinecap="round" fill="none">
        <line x1="-140" y1="0" x2="100" y2="0" />
        <circle cx="-140" cy="0" r="40" fill="#60A5FA" stroke="none" />
      </g>
      {/* Hammer */}
      <g transform="translate(256 256) rotate(45)" stroke="#DBEAFE" strokeWidth="32" strokeLinecap="round" fill="none">
        <line x1="-100" y1="0" x2="100" y2="0" />
        <rect x="80" y="-50" width="50" height="100" rx="8" fill="#60A5FA" stroke="none" />
      </g>
      <circle cx="256" cy="256" r="22" fill="#DBEAFE" />
    </svg>
  );
}

// ─── Electronics — Microchip ─────────────────────────────────────────
export function ElectronicsLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `el-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Electronics">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={`${id}-chip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx={rounded ? ROUNDED_RX : 0} fill={`url(#${id}-bg)`} />
      {/* Pins */}
      {[1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={156 + i * 50} y="100" width="20" height="40" fill="#E0F2FE" />
          <rect x={156 + i * 50} y="372" width="20" height="40" fill="#E0F2FE" />
          <rect x="100" y={156 + i * 50} width="40" height="20" fill="#E0F2FE" />
          <rect x="372" y={156 + i * 50} width="40" height="20" fill="#E0F2FE" />
        </g>
      ))}
      {/* Chip body */}
      <rect x="140" y="140" width="232" height="232" rx="20" fill={`url(#${id}-chip)`} />
      {/* CPU mark */}
      <g transform="translate(256 256)" stroke="#0F172A" strokeWidth="14" fill="none" strokeLinecap="round">
        <rect x="-50" y="-50" width="100" height="100" rx="10" />
        <line x1="-30" y1="-25" x2="30" y2="-25" />
        <line x1="-30" y1="0" x2="30" y2="0" />
        <line x1="-30" y1="25" x2="30" y2="25" />
      </g>
    </svg>
  );
}

// ─── Restaurant — Fork & Knife / Plate ───────────────────────────────
export function RestaurantLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `rt-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Restaurant">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B91C1C" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx={rounded ? ROUNDED_RX : 0} fill={`url(#${id}-bg)`} />
      {/* Plate */}
      <circle cx="256" cy="296" r="120" fill="none" stroke="#FECACA" strokeWidth="14" />
      <circle cx="256" cy="296" r="78" fill="#FECACA" opacity="0.25" />
      {/* Fork */}
      <g transform="translate(176 130)" fill="#FECACA">
        <rect x="-6" y="0" width="12" height="240" rx="4" />
        <rect x="-26" y="0" width="12" height="80" rx="4" />
        <rect x="14" y="0" width="12" height="80" rx="4" />
        <rect x="-32" y="60" width="64" height="20" rx="4" />
      </g>
      {/* Knife */}
      <g transform="translate(336 130)" fill="#FECACA">
        <rect x="-4" y="120" width="8" height="120" rx="4" />
        <path d="M -16 0 L 16 0 L 8 130 L -8 130 Z" />
      </g>
    </svg>
  );
}

// ─── Generic Module (for fallback / Core) ────────────────────────────
export function ModuleLogo({ moduleId, size = 32, className = "", rounded = true }: LogoProps & { moduleId: string }) {
  switch (moduleId) {
    case "dawa":
    case "pharmacy":
      return <DawaLogo size={size} className={className} rounded={rounded} />;
    case "retail":
      return <RetailLogo size={size} className={className} rounded={rounded} />;
    case "hardware":
      return <HardwareLogo size={size} className={className} rounded={rounded} />;
    case "restaurant":
    case "hospitality":
      return <RestaurantLogo size={size} className={className} rounded={rounded} />;
    case "salon":
      return <SalonLogo size={size} className={className} rounded={rounded} />;
    default:
      return null;
  }
}

// ─── Salon & Spa — Scissors ──────────────────────────────────────────
export function SalonLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `salon-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Omnix Salon & Spa">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#9D174D" />
        </linearGradient>
      </defs>
      {rounded ? <rect width="512" height="512" rx={ROUNDED_RX} fill={`url(#${id}-bg)`} /> : <rect width="512" height="512" fill={`url(#${id}-bg)`} />}
      {/* Open scissors */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="192" cy="372" r="42" />
        <circle cx="320" cy="372" r="42" />
        <path d="M 224 342 L 368 150" />
        <path d="M 288 342 L 144 150" />
      </g>
      {/* Blade tips */}
      <circle cx="368" cy="150" r="14" fill="#FBCFE8" />
      <circle cx="144" cy="150" r="14" fill="#FBCFE8" />
      {/* Pivot */}
      <circle cx="256" cy="256" r="18" fill="#FFFFFF" />
      <circle cx="256" cy="256" r="7" fill="#9D174D" />
    </svg>
  );
}

export function RetailLogo({ size = 32, className = "", rounded = true }: LogoProps) {
  const id = `retail-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Omnix Retail">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={`${id}-bag`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FEF3C7" />
        </linearGradient>
      </defs>
      {rounded && <rect width="512" height="512" rx={ROUNDED_RX} fill={`url(#${id}-bg)`} />}
      {!rounded && <rect width="512" height="512" fill={`url(#${id}-bg)`} />}
      {/* Shopping bag */}
      <path
        d="M 130 220 L 130 410 Q 130 430 150 430 L 362 430 Q 382 430 382 410 L 382 220 Z"
        fill={`url(#${id}-bag)`}
        stroke="#FFFFFF"
        strokeWidth="6"
      />
      {/* Bag handles */}
      <path
        d="M 200 220 Q 200 130 256 130 Q 312 130 312 220"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Sparkle */}
      <g transform="translate(310, 280)">
        <path
          d="M 0 -30 L 6 -6 L 30 0 L 6 6 L 0 30 L -6 6 L -30 0 L -6 -6 Z"
          fill="#FBBF24"
        />
      </g>
    </svg>
  );
}

/**
 * Omnix brand logo mark — a clean circular O-inspired ring with an amber dot.
 * Renders as an inline SVG for zero layout shift and dark/light compatibility.
 */

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="0" y="0" width="512" height="512" rx="112" fill="#0F172A" />
      <circle cx="256" cy="256" r="138" stroke="url(#omnx-ring)" strokeWidth="48" />
      <circle cx="256" cy="156" r="16" fill="#FBBF24" />
      <defs>
        <linearGradient id="omnx-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

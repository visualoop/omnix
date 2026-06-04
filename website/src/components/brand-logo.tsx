/**
 * Omnix brand assets — single source of truth, derived from the desktop
 * app's source.svg (src-tauri/icons/source.svg). Keeping these in lockstep
 * means the website logo and the Tauri app icon are visually identical.
 *
 *   <BrandLogo>      square mark (favicon, OG image, compact spaces)
 *   <BrandWordmark>  horizontal lockup with "Omnix" baked into the SVG
 *
 * The wordmark renders the brand name as SVG <text> using the display
 * font (Fraunces, loaded site-wide), so callers don't need to render
 * a separate span. fill="currentColor" lets the text adapt to theme.
 */

const BG_FROM = '#0F172A'
const BG_TO = '#1E3A8A'
const RING_FROM = '#60A5FA'
const RING_TO = '#06B6D4'
const DOT = '#FBBF24'

/** Square brand mark — matches src-tauri/icons/source.svg exactly. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="omnx-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BG_FROM} />
          <stop offset="100%" stopColor={BG_TO} />
        </linearGradient>
        <linearGradient id="omnx-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={RING_FROM} />
          <stop offset="100%" stopColor={RING_TO} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#omnx-bg)" />
      <circle cx="256" cy="256" r="138" stroke="url(#omnx-ring)" strokeWidth="48" />
      <circle cx="256" cy="156" r="16" fill={DOT} />
    </svg>
  )
}

/**
 * Horizontal wordmark: icon + "Omnix" + amber accent dot, all inline in
 * one SVG. Designed to be a drop-in replacement for the icon-plus-span
 * lockup that used to live in the header / footer / auth layouts.
 *
 * ViewBox 0 0 1280 320 → 4:1. Caller controls size with className (e.g.
 * h-8 for header, h-12 for footer hero). Width auto-derives from height.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1280 320"
      fill="none"
      className={className}
      aria-label="Omnix"
      role="img"
    >
      <defs>
        <linearGradient id="omnx-wm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BG_FROM} />
          <stop offset="100%" stopColor={BG_TO} />
        </linearGradient>
        <linearGradient id="omnx-wm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={RING_FROM} />
          <stop offset="100%" stopColor={RING_TO} />
        </linearGradient>
      </defs>
      {/* Icon — same geometry as BrandLogo, scaled to 320×320 in slot 0,0 */}
      <rect x="0" y="0" width="320" height="320" rx="70" fill="url(#omnx-wm-bg)" />
      <circle cx="160" cy="160" r="86" stroke="url(#omnx-wm-ring)" strokeWidth="30" />
      <circle cx="160" cy="98" r="10" fill={DOT} />
      {/* Wordmark — Fraunces (display font), centred to icon baseline */}
      <text
        x="370"
        y="220"
        fontFamily="Fraunces, ui-serif, Georgia, serif"
        fontSize="220"
        fontWeight="500"
        letterSpacing="-4"
        fill="currentColor"
      >
        Omnix
      </text>
      {/* Accent dot after the wordmark */}
      <circle cx="1212" cy="200" r="22" fill={DOT} />
    </svg>
  )
}

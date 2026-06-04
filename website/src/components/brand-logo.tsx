/**
 * Omnix brand assets — single source of truth, kept in lockstep with the
 * actual desktop app icon (src-tauri/icons/icon.png): a flat black rounded
 * square with a single amber dot near the top. No ring, no gradient, no
 * extra ornamentation — matches what users see when the app is installed.
 *
 *   <BrandLogo>      square mark (favicon, OG image, compact spaces)
 *   <BrandWordmark>  horizontal lockup with "Omnix" baked into the SVG
 */

const BG = '#000000'
const DOT = '#FBBF24'

/** Square brand mark — matches the desktop app's icon exactly. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="0" y="0" width="512" height="512" rx="112" fill={BG} />
      <circle cx="256" cy="156" r="16" fill={DOT} />
    </svg>
  )
}

/**
 * Horizontal wordmark: icon + "Omnix" text, all inline in one SVG.
 *
 * ViewBox 0 0 1180 320 → ~3.7:1. Caller controls size with className
 * (e.g. h-7 in header, h-12 in footer hero). The text uses
 * fill="currentColor" so it adapts to theme; the icon is intentionally
 * always-black to match the installed app.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1180 320"
      fill="none"
      className={className}
      aria-label="Omnix"
      role="img"
    >
      {/* Icon — same geometry as BrandLogo, scaled to 320×320 in slot 0,0 */}
      <rect x="0" y="0" width="320" height="320" rx="70" fill={BG} />
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
    </svg>
  )
}

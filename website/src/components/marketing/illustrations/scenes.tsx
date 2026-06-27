/**
 * Omnix scenes — larger, compositional SVG illustrations for the "hero
 * moments" on key marketing pages. They use the same single-accent
 * terracotta line language as the small marks (see ./index.tsx), but at a
 * scene scale where the composition itself carries meaning (data flowing
 * into a funnel, four stations feeding one core, a receipt becoming a
 * KRA filing).
 *
 * Same contract: strokes use currentColor (caller sets accent text colour),
 * hairline weight, rounded joins, never filled blobs, never multi-colour.
 * Each scene is responsive: viewBox is fixed, the parent decides the size.
 */
import type { SVGProps } from 'react'

interface SceneProps extends SVGProps<SVGSVGElement> {}

const SCENE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
} as const

/* ─── Platform scene ─────────────────────────────────────────────────────
 * Four stations (till, kitchen, office, warehouse) feeding one Omnix core
 * in the centre. Used on the homepage as the visual thesis of "everything
 * the business runs on, in one place".
 */
export function PlatformScene(p: SceneProps) {
  return (
    <svg viewBox="0 0 480 280" {...SCENE_PROPS} {...p}>
      {/* Core */}
      <rect x="200" y="110" width="80" height="60" rx="6" />
      <text x="240" y="146" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="9" letterSpacing="2" fill="currentColor" stroke="none">OMNIX</text>
      <path d="M200 130h80M200 152h80" opacity="0.3" />

      {/* Top-left station — till */}
      <g>
        <rect x="40" y="40" width="86" height="58" rx="3" />
        <path d="M40 56h86" opacity="0.5" />
        <text x="83" y="52" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">TILL</text>
        <rect x="50" y="66" width="22" height="22" rx="1" opacity="0.4" />
        <rect x="76" y="66" width="22" height="22" rx="1" opacity="0.4" />
        <rect x="102" y="66" width="14" height="22" rx="1" opacity="0.4" />
      </g>
      <path d="M126 84 L200 140" />
      <circle cx="200" cy="140" r="1.5" />

      {/* Top-right station — kitchen */}
      <g>
        <rect x="354" y="40" width="86" height="58" rx="3" />
        <path d="M354 56h86" opacity="0.5" />
        <text x="397" y="52" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">KITCHEN</text>
        <path d="M366 70h62M366 76h62M366 82h44" opacity="0.4" />
        <circle cx="426" cy="88" r="3" />
        <path d="M424.5 88l1.3 1.3L427.5 86.5" />
      </g>
      <path d="M354 84 L280 140" />
      <circle cx="280" cy="140" r="1.5" />

      {/* Bottom-left station — office */}
      <g>
        <rect x="40" y="182" width="86" height="58" rx="3" />
        <path d="M40 198h86" opacity="0.5" />
        <text x="83" y="194" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">OFFICE</text>
        <path d="M52 230V214M64 230V208M76 230V218M88 230V204M100 230V210" />
        <path d="M52 230h60" opacity="0.4" />
      </g>
      <path d="M126 196 L200 156" />
      <circle cx="200" cy="156" r="1.5" />

      {/* Bottom-right station — warehouse */}
      <g>
        <rect x="354" y="182" width="86" height="58" rx="3" />
        <path d="M354 198h86" opacity="0.5" />
        <text x="397" y="194" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">WAREHOUSE</text>
        <rect x="364" y="210" width="18" height="18" />
        <rect x="386" y="210" width="18" height="18" />
        <rect x="375" y="206" width="18" height="18" opacity="0.55" />
        <rect x="408" y="210" width="18" height="18" opacity="0.55" />
      </g>
      <path d="M354 196 L280 156" />
      <circle cx="280" cy="156" r="1.5" />
    </svg>
  )
}

/* ─── Receipt → KRA scene ────────────────────────────────────────────────
 * Sale prints a receipt → eTIMS signs it → filed at KRA. Three stages on a
 * single horizontal flow. Used on the homepage receipt-proof section.
 */
export function ReceiptToKraScene(p: SceneProps) {
  return (
    <svg viewBox="0 0 480 200" {...SCENE_PROPS} {...p}>
      {/* Stage 1 — Sale → receipt */}
      <g>
        <rect x="30" y="56" width="64" height="100" rx="3" />
        <path d="M30 70h64" opacity="0.45" />
        <path d="M38 80h48M38 88h48M38 96h36M38 110h48M38 118h32" opacity="0.45" />
        <text x="62" y="48" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">SALE</text>
        {/* tear edge */}
        <path d="M30 156l6-4 6 4 6-4 6 4 6-4 6 4 6-4 6 4 6-4 6 4" />
      </g>

      {/* arrow */}
      <path d="M104 106h36" />
      <path d="M134 100l8 6-8 6" />

      {/* Stage 2 — eTIMS signature */}
      <g>
        <rect x="156" y="56" width="116" height="100" rx="3" />
        <text x="214" y="48" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">eTIMS</text>
        <path d="M170 80h88M170 88h62M170 96h72" opacity="0.45" />
        <rect x="170" y="110" width="88" height="36" rx="2" opacity="0.6" />
        <path d="M180 132l8 7 18-22" />
        <text x="220" y="138" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">SIGNED</text>
      </g>

      {/* arrow */}
      <path d="M282 106h36" />
      <path d="M312 100l8 6-8 6" />

      {/* Stage 3 — KRA filing */}
      <g>
        <rect x="332" y="64" width="118" height="92" rx="3" />
        <text x="391" y="56" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">KRA · VAT3</text>
        <path d="M346 84h90M346 92h66M346 100h82M346 116h60M346 124h90M346 132h74" opacity="0.45" />
        <circle cx="430" cy="138" r="6" />
        <path d="M427.5 138l1.8 1.8 4-4.4" />
      </g>
    </svg>
  )
}

/* ─── Migration scene ────────────────────────────────────────────────────
 * Messy files drop into the AI funnel → mapped + previewed → land in the
 * Omnix database. Used on /migration as the visual thesis.
 */
export function MigrationScene(p: SceneProps) {
  return (
    <svg viewBox="0 0 480 220" {...SCENE_PROPS} {...p}>
      {/* Input files (stacked, off-kilter) */}
      <g>
        <rect x="36" y="40" width="60" height="76" rx="2" transform="rotate(-4 66 78)" />
        <rect x="42" y="50" width="56" height="76" rx="2" transform="rotate(2 70 88)" />
        <rect x="48" y="60" width="56" height="76" rx="2" />
        <path d="M58 76h36M58 84h36M58 92h24M58 100h36M58 108h28" opacity="0.45" />
        <text x="76" y="70" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="1.5" fill="currentColor" stroke="none">.CSV</text>
      </g>

      {/* Arrow into funnel */}
      <path d="M114 110h36" />
      <path d="M142 104l8 6-8 6" />

      {/* AI funnel */}
      <g>
        <path d="M158 70h120l-30 50v40h-60v-40z" />
        <path d="M176 86h84M176 96h70M188 106h60" opacity="0.45" />
        <path d="M248 130l1.6 4.4L254 136l-4.4 1.6L248 142l-1.6-4.4L242 136l4.4-1.6z" />
        <text x="218" y="62" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">AI · MAPPED</text>
      </g>

      {/* Arrow out */}
      <path d="M298 130h28" />
      <path d="M318 124l8 6-8 6" />

      {/* DB cylinder */}
      <g>
        <ellipse cx="376" cy="86" rx="48" ry="10" />
        <path d="M328 86v60a48 10 0 0096 0V86" />
        <ellipse cx="376" cy="112" rx="48" ry="10" opacity="0.5" />
        <ellipse cx="376" cy="138" rx="48" ry="10" opacity="0.35" />
        <text x="376" y="180" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">OMNIX · IMPORTED</text>
      </g>
    </svg>
  )
}

/* ─── Encrypted DB + backup scene ────────────────────────────────────────
 * Local encrypted database on a PC with a lock, an arrow up to a cloud
 * backup, and a sync arrow to a second device. Used on /security.
 */
export function SecurityScene(p: SceneProps) {
  return (
    <svg viewBox="0 0 480 240" {...SCENE_PROPS} {...p}>
      {/* PC */}
      <g>
        <rect x="120" y="86" width="120" height="86" rx="3" />
        <path d="M120 102h120" opacity="0.45" />
        <path d="M156 186h48M168 186v-14" />
        {/* DB cylinder inside */}
        <ellipse cx="180" cy="126" rx="32" ry="6" />
        <path d="M148 126v22a32 6 0 0064 0v-22" />
        <ellipse cx="180" cy="142" rx="32" ry="6" opacity="0.5" />
        {/* lock */}
        <g transform="translate(220 110)">
          <rect x="0" y="6" width="20" height="16" rx="2" />
          <path d="M4 6V4a6 6 0 0112 0v2" />
          <circle cx="10" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </g>
      </g>

      {/* Cloud backup arrow up */}
      <g>
        <path d="M180 86V42" opacity="0.7" />
        <path d="M174 50l6-8 6 8" />
        <path d="M330 30a14 14 0 00-28 0 12 12 0 003 23h22a10 10 0 003-23z" transform="translate(-180 0)" />
        <text x="180" y="36" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">BACKUP</text>
      </g>

      {/* LAN to second PC */}
      <path d="M240 130h70" opacity="0.7" />
      <path d="M302 124l8 6-8 6" />
      <g>
        <rect x="320" y="100" width="100" height="72" rx="3" />
        <path d="M320 116h100" opacity="0.45" />
        <path d="M346 186h48M358 186v-14" />
        <text x="370" y="148" textAnchor="middle" fontFamily="ui-monospace" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none">TILL · 02</text>
      </g>
    </svg>
  )
}

/* ─── Atmospheric motifs ─────────────────────────────────────────────────
 * Subtle background patterns. Place behind a section's container with low
 * opacity, no pointer events. Each is a stand-alone <svg> that tiles or
 * fills its parent.
 */

/** Hairline grid (24px). Use behind dense data-feel surfaces. */
export function GridMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}
    >
      <defs>
        <pattern id="omnix-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#omnix-grid)" />
    </svg>
  )
}

/** Topographic contour lines — a quiet warm rhythm under hero sections. */
export function ContourMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 1280 400"
      preserveAspectRatio="none"
      style={{ pointerEvents: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6">
        <path d="M0 320 C 240 280, 480 360, 720 300 S 1120 280, 1280 320" />
        <path d="M0 280 C 240 240, 480 320, 720 260 S 1120 240, 1280 280" />
        <path d="M0 240 C 240 200, 480 280, 720 220 S 1120 200, 1280 240" />
        <path d="M0 200 C 240 160, 480 240, 720 180 S 1120 160, 1280 200" opacity="0.7" />
        <path d="M0 160 C 240 120, 480 200, 720 140 S 1120 120, 1280 160" opacity="0.5" />
      </g>
    </svg>
  )
}

/**
 * Omnix brand assets — uses the actual desktop app icon file directly.
 *
 *   <BrandLogo>      square mark, served from /icon.png (the exact PNG
 *                    shipped inside the Tauri app)
 *   <BrandWordmark>  horizontal lockup: same icon + "Omnix" text in
 *                    Fraunces (display font)
 *
 * The logo is intentionally NOT redrawn — we serve src-tauri/icons/icon.png
 * verbatim so the website and the installed app are pixel-identical.
 */

import Image from 'next/image'

/** Square brand mark — the exact PNG used by the desktop app. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/icon.png"
      alt=""
      aria-hidden
      width={64}
      height={64}
      className={className}
      priority
    />
  )
}

/**
 * Horizontal wordmark: app icon + "Omnix" word, side by side.
 * Caller controls icon size via className (the text size scales with it).
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <Image
        src="/icon.png"
        alt=""
        aria-hidden
        width={64}
        height={64}
        className="h-[1.2em] w-[1.2em]"
        priority
      />
      <span className="font-[family-name:var(--font-display)] font-medium leading-none tracking-[-0.02em]">
        Omnix
      </span>
    </span>
  )
}

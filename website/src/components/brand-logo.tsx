/**
 * Omnix brand assets — uses the actual desktop app icon file directly.
 *
 *   <BrandLogo>      square mark, served from /icon.png (the exact PNG
 *                    shipped inside the Tauri app)
 *   <BrandWordmark>  horizontal lockup: same icon + "Omnix" text in
 *                    Fraunces (display font)
 *
 * We use a plain <img> tag (not next/image) because the Vercel image
 * optimizer returns HTTP 400 for this asset, breaking the lockup. The
 * file is 3 KB — optimization is unnecessary.
 */

/** Square brand mark — the exact PNG used by the desktop app. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.png"
      alt=""
      aria-hidden
      width={64}
      height={64}
      className={className}
    />
  )
}

/**
 * Horizontal wordmark: app icon + "Omnix" word, side by side.
 * Caller controls the size via a font-size class on the wrapper
 * (e.g. text-[24px]) — the icon scales relative to the text.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt=""
        aria-hidden
        className="h-[1.1em] w-[1.1em]"
      />
      <span className="font-[family-name:var(--font-display)] font-medium leading-none tracking-[-0.02em]">
        Omnix
      </span>
    </span>
  )
}

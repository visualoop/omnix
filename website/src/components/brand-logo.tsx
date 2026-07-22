/**
 * Omnix brand assets — uses the original Omnix logo (blue gradient with
 * white broken-ring cog around a center dot) — same source as the favicon
 * served in the browser tab, so the on-page logo and the tab icon match.
 *
 *   <BrandLogo>      square mark, served from /favicon.svg
 *   <BrandWordmark>  horizontal lockup: same icon + "Omnix" text in
 *                    the Geist display role
 */

/** Square brand mark — same source as the favicon. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden
      width={64}
      height={64}
      className={className}
    />
  )
}

/**
 * Horizontal wordmark: cog logo + "Omnix" word, side by side.
 * Caller controls size via a font-size class on the wrapper
 * (e.g. text-[24px]) — the icon scales relative to the text.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/favicon.svg"
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

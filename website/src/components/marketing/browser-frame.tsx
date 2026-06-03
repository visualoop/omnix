/**
 * <BrowserFrame> — wraps any image (or arbitrary children) in a Windows
 * Chrome browser-window chrome:
 *
 *   ┌──── ⊙ ⊙ ⊙ ───────────────────────────────────────┐
 *   │  ◀ ▶ ↻      🔒 omnix.co.ke/dashboard          │
 *   │ ──────────────────────────────────────────────── │
 *   │                                                  │
 *   │   <screenshot or any content here>               │
 *   │                                                  │
 *   └──────────────────────────────────────────────────┘
 *
 * Use it everywhere the marketing site renders a screenshot uploaded via
 * Payload — the chrome makes flat screenshots feel "in-context" without
 * forcing the editor to bake the browser chrome into every image.
 */
import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/cn'

interface BrowserFrameProps {
  /** URL bar text. Defaults to 'omnix.co.ke'. */
  url?: string
  /** Show the secure padlock icon. Default true. */
  secure?: boolean
  /** Frame variant — light or dark. Default light. */
  variant?: 'light' | 'dark'
  /** Optional className for the outer wrapper (e.g. shadow / max-width). */
  className?: string
  /** Hide the "traffic lights" macOS-style buttons (default false = show). */
  hideTrafficLights?: boolean
  /** Children render inside the content slot — usually <Image> or an <img>. */
  children: React.ReactNode
}

interface BrowserFrameImageProps extends Omit<BrowserFrameProps, 'children'> {
  /** Image src — local path or remote (Payload Media URL). */
  src: string
  /** Alt text for accessibility. */
  alt: string
  /** Image width (intrinsic). */
  width: number
  /** Image height (intrinsic). */
  height: number
  /** Use Next.js <Image> (default). Pass false for plain <img> in places
   *  where Next.js Image isn't available (rich-text renderers). */
  optimize?: boolean
}

export function BrowserFrame({
  url = 'omnix.co.ke',
  secure = true,
  variant = 'light',
  className,
  hideTrafficLights = false,
  children,
}: BrowserFrameProps) {
  const isDark = variant === 'dark'
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border shadow-2xl',
        isDark
          ? 'border-white/10 bg-[#1f1f23]'
          : 'border-[var(--color-border)] bg-[#f6f6f7]',
        className,
      )}
    >
      {/* Top chrome: traffic lights + URL bar, single row */}
      <div
        className={cn(
          'flex items-center gap-3 border-b px-3.5 py-2.5',
          isDark
            ? 'border-white/10'
            : 'border-[var(--color-border)]',
        )}
      >
        {!hideTrafficLights && (
          <div className="flex shrink-0 gap-1.5">
            <span aria-hidden className="block size-3 rounded-full bg-[#ff5f57]" />
            <span aria-hidden className="block size-3 rounded-full bg-[#febc2e]" />
            <span aria-hidden className="block size-3 rounded-full bg-[#28c840]" />
          </div>
        )}

        {/* URL bar */}
        <div
          className={cn(
            'flex h-7 flex-1 items-center gap-1.5 rounded-md border px-3 text-[11.5px]',
            isDark
              ? 'border-white/10 bg-[#2c2c30] text-white/70'
              : 'border-[var(--color-border)] bg-white text-[var(--color-fg-muted)]',
          )}
        >
          {secure && (
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={cn('size-3', isDark ? 'text-emerald-400' : 'text-emerald-600')}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M4 7V5a4 4 0 1 1 8 0v2M3.5 7h9a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
            </svg>
          )}
          <span className="truncate font-mono">{url}</span>
        </div>
      </div>

      {/* Content slot */}
      <div className="bg-white">{children}</div>
    </div>
  )
}

/** Convenience: BrowserFrame + Image in one. Most common usage. */
export function BrowserFrameImage({
  src,
  alt,
  width,
  height,
  optimize = true,
  ...frameProps
}: BrowserFrameImageProps) {
  return (
    <BrowserFrame {...frameProps}>
      {optimize ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1024px"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={width} height={height} className="h-auto w-full" />
      )}
    </BrowserFrame>
  )
}

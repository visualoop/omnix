'use client'

/*
 * DecorativeVideo — the single client boundary for decorative, autoplay-style
 * marketing motion (homepage hero + the five product-page heroes).
 *
 * Why this exists: a raw autoplay <video> begins playback the instant the
 * element mounts — before any JavaScript can consult the visitor's motion
 * preference. That violates prefers-reduced-motion. This component omits the
 * autoplay attribute entirely and instead starts paused, then plays *only*
 * after an effect has confirmed motion is allowed. So:
 *
 *   - Server render + first client paint: paused on the approved poster. No
 *     autoplay attribute is ever emitted, so nothing plays before the check.
 *   - Motion allowed: the effect calls play() (muted + playsInline keep this
 *     inside browser autoplay policy; a rejected promise is swallowed so the
 *     poster simply remains).
 *   - Reduced motion (initial or later toggled): the video is paused and reset
 *     to its poster frame; playback is never attempted.
 *
 * The clip is always muted, inline, chrome-free, poster-backed, and paired
 * with a text alternative (sr-only label for decorative product heroes, or an
 * accessible name on the homepage hero). Source + poster URLs only ever arrive
 * from the approved-media resolver; this component adds no new media path.
 *
 * NOTE: this is deliberately NOT the click-to-load YouTube embed
 * (ModuleDemoVideo) — that component and its privacy boundary are untouched.
 */
import { useEffect, useRef, useState } from 'react'

/**
 * Subscribe to the OS/browser reduced-motion preference. Defaults to `true`
 * (motion-off) for the server render and the first client paint so decorative
 * playback is never attempted until the real preference is known. Updates live
 * if the visitor toggles the preference. Safe under jsdom / environments
 * without matchMedia (stays motion-off).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export interface DecorativeVideoProps {
  /** Approved video source URL (from the media-slot resolver only). */
  src: string
  /** Source MIME type, e.g. "video/webm". */
  type: string
  /** Approved poster image URL; shown whenever the clip is not playing. */
  poster: string
  /**
   * Accessible name set directly on the <video> element. Use where the clip is
   * the labelled element (homepage hero). Mutually exclusive with `srLabel`.
   */
  ariaLabel?: string
  /**
   * Visually-hidden text alternative rendered beside an aria-hidden <video>.
   * Use for purely decorative product heroes. Mutually exclusive with `ariaLabel`.
   */
  srLabel?: string
  /** Preload the poster as a high-priority image (product hero pattern). */
  preloadPoster?: boolean
  /** Loop the clip. Defaults to true (all current decorative usages loop). */
  loop?: boolean
  className?: string
}

export function DecorativeVideo({
  src,
  type,
  poster,
  ariaLabel,
  srLabel,
  preloadPoster = false,
  loop = true,
  className,
}: DecorativeVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const decorative = srLabel != null

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (reducedMotion) {
      // Never attempt playback; hold on the approved poster frame.
      try {
        video.pause()
        video.currentTime = 0
      } catch {
        /* media not ready / unsupported (e.g. jsdom) — poster remains */
      }
      return
    }

    // Motion is allowed: start playback. Muted + playsInline satisfy autoplay
    // policy; a rejected/absent promise just leaves the poster in place.
    try {
      const started = video.play()
      if (started && typeof started.catch === 'function') {
        started.catch(() => {
          /* autoplay blocked — poster remains, no throw */
        })
      }
    } catch {
      /* play() unsupported (e.g. jsdom) — poster remains */
    }
  }, [reducedMotion])

  return (
    <>
      {preloadPoster ? (
        <link rel="preload" as="image" href={poster} fetchPriority="high" />
      ) : null}
      {decorative ? <span className="sr-only">{srLabel}</span> : null}
      {/* No autoplay attribute on purpose — playback is gated on
          prefers-reduced-motion in the effect above so nothing plays before the
          preference is known. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={className}
        muted
        loop={loop}
        playsInline
        preload={reducedMotion ? 'none' : 'metadata'}
        poster={poster}
        aria-label={decorative ? undefined : ariaLabel}
        aria-hidden={decorative ? true : undefined}
        tabIndex={decorative ? -1 : undefined}
      >
        <source src={src} type={type} />
      </video>
    </>
  )
}

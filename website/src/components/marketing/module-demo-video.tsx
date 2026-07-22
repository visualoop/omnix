'use client'

/*
 * ModuleDemoVideo — shared, accessible, responsive product-demo embed.
 *
 * Privacy boundary (click-to-load): before the visitor explicitly chooses
 * "Play demo video" there is NO YouTube iframe in the DOM and therefore no
 * request to any YouTube/Google origin. After the explicit action, the iframe
 * is rendered from the fixed https://www.youtube-nocookie.com/embed/<id>
 * origin only. The component NEVER accepts a raw admin URL — it takes a
 * pre-validated video ID and re-checks it here before building the embed, so
 * an invalid ID can never reach an iframe.
 *
 * States:
 *   - ready  : valid published video → facade (poster-free, no fabricated
 *              thumbnail) with a Play control + always-visible text summary.
 *   - playing: after the explicit Play action → constrained no-autoplay iframe.
 *   - absent : no valid published video → "Demo video is being prepared;
 *              book a guided demo" with a locale-aware book-demo link.
 */
import { useState } from 'react'
import Link from 'next/link'

import {
  isValidYouTubeVideoId,
  youTubeNoCookieEmbedUrl,
  type ModuleDemoProduct,
} from '@/lib/youtube-demo'
import { trackConversion, type ConversionLocale } from '@/lib/analytics/track'
import styles from './module-demo-video.module.css'

export interface ModuleDemoVideoContent {
  videoId: string
  title: string
  summary: string
}

interface ModuleDemoVideoProps {
  product: ModuleDemoProduct
  /** Human product label, e.g. "Pharmacy" — used in labels and copy. */
  productLabel: string
  /** Pre-validated, published entry. Null/invalid renders the absent state. */
  content?: ModuleDemoVideoContent | null
  /** Locale-aware book-demo href (the page's existing demo CTA target). */
  bookDemoHref: string
  /** Active locale, used only for a closed analytics dimension. */
  locale?: string
}

export function ModuleDemoVideo({
  product,
  productLabel,
  content,
  bookDemoHref,
  locale,
}: ModuleDemoVideoProps) {
  const [playing, setPlaying] = useState(false)

  const title = content?.title?.trim() ?? ''
  const summary = content?.summary?.trim() ?? ''
  const valid =
    content && isValidYouTubeVideoId(content.videoId) && title && summary
      ? { videoId: content.videoId, title, summary }
      : null

  const headingId = `${product}-demo-heading`

  if (!valid) {
    return (
      <div className={styles.wrap} data-module-demo-video data-demo-state="absent">
        <p className={styles.eyebrow}>{productLabel} demo</p>
        <h2 id={headingId} className={styles.heading}>
          Demo video is being prepared.
        </h2>
        <p className={styles.absentBody}>
          A guided demo is the best way to see the {productLabel} workflow on your own
          examples. We will walk through it with you live.
        </p>
        <Link className={styles.cta} href={bookDemoHref}>
          Book a guided demo
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.wrap} data-module-demo-video data-demo-state={playing ? 'playing' : 'ready'}>
      <p className={styles.eyebrow}>{productLabel} demo</p>
      <h2 id={headingId} className={styles.heading}>
        {valid.title}
      </h2>

      <div className={styles.frame}>
        {playing ? (
          <iframe
            className={styles.iframe}
            src={youTubeNoCookieEmbedUrl(valid.videoId)}
            title={valid.title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.playButton}
            onClick={() => {
              // Fire on the explicit Play — the same action that loads the
              // youtube-nocookie facade. Closed dimensions only.
              trackConversion('video_start', {
                product,
                locale: locale as ConversionLocale | undefined,
                surface: 'module_demo',
              })
              setPlaying(true)
            }}
            aria-label={`Play the ${productLabel} demo video: ${valid.title}`}
          >
            <span className={styles.playIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.playLabel}>Play demo video</span>
            <span className={styles.privacyNote}>
              Loads from youtube-nocookie.com only after you choose Play.
            </span>
          </button>
        )}
      </div>

      {/* The text summary / transcript fallback stays visible in every state. */}
      <p className={styles.summary}>{valid.summary}</p>
    </div>
  )
}

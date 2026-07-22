/**
 * YouTube module-demo helpers — pure, framework-free, no I/O.
 *
 * This module is imported by both the browser (the shared demo-video
 * component) and the server (admin API + public resolver). It performs NO
 * database access and NO outbound network/metadata fetches — it only parses
 * and normalises a user-supplied URL into an 11-character YouTube video ID,
 * and validates persisted rows for public display.
 *
 * Security posture:
 *  - We never persist arbitrary embed HTML or a raw admin URL. Only the
 *    normalised 11-char video ID is stored and later rendered, always through
 *    the fixed https://www.youtube-nocookie.com/embed/<id> origin.
 *  - The validator is strict: exact host allow-list (no deceptive
 *    subdomains), no userinfo, no ports, no iframe/HTML, no playlist-only
 *    links, and rejects unsupported hosts and malformed IDs.
 */
/** The five product pages that carry an admin-managed demo video. Fixed set. */
export const MODULE_DEMO_PRODUCTS = ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon'] as const
export type ModuleDemoProduct = (typeof MODULE_DEMO_PRODUCTS)[number]

export function isModuleDemoProduct(value: unknown): value is ModuleDemoProduct {
  return typeof value === 'string' && (MODULE_DEMO_PRODUCTS as readonly string[]).includes(value)
}

/** A YouTube video ID is exactly 11 URL-safe base64 characters. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export function isValidYouTubeVideoId(value: unknown): value is string {
  return typeof value === 'string' && YOUTUBE_ID_PATTERN.test(value)
}

/** The only origin a public embed is ever rendered from. */
export function youTubeNoCookieEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

/** Exact host allow-list — membership is checked case-insensitively and in full,
 *  so "youtube.com.evil.com" or "evil-youtube.com" never match. */
const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const SHORT_HOST = 'youtu.be'
const NOCOOKIE_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com'])

export interface YouTubeParseSuccess {
  ok: true
  videoId: string
}
export interface YouTubeParseFailure {
  ok: false
  error: string
}
export type YouTubeParseResult = YouTubeParseSuccess | YouTubeParseFailure

function fail(error: string): YouTubeParseFailure {
  return { ok: false, error }
}

function pathSegments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean)
}

/**
 * Strict, pure parser. Accepts only:
 *   - youtube.com / www / m  →  /watch?v=<id>   or  /shorts/<id>
 *   - youtu.be               →  /<id>
 *   - youtube-nocookie.com   →  /embed/<id>
 * Extracts and returns the normalised 11-char video ID, or a reason for rejection.
 * No outbound requests are made.
 */
export function parseYouTubeUrl(input: unknown): YouTubeParseResult {
  if (typeof input !== 'string') return fail('Enter a YouTube link as text.')
  const raw = input.trim()
  if (!raw) return fail('Enter a YouTube link.')
  if (/\s/.test(raw)) return fail('The link must not contain spaces or line breaks.')
  // Reject any iframe / HTML paste outright — we never accept embed markup.
  if (/[<>"'`]/.test(raw)) return fail('Paste a plain YouTube link, not iframe or embed HTML.')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return fail('Enter a valid YouTube URL.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail('Only http(s) YouTube links are supported.')
  }
  if (url.username || url.password) {
    return fail('Links that embed user information are not allowed.')
  }
  if (url.port) {
    return fail('Links with an explicit port are not allowed.')
  }

  const host = url.hostname.toLowerCase()
  const segments = pathSegments(url)

  // youtu.be/<id>
  if (host === SHORT_HOST) {
    if (segments.length !== 1) return fail('This youtu.be link does not point to a single video.')
    return finalize(segments[0])
  }

  // youtube.com / www / m
  if (WATCH_HOSTS.has(host)) {
    if (url.pathname === '/watch' || segments[0] === 'watch') {
      const id = url.searchParams.get('v')
      if (!id) return fail('This link has no video. Playlist-only links are not supported.')
      return finalize(id)
    }
    if (segments[0] === 'shorts') {
      if (segments.length !== 2) return fail('This Shorts link does not point to a single video.')
      return finalize(segments[1])
    }
    if (segments[0] === 'playlist') {
      return fail('Playlist links are not supported. Use a single video link.')
    }
    return fail('Only /watch and /shorts YouTube links are supported.')
  }

  // youtube-nocookie.com/embed/<id>
  if (NOCOOKIE_HOSTS.has(host)) {
    if (segments[0] === 'embed' && segments.length === 2) {
      return finalize(segments[1])
    }
    return fail('Only youtube-nocookie.com /embed links are supported.')
  }

  return fail('Only youtube.com, youtu.be, or youtube-nocookie.com links are supported.')
}

function finalize(candidate: string | undefined): YouTubeParseResult {
  if (!candidate || !YOUTUBE_ID_PATTERN.test(candidate)) {
    return fail('The link does not contain a valid 11-character YouTube video ID.')
  }
  return { ok: true, videoId: candidate }
}

/** Shape of a persisted row as far as public display is concerned. */
export interface ModuleDemoVideoRowLike {
  product: string
  videoId: string
  title: string
  summary: string
  published: boolean
}

/** A complete, published, valid entry safe to render publicly. */
export interface PublicModuleDemoVideo {
  product: ModuleDemoProduct
  videoId: string
  title: string
  summary: string
}

/**
 * Fail-closed transform from a persisted row to a public entry.
 *
 * Returns null (no video) unless EVERY condition holds: the row exists, is a
 * known product, is published, carries a valid 11-char ID, and has a non-empty
 * title and summary. This is the single gate the public resolver relies on, so
 * it is pure and independently testable without a database.
 */
export function toPublicModuleDemoVideo(
  row: ModuleDemoVideoRowLike | null | undefined,
): PublicModuleDemoVideo | null {
  if (!row) return null
  if (row.published !== true) return null
  if (!isModuleDemoProduct(row.product)) return null
  if (!isValidYouTubeVideoId(row.videoId)) return null
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const summary = typeof row.summary === 'string' ? row.summary.trim() : ''
  if (!title || !summary) return null
  return { product: row.product, videoId: row.videoId, title, summary }
}

'use client'

/**
 * Consent-aware analytics island (public frontend only).
 *
 * Before consent: nothing that talks to Google is created. No gtag, no script
 * tag, so no request to any Google origin can happen. It shows the consent
 * notice on a first visit and honours GPC/DNT by defaulting to denied and
 * staying silent (no banner).
 *
 * After consent: it injects the single exact GA tag from googletagmanager.com,
 * configures it with `send_page_view: false`, and manually sends a path-only
 * page_view — once on load and once per client route change, de-duplicated so
 * the initial navigation never double-counts.
 *
 * Withdrawal: whenever consent is not granted, the GA native opt-out flag
 * (`window['ga-disable-<id>']`) is set to true, so even a tag loaded earlier in
 * the same session stops collecting. This is why a visitor can flip the choice
 * from the footer control without reloading or clearing storage.
 *
 * The measurement ID is validated again here (it is also validated server-side
 * before this component is rendered). An invalid id renders nothing.
 */
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { resolveGaId } from '@/lib/analytics/ga'
import { normalizePublicPath, sendPageView } from '@/lib/analytics/track'
import {
  acceptAnalytics,
  closeAnalyticsPreferences,
  declineAnalytics,
  useAnalyticsConsent,
} from '@/lib/analytics/consent-store'
import { AnalyticsConsentNotice } from './consent-notice'

type GtagFn = (...args: unknown[]) => void
interface GtagWindow extends Window {
  dataLayer?: unknown[]
  gtag?: GtagFn
}

const GA_SCRIPT_ID = 'omnix-ga-tag'

export interface SiteAnalyticsProps {
  gaId: string
  privacyHref: string
}

export function SiteAnalytics({ gaId: rawGaId, privacyHref }: SiteAnalyticsProps) {
  const gaId = resolveGaId(rawGaId)
  const pathname = usePathname()
  const consent = useAnalyticsConsent()
  const readyRef = useRef(false)
  const lastPathRef = useRef<string | null>(null)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const granted = consent.choice === 'granted' && !consent.privacySignal

  // GA native opt-out: off while granted, on otherwise. Set even before the tag
  // exists so a tag can never collect without a granted choice behind it.
  useEffect(() => {
    if (!gaId || typeof window === 'undefined') return
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = !granted
  }, [granted, gaId])

  // Load the single GA tag exactly once, only after consent is granted.
  useEffect(() => {
    if (!granted || !gaId || typeof document === 'undefined') return
    if (readyRef.current || document.getElementById(GA_SCRIPT_ID)) return

    const initGa = () => {
      if (readyRef.current) return
      const w = window as GtagWindow
      w.dataLayer = w.dataLayer || []
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments)
      }
      w.gtag('js', new Date())
      // send_page_view:false — we own page_view so we can keep it path-only.
      w.gtag('config', gaId, { send_page_view: false })
      readyRef.current = true
      sendPageView(pathnameRef.current)
      // Dedupe on the normalised path — two raw slugs that collapse to the same
      // authored template must not double-count.
      lastPathRef.current = normalizePublicPath(pathnameRef.current)
    }

    const script = document.createElement('script')
    script.id = GA_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
    script.setAttribute('data-omnix-ga', '')
    script.addEventListener('load', initGa)
    document.head.appendChild(script)

    return () => script.removeEventListener('load', initGa)
  }, [granted, gaId])

  // Route-change page views. Skips the initial path (initGa already sent it)
  // and de-duplicates on the *normalised* path, so navigating between two
  // authored slugs in the same family (both → /<locale>/<family>/<template>)
  // never fires twice, and a non-localized path fires nothing.
  useEffect(() => {
    if (!granted || !readyRef.current) return
    const normalized = normalizePublicPath(pathname)
    if (normalized === null) return
    if (lastPathRef.current === normalized) return
    sendPageView(pathname)
    lastPathRef.current = normalized
  }, [granted, pathname])

  if (!gaId) return null

  const showNotice =
    consent.preferencesOpen || (consent.choice === 'unset' && !consent.privacySignal)

  if (!showNotice) return null

  return (
    <AnalyticsConsentNotice
      privacyHref={privacyHref}
      privacySignal={consent.privacySignal}
      preferences={consent.preferencesOpen}
      currentChoice={consent.choice}
      onAccept={acceptAnalytics}
      onDecline={declineAnalytics}
      onClose={closeAnalyticsPreferences}
    />
  )
}

/**
 * Consent primitives for public-site analytics.
 *
 * Two independent inputs decide whether a Google tag ever loads:
 *
 *   1. A stored choice ('granted' | 'denied'), kept in localStorage ONLY. No
 *      cookie, no user id, no fingerprint — the value is a single opaque token
 *      unrelated to any identity.
 *   2. A browser privacy signal (Global Privacy Control or Do Not Track). When
 *      present, analytics defaults to denied and never loads, regardless of any
 *      stored choice.
 *
 * These helpers are pure and side-effect-light so they can be unit-tested
 * without a DOM. The subscribable store in `consent-store.ts` builds on them.
 */

export const CONSENT_STORAGE_KEY = 'omnix.analytics.consent'

export type ConsentChoice = 'granted' | 'denied'
export type ConsentState = 'unset' | ConsentChoice

export function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === 'granted' || value === 'denied'
}

function safeLocalStorage(explicit?: Storage | null): Storage | null {
  if (explicit !== undefined) return explicit
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Access to localStorage can throw in locked-down / private contexts.
    return null
  }
}

/** Read the persisted choice. Returns 'unset' when absent or unreadable. */
export function readStoredConsent(storage?: Storage | null): ConsentState {
  const store = safeLocalStorage(storage)
  if (!store) return 'unset'
  try {
    const value = store.getItem(CONSENT_STORAGE_KEY)
    return isConsentChoice(value) ? value : 'unset'
  } catch {
    return 'unset'
  }
}

/** Persist the choice in localStorage only. Never writes a cookie. */
export function writeStoredConsent(choice: ConsentChoice, storage?: Storage | null): void {
  const store = safeLocalStorage(storage)
  if (!store) return
  try {
    store.setItem(CONSENT_STORAGE_KEY, choice)
  } catch {
    // Nothing to recover; a failed write simply means the choice is not remembered.
  }
}

export interface PrivacySignalInputs {
  /** navigator.globalPrivacyControl */
  gpc?: unknown
  /** navigator.doNotTrack / window.doNotTrack / navigator.msDoNotTrack */
  dnt?: unknown
}

/**
 * Pure predicate: does either browser privacy signal ask us not to track?
 *
 * GPC is a boolean (or its string form on some engines). DNT is the historical
 * '1' / 'yes' string. Any positive form counts.
 */
export function isPrivacySignalActive({ gpc, dnt }: PrivacySignalInputs): boolean {
  if (gpc === true || gpc === '1' || gpc === 'true' || gpc === 'yes') return true
  return dnt === true || dnt === '1' || dnt === 'yes'
}

/** Read GPC / DNT from the live browser globals. Server-safe (returns false). */
export function readPrivacySignal(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    globalPrivacyControl?: unknown
    msDoNotTrack?: unknown
  }
  const win =
    typeof window !== 'undefined'
      ? (window as Window & { doNotTrack?: unknown })
      : undefined
  return isPrivacySignalActive({
    gpc: nav.globalPrivacyControl,
    dnt: nav.doNotTrack ?? win?.doNotTrack ?? nav.msDoNotTrack,
  })
}

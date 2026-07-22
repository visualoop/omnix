'use client'

/**
 * A tiny external store so two disconnected client islands — the analytics
 * component (rendered by the frontend layout) and the "Analytics preferences"
 * control (rendered inside the server-rendered footer) — can share one consent
 * state without prop-drilling through server components.
 *
 * State: the stored choice, whether a browser privacy signal is active, and
 * whether the preferences view is open. The store reads from and writes to
 * localStorage only (via `consent.ts`). A cross-tab `storage` event invalidates
 * the cache so a choice made in one tab is reflected in another.
 */
import { useSyncExternalStore } from 'react'

import {
  CONSENT_STORAGE_KEY,
  readPrivacySignal,
  readStoredConsent,
  writeStoredConsent,
  type ConsentChoice,
  type ConsentState,
} from './consent'

export interface ConsentSnapshot {
  choice: ConsentState
  privacySignal: boolean
  preferencesOpen: boolean
}

const SERVER_SNAPSHOT: ConsentSnapshot = {
  choice: 'unset',
  privacySignal: false,
  preferencesOpen: false,
}

const listeners = new Set<() => void>()
let cache: ConsentSnapshot | null = null
let preferencesOpen = false
let storageBound = false

function computeSnapshot(): ConsentSnapshot {
  return {
    choice: readStoredConsent(),
    privacySignal: readPrivacySignal(),
    preferencesOpen,
  }
}

function invalidate(): void {
  cache = null
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === CONSENT_STORAGE_KEY) invalidate()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!storageBound && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    storageBound = true
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && storageBound && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      storageBound = false
    }
  }
}

function getSnapshot(): ConsentSnapshot {
  if (!cache) cache = computeSnapshot()
  return cache
}

function getServerSnapshot(): ConsentSnapshot {
  return SERVER_SNAPSHOT
}

export function acceptAnalytics(): void {
  writeStoredConsent('granted')
  preferencesOpen = false
  invalidate()
}

export function declineAnalytics(): void {
  writeStoredConsent('denied')
  preferencesOpen = false
  invalidate()
}

export function openAnalyticsPreferences(): void {
  preferencesOpen = true
  invalidate()
}

export function closeAnalyticsPreferences(): void {
  preferencesOpen = false
  invalidate()
}

export function setAnalyticsConsent(choice: ConsentChoice): void {
  if (choice === 'granted') acceptAnalytics()
  else declineAnalytics()
}

/** React hook: subscribe to the shared consent snapshot. */
export function useAnalyticsConsent(): ConsentSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Test-only reset so store state does not leak between cases. */
export function __resetConsentStoreForTests(): void {
  cache = null
  preferencesOpen = false
}

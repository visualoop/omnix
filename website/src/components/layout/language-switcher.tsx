'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { routing } from '@/i18n/routing'

const LOCALE_LABELS: Record<string, string> = {
  ke: 'Kenya', us: 'United States', gb: 'United Kingdom', ng: 'Nigeria',
  gh: 'Ghana', za: 'South Africa', in: 'India', rw: 'Rwanda', tz: 'Tanzania',
  ug: 'Uganda', eg: 'Egypt', ae: 'United Arab Emirates',
  en: 'English', sw: 'Kiswahili', fr: 'Français', pt: 'Português',
  es: 'Español', ar: 'العربية',
}

/**
 * Compact language switcher for the site header.
 *
 * Switching emits a router.replace to the same pathname under the new
 * locale prefix. With localePrefix='as-needed', English routes drop
 * the prefix; everything else gets it.
 */
export function LanguageSwitcher({ locale, className }: { locale: string; className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const switchTo = (next: string) => {
    if (next === locale) return
    // Strip current-locale prefix from the pathname (if any) before
    // re-prefixing with the new locale.
    let stripped = pathname
    for (const l of routing.locales) {
      if (stripped === `/${l}` || stripped.startsWith(`/${l}/`)) {
        stripped = stripped.slice(l.length + 1) || '/'
        break
      }
    }
    // localePrefix is 'always' — every locale gets a prefix in the URL.
    const newPath = `/${next}${stripped === '/' ? '' : stripped}`
    startTransition(() => {
      router.replace(newPath)
    })
  }

  return (
    <select
      value={locale}
      onChange={(event) => switchTo(event.currentTarget.value)}
      disabled={isPending}
      className={className}
      aria-label="Select country / region"
    >
      {routing.locales.map((value) => (
        <option key={value} value={value}>
          {value.toUpperCase()} — {LOCALE_LABELS[value] ?? value}
        </option>
      ))}
    </select>
  )
}

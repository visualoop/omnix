'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { routing } from '@/i18n/routing'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const LOCALE_LABELS: Record<string, { flag: string; name: string }> = {
  en: { flag: '🇬🇧', name: 'English' },
  sw: { flag: '🇰🇪', name: 'Kiswahili' },
  fr: { flag: '🇫🇷', name: 'Français' },
  pt: { flag: '🇵🇹', name: 'Português' },
  es: { flag: '🇪🇸', name: 'Español' },
  ar: { flag: '🇦🇪', name: 'العربية' },
}

/**
 * Compact language switcher for the site header.
 *
 * Switching emits a router.replace to the same pathname under the new
 * locale prefix. With localePrefix='as-needed', English routes drop
 * the prefix; everything else gets it.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
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
    <Select value={locale} onValueChange={(v) => switchTo(String(v))} disabled={isPending}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
      {routing.locales.map((l) => {
        const label = LOCALE_LABELS[l] ?? { flag: '', name: l }
        return (
          <SelectItem key={l} value={l}>
            {label.flag} {label.name}
          </SelectItem>
        )
      })}
    </SelectContent></Select>
  )
}

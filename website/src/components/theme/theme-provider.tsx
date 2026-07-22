'use client'

/**
 * Theme provider — deterministic light first, explicit dark opt-in.
 *
 * Omnix is evaluated mainly in bright shops and offices. A first visit must
 * therefore render the high-contrast light palette regardless of OS theme.
 * The header toggle persists an explicit light/dark choice in localStorage.
 * Disabling transitions prevents every surface from fading during a switch.
 */
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

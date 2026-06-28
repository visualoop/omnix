'use client'

/**
 * Theme provider — wraps `next-themes` with our defaults.
 *
 * Decisions:
 *   - attribute="class" — flips a `.dark` class on <html>. Matches the
 *     globals.css structure (light = default, dark = .dark override).
 *   - defaultTheme="light" — Kenyan SME owners shop in daylight on
 *     uncalibrated screens; cream + espresso is the more legible
 *     starting point. Users can opt into dark via the header toggle or
 *     OS preference (when enableSystem is true).
 *   - enableSystem=true — if the OS is dark and they haven't picked
 *     anything yet, we follow that. Their explicit choice still wins.
 *   - disableTransitionOnChange=true — no flicker when flipping themes
 *     (otherwise Tailwind's transition utilities cause every coloured
 *     element to fade simultaneously, which looks bad).
 */
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

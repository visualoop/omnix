import { RootShell } from '@/components/layout/root-shell'

/**
 * /onboarding lives at the top level (not under a route group) so its
 * URL is short + memorable, but Next.js requires every page to live
 * under a layout that provides <html>/<body>. Without this file the
 * onboarding wizard renders without globals.css (no Tailwind, no
 * fonts) and the entire flow looks unstyled.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>
}

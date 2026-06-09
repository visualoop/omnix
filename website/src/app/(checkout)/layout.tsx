import { RootShell } from '@/components/layout/root-shell'

/**
 * Checkout route-group layout.
 *
 * /buy, /buy/[licenseId], /buy/success, /buy/cancelled — all rendered
 * with the shared RootShell so Tailwind + fonts + globals.css apply.
 * Each individual checkout page renders its own chrome (no shared
 * header/footer here — keeps the payment flow distraction-free).
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>
}

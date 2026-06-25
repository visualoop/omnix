/**
 * Checkout route-group layout.
 *
 * /buy, /buy/[licenseId], /buy/success, /buy/cancelled — each page
 * renders its own chrome (no shared header/footer here — keeps the
 * payment flow distraction-free). Root layout already provides
 * <html>/<body>/fonts/Tailwind.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}

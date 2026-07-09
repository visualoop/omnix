/**
 * Trade landing pages — per-vertical pitches.
 * Was a Payload global; lives in code now.
 *
 * Each variant key (dawa / retail / hospitality / hardware) has its own
 * hero copy, modules included, CTA. Read by VariantLanding component.
 */

export interface TradeLandingFeature {
  title: string
  body: string
}

export interface TradeLandingShape {
  hero: {
    title: string
    subtitle: string
    eyebrow?: string
  }
  features: TradeLandingFeature[]
  ctaPrimary: { label: string; href: string }
  ctaSecondary?: { label: string; href: string }
  pricingCallout?: string
}

export const tradeLandings: Record<string, TradeLandingShape> = {
  dawa: {
    hero: {
      eyebrow: 'Pharmacy',
      title: 'Run your pharmacy without losing receipts.',
      subtitle: 'KRA eTIMS auto-signing, SHA insurance claims, drug-interaction checks, expiry watch. Built for Kenyan pharmacies, not adapted from a general POS.',
    },
    features: [
      { title: 'eTIMS auto-sign', body: 'Every sale signs against KRA in the background. VAT3 returns generate themselves.' },
      { title: 'SHA + private claims', body: 'Member verification, copay split, batch submission. Days off your billing cycle.' },
      { title: 'Drug interactions', body: 'Warns before you hand over the bag. Patient profile keeps allergies one click away.' },
      { title: 'Cold chain', body: 'Fridge temperature log + alerts. Insulin and vaccines stay safe.' },
    ],
    ctaPrimary: { label: 'Try it free for 14 days', href: '/buy?variant=dawa' },
    ctaSecondary: { label: 'See the modules', href: '/modules' },
    pricingCallout: 'KSh 30,000 one-time + KSh 12,000/year for compliance updates',
  },
  retail: {
    hero: {
      eyebrow: 'Retail',
      title: 'Run your shop with the till that knows your stock.',
      subtitle: 'Multi-branch inventory, brand-mix insights, laybys, special orders. Built for Kenyan general retail.',
    },
    features: [
      { title: 'Multi-branch inventory', body: 'Move stock between branches. See which till sold what.' },
      { title: 'Laybys + special orders', body: 'Customer reserves, partial pays, picks up later.' },
      { title: 'Brand insights', body: 'Which brands move, which sit. Buy more of what works.' },
      { title: 'Shrinkage tracking', body: 'Daily counts vs system. Catch theft and breakage early.' },
    ],
    ctaPrimary: { label: 'Try it free for 14 days', href: '/buy?variant=retail' },
    ctaSecondary: { label: 'See the modules', href: '/modules' },
    pricingCallout: 'KSh 30,000 one-time + KSh 12,000/year for compliance updates',
  },
  hospitality: {
    hero: {
      eyebrow: 'Hospitality',
      title: 'Run your hotel, restaurant, or bar end to end.',
      subtitle: 'Tables, kitchen display, rooms, bookings, folios, recipes. Front-of-house and back-of-house in one app.',
    },
    features: [
      { title: 'Table service + KOT', body: 'Waiter takes orders on a tablet. Kitchen display bumps when ready.' },
      { title: 'Rooms + bookings', body: 'Reservations, housekeeping, folios, check-in/out. M-Pesa or card.' },
      { title: 'Recipe costing', body: 'Sale of one ugali consumes flour, oil, salt by recipe. Inventory accurate to the gram.' },
      { title: 'Tips + service charge', body: 'Auto-split per shift. Employee report at end of month.' },
    ],
    ctaPrimary: { label: 'Try it free for 14 days', href: '/buy?variant=hospitality' },
    ctaSecondary: { label: 'See the modules', href: '/modules' },
    pricingCallout: 'KSh 30,000 one-time + KSh 12,000/year for compliance updates',
  },
  hardware: {
    hero: {
      eyebrow: 'Hardware',
      title: 'Run your hardware store with quotes and credit.',
      subtitle: 'Quotations, delivery notes, contractor accounts, sales-rep commissions. Built for the way Kenyan hardware actually trades.',
    },
    features: [
      { title: 'Quotes → invoices', body: 'Quote a contractor, convert to invoice when accepted. No retyping.' },
      { title: 'Delivery notes', body: 'Print + sign on dispatch. Receivable opens when goods leave.' },
      { title: 'Contractor accounts', body: 'Per-account credit limit, statement on demand, reminder before due.' },
      { title: 'Rep commissions', body: 'Auto-calculated per sale. Pay rep at end of month, not from memory.' },
    ],
    ctaPrimary: { label: 'Try it free for 14 days', href: '/buy?variant=hardware' },
    ctaSecondary: { label: 'See the modules', href: '/modules' },
    pricingCallout: 'KSh 30,000 one-time + KSh 12,000/year for compliance updates',
  },
  salon: {
    hero: {
      eyebrow: 'Salon & Spa',
      title: 'Run your salon from one calm diary.',
      subtitle: 'Appointments, staff commissions, packages and client history — built for Kenyan salons, barbershops, nail bars and spas.',
    },
    features: [
      { title: 'Appointment diary', body: 'Book by staff, day or week. No double-bookings — the diary checks the clash for you.' },
      { title: 'Staff commissions', body: 'Per-service or default rate, accrued automatically at checkout. Pay from the report, not memory.' },
      { title: 'Packages & memberships', body: 'Sell a 10-session bundle up front; sessions redeem themselves at checkout.' },
      { title: 'Client history & back-bar', body: 'Formulas, preferences and every past visit. Products used deduct from stock.' },
    ],
    ctaPrimary: { label: 'Try it free for 14 days', href: '/buy?variant=salon' },
    ctaSecondary: { label: 'See the modules', href: '/modules' },
    pricingCallout: 'KSh 30,000 one-time + KSh 12,000/year for compliance updates',
  },
}

export function getTradeLanding(variant: string): TradeLandingShape | null {
  return tradeLandings[variant] ?? null
}

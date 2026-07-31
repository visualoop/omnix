import type { LaunchMarketLocale } from '@/i18n/routing'
import type { DisplayCurrency } from '@/lib/currency'

export interface MarketFact {
  label: string
  value: string
}

export interface MarketUseCase {
  title: string
  body: string
}

export interface MarketFaqEntry {
  question: string
  answer: string
}

export interface MarketProfile {
  locale: LaunchMarketLocale
  country: string
  demonym: string
  currency: DisplayCurrency
  taxAuthority: {
    name: string
    acronym: string
  }
  paymentMethods: readonly string[]
  businessTerms: readonly string[]
  hero: {
    overline: string
    title: string
    lede: string
  }
  facts: readonly MarketFact[]
  marketHeading: string
  marketIntro: string
  paymentContext: string
  taxContext: string
  useCases: readonly MarketUseCase[]
  seo: {
    title: string
    description: string
    ogLocale: string
    keywords: readonly string[]
  }
  faq: readonly MarketFaqEntry[]
}

const SHARED_KEYWORDS = [
  'offline POS software',
  'inventory management software',
  'pharmacy POS',
  'retail POS',
  'restaurant POS',
  'hardware store software',
  'salon software',
] as const

export const MARKET_PROFILES = {
  ke: {
    locale: 'ke',
    country: 'Kenya',
    demonym: 'Kenyan',
    currency: 'KES',
    taxAuthority: {
      name: 'Kenya Revenue Authority',
      acronym: 'KRA',
    },
    paymentMethods: ['Cash', 'M-Pesa', 'Card', 'Bank'],
    businessTerms: ['duka', 'chemist', 'mini-mart', 'hardware shop'],
    hero: {
      overline: 'POS and inventory for Kenyan counters',
      title: 'Run the counter. Keep M-Pesa, stock and records together.',
      lede:
        'Omnix keeps the day moving offline, then handles configured M-Pesa and KRA eTIMS work when a connection is available. Choose the product shaped for your duka, chemist, restaurant, hardware shop or salon.',
    },
    facts: [
      { label: 'At checkout', value: 'Cash, M-Pesa, card and bank' },
      { label: 'Local list price', value: 'Shown in KES' },
      { label: 'Connected services', value: 'KRA eTIMS; SHA for pharmacy' },
    ],
    marketHeading: 'Built around a Kenyan working day.',
    marketIntro:
      'A duka needs quick sales and honest stock. A chemist adds prescriptions, batches and expiry. Restaurants need kitchen orders; hardware shops need quotations and contractor accounts. Omnix starts with those real counter differences instead of forcing every trade into one generic till.',
    paymentContext:
      'Cash records stay local. Configured M-Pesa requests and confirmations use supported connected services, so the sale can continue to be recorded while the internet is unavailable and connected work resumes when the line returns.',
    taxContext:
      'The relevant authority is the Kenya Revenue Authority (KRA). Omnix includes configured KRA eTIMS workflows, but your registration, credentials, filing and statutory obligations remain with your business.',
    useCases: [
      {
        title: 'Chemist and pharmacy counters',
        body: 'Dispense against prescriptions, watch batch expiry, maintain controlled-medicine records and keep SHA or private-insurance work attached to the sale.',
      },
      {
        title: 'Dukas and mini-marts',
        body: 'Scan barcodes, hold a sale, take a return, run promotions and see which shelf needs replenishment without waiting for the internet.',
      },
      {
        title: 'Hardware and contractor trade',
        body: 'Quote before sale, issue delivery notes, manage contractor credit and track serialized equipment and warranty records.',
      },
    ],
    seo: {
      title: 'Offline POS with M-Pesa and KRA eTIMS for Kenya | Omnix',
      description:
        'Offline POS and inventory software for Kenyan dukas, pharmacies, restaurants, hardware shops and salons, with configured M-Pesa, KRA eTIMS and SHA pharmacy workflows.',
      ogLocale: 'en_KE',
      keywords: [
        'POS with M-Pesa',
        'POS system Kenya',
        'KRA eTIMS POS',
        'pharmacy software Kenya',
        'duka POS Kenya',
        ...SHARED_KEYWORDS,
      ],
    },
    faq: [
      {
        question: 'Does Omnix keep selling when the internet is down in Kenya?',
        answer:
          'Yes. Core sales, inventory and business records use the local desktop database. Connected M-Pesa, KRA eTIMS and SHA actions still need the relevant external service and an internet connection.',
      },
      {
        question: 'Which Kenya-specific integrations does Omnix support?',
        answer:
          'Omnix supports configured M-Pesa and KRA eTIMS workflows. The pharmacy product also includes SHA and private-insurance workflows. Each service still requires the business to hold the right registration, account and credentials.',
      },
      {
        question: 'Which Kenyan businesses can use Omnix?',
        answer:
          'Omnix has dedicated products for pharmacies and chemists, retail shops and mini-marts, restaurants and hotels, hardware and equipment businesses, and salons and spas.',
      },
    ],
  },
  ug: {
    locale: 'ug',
    country: 'Uganda',
    demonym: 'Ugandan',
    currency: 'UGX',
    taxAuthority: {
      name: 'Uganda Revenue Authority',
      acronym: 'URA',
    },
    paymentMethods: ['Cash', 'MTN MoMo', 'Airtel Money', 'Bank'],
    businessTerms: ['retail shop', 'wholesale counter', 'pharmacy', 'restaurant'],
    hero: {
      overline: 'Offline POS for Ugandan SMEs',
      title: 'Keep the shop moving when the connection does not.',
      lede:
        'Record sales, receiving and stock locally in one Windows desktop app. Omnix is shaped for Ugandan retail and wholesale counters, pharmacies, restaurants, hardware stores and salons, with list prices shown in UGX.',
    },
    facts: [
      { label: 'Payment context', value: 'Cash, MTN MoMo and Airtel Money' },
      { label: 'Local list price', value: 'Shown in UGX' },
      { label: 'Tax context', value: 'URA; no fiscal integration claimed' },
    ],
    marketHeading: 'For the shop floor, stockroom and mobile-money conversation.',
    marketIntro:
      'Ugandan businesses often need one person to sell, receive stock and answer customer-account questions from the same counter. Omnix keeps those records together locally, whether the business is a neighbourhood retail shop, a wholesale counter or a multi-department pharmacy.',
    paymentContext:
      'Cash can be recorded locally. MTN MoMo and Airtel Money are included here as payment terminology customers and staff recognise; Omnix does not claim a direct Uganda mobile-money integration on this page. Confirm the exact recording and reconciliation workflow during a demo.',
    taxContext:
      'The relevant authority is the Uganda Revenue Authority (URA). Omnix does not currently claim an integration with URA fiscal systems. Your business should confirm its invoicing, fiscal-device and filing duties directly with URA or a qualified adviser.',
    useCases: [
      {
        title: 'Retail and wholesale counters',
        body: 'Sell by barcode, maintain price lists, receive supplier deliveries and keep customer credit and stock movement in the same record.',
      },
      {
        title: 'Pharmacies with expiry risk',
        body: 'Track batches and expiry dates, prescriptions, patient records and controlled-register work without depending on a browser connection.',
      },
      {
        title: 'Restaurants and bars',
        body: 'Send kitchen orders, manage tables, cost recipes and close the shift against the sales and payments already recorded.',
      },
    ],
    seo: {
      title: 'Offline POS software for Ugandan shops and pharmacies | Omnix',
      description:
        'Offline POS and inventory software for Ugandan retail and wholesale shops, pharmacies, restaurants, hardware stores and salons. Local UGX pricing; Windows desktop app.',
      ogLocale: 'en_UG',
      keywords: [
        'POS software Uganda',
        'UGX POS pricing',
        'pharmacy software Uganda',
        'retail shop POS Uganda',
        'restaurant POS Uganda',
        ...SHARED_KEYWORDS,
      ],
    },
    faq: [
      {
        question: 'Does Omnix work offline for a Ugandan shop?',
        answer:
          'Yes. Core sales, inventory, purchasing and business records are stored in the local desktop database, so normal counter work does not depend on a continuous internet connection.',
      },
      {
        question: 'Does Omnix connect directly to MTN MoMo or Airtel Money in Uganda?',
        answer:
          'No direct Uganda mobile-money integration is claimed on this page. Omnix can keep the local sale and payment record, and a demo can confirm the supported recording and reconciliation workflow before you buy.',
      },
      {
        question: 'Does Omnix integrate with Uganda Revenue Authority systems?',
        answer:
          'Omnix does not currently claim a URA fiscal integration. Uganda Revenue Authority requirements remain the responsibility of the business, which should confirm the applicable process with URA or a qualified adviser.',
      },
    ],
  },
  tz: {
    locale: 'tz',
    country: 'Tanzania',
    demonym: 'Tanzanian',
    currency: 'TZS',
    taxAuthority: {
      name: 'Tanzania Revenue Authority',
      acronym: 'TRA',
    },
    paymentMethods: ['Cash', 'M-Pesa', 'Airtel Money', 'Bank'],
    businessTerms: ['duka', 'famasi', 'mgahawa', 'hardware yard'],
    hero: {
      overline: 'POS and stock control for Tanzania',
      title: 'Run the duka from first sale to stock count.',
      lede:
        'Omnix gives Tanzanian dukas, famasi, restaurants, lodges, hardware yards and salons a local sales and inventory record that keeps working offline. Public prices are displayed in TZS.',
    },
    facts: [
      { label: 'Payment context', value: 'Cash, M-Pesa and Airtel Money' },
      { label: 'Local list price', value: 'Shown in TZS' },
      { label: 'Tax context', value: 'TRA; no fiscal integration claimed' },
    ],
    marketHeading: 'One operating record across the duka and store room.',
    marketIntro:
      'A duka needs fast checkout and dependable stock. A famasi needs batch and expiry control. A restaurant or lodge needs kitchen, table, room and folio work to meet at checkout. Omnix keeps each of those flows local instead of turning a weak connection into a closed till.',
    paymentContext:
      'Cash can be recorded locally. M-Pesa and Airtel Money are named as familiar payment terminology, not as a claim of direct Tanzania provider integration. Ask for a demo of the exact payment-recording and reconciliation path your business needs.',
    taxContext:
      'The relevant authority is the Tanzania Revenue Authority (TRA). Omnix does not currently claim an integration with TRA fiscal systems. Confirm fiscal receipt, device and filing requirements with TRA or a qualified adviser before deployment.',
    useCases: [
      {
        title: 'Dukas and mini-markets',
        body: 'Move barcode sales quickly, manage variants and promotions, receive purchases and see restock needs from the local inventory record.',
      },
      {
        title: 'Restaurants, bars and lodges',
        body: 'Connect tables and kitchen orders with recipe costing, or manage rooms, bookings and guest folios through checkout.',
      },
      {
        title: 'Hardware yards and equipment sellers',
        body: 'Prepare quotations, handle bulk prices and contractor accounts, issue delivery notes and retain serial and warranty history.',
      },
    ],
    seo: {
      title: 'Offline POS software for Tanzanian dukas and restaurants | Omnix',
      description:
        'Offline POS and stock software for Tanzanian dukas, famasi, restaurants, lodges, hardware yards and salons. Local TZS pricing in a Windows desktop app.',
      ogLocale: 'en_TZ',
      keywords: [
        'POS software Tanzania',
        'duka POS Tanzania',
        'TZS POS pricing',
        'pharmacy software Tanzania',
        'restaurant POS Tanzania',
        ...SHARED_KEYWORDS,
      ],
    },
    faq: [
      {
        question: 'Can a Tanzanian duka use Omnix without constant internet?',
        answer:
          'Yes. Core sales, stock, purchasing and business records run against the local desktop database. Features that contact an external provider still need a connection.',
      },
      {
        question: 'Does Omnix include direct M-Pesa or Airtel Money integration in Tanzania?',
        answer:
          'No direct Tanzania mobile-money integration is claimed on this page. The demo will separate locally recorded payments from any provider-connected workflow so you can verify the fit before purchase.',
      },
      {
        question: 'Does Omnix integrate with Tanzania Revenue Authority systems?',
        answer:
          'Omnix does not currently claim a TRA fiscal integration. The business remains responsible for confirming and meeting Tanzania Revenue Authority requirements.',
      },
    ],
  },
  rw: {
    locale: 'rw',
    country: 'Rwanda',
    demonym: 'Rwandan',
    currency: 'RWF',
    taxAuthority: {
      name: 'Rwanda Revenue Authority',
      acronym: 'RRA',
    },
    paymentMethods: ['Cash', 'MTN MoMo', 'Airtel Money', 'Bank'],
    businessTerms: ['shop', 'boutique', 'pharmacy', 'salon'],
    hero: {
      overline: 'Local-first business software for Rwanda',
      title: 'One local record for every sale and stock move.',
      lede:
        'Omnix keeps Rwandan shops, boutiques, pharmacies, restaurants, hardware businesses and salons working from a local Windows database. Sales and inventory stay available offline, with list prices shown in RWF.',
    },
    facts: [
      { label: 'Payment context', value: 'Cash, MTN MoMo and Airtel Money' },
      { label: 'Local list price', value: 'Shown in RWF' },
      { label: 'Tax context', value: 'RRA; no fiscal integration claimed' },
    ],
    marketHeading: 'A clear record for compact teams doing several jobs.',
    marketIntro:
      'A boutique may sell variants and manage loyal customers from one desk. A pharmacy watches expiry as closely as sales. A salon moves between appointments, service checkout and stock. Omnix gives each team one local source for the work instead of scattered notebooks and spreadsheets.',
    paymentContext:
      'Cash can be recorded locally. MTN MoMo and Airtel Money are listed as recognisable payment terminology; this page does not claim a direct Rwanda provider integration. Verify the recording and reconciliation flow in a guided demo.',
    taxContext:
      'The relevant authority is the Rwanda Revenue Authority (RRA). Omnix does not currently claim an integration with RRA fiscal systems. Confirm the fiscal invoicing and reporting process that applies to your business with RRA or a qualified adviser.',
    useCases: [
      {
        title: 'Boutiques and retail shops',
        body: 'Sell colour and size variants, manage price lists and loyalty, take returns and keep replenishment decisions tied to actual stock.',
      },
      {
        title: 'Pharmacies and dispensaries',
        body: 'Manage prescriptions, patient records, batches, expiry and controlled-register work from the same local system as checkout.',
      },
      {
        title: 'Salons and spas',
        body: 'Schedule appointments, match staff skills, calculate commissions and track packages, memberships and back-bar stock.',
      },
    ],
    seo: {
      title: 'Offline POS software for Rwandan shops and salons | Omnix',
      description:
        'Offline POS and inventory software for Rwandan shops, boutiques, pharmacies, restaurants, hardware businesses and salons. Local RWF pricing for Windows.',
      ogLocale: 'en_RW',
      keywords: [
        'POS software Rwanda',
        'RWF POS pricing',
        'boutique software Rwanda',
        'pharmacy POS Rwanda',
        'salon software Rwanda',
        ...SHARED_KEYWORDS,
      ],
    },
    faq: [
      {
        question: 'Does Omnix work offline for a Rwandan business?',
        answer:
          'Yes. Core counter, stock, purchasing and business records use a local desktop database. A connection is needed only when a workflow must reach an external service.',
      },
      {
        question: 'Does Omnix connect directly to MTN MoMo or Airtel Money in Rwanda?',
        answer:
          'No direct Rwanda mobile-money integration is claimed on this page. A guided demo can show how payments are recorded locally and identify any provider-dependent step before you buy.',
      },
      {
        question: 'Does Omnix integrate with Rwanda Revenue Authority systems?',
        answer:
          'Omnix does not currently claim an RRA fiscal integration. The business remains responsible for confirming and meeting Rwanda Revenue Authority invoicing and reporting requirements.',
      },
    ],
  },
} as const satisfies Readonly<Record<LaunchMarketLocale, MarketProfile>>

export function getMarketProfile(locale: string | null | undefined): MarketProfile {
  const normalized = (locale ?? '').toLowerCase()
  if (normalized === 'ug' || normalized === 'tz' || normalized === 'rw') {
    return MARKET_PROFILES[normalized]
  }
  return MARKET_PROFILES.ke
}

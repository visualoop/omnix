/**
 * Kenya local-SEO location registry. Task 18 (foundation) through Task 20.
 *
 * These are city-level *buyer* hubs, not landing pages that fake a local
 * presence. Each published hub helps a business owner in one Kenyan town
 * decide on software, states honest local operating patterns, points at the
 * five products, and is explicit that Omnix is a Windows desktop product bought
 * online. There is no local office, and the renderer says so in plain words.
 *
 * WHAT SHIPPED, IN ORDER: Task 18 built the type system, the index/hub
 * renderers, and a strict publication-quality gate, holding all ten planned
 * cities as clearly-unpublished drafts. Task 19 published the first three hubs
 * (Nairobi, Mombasa, Nakuru). Task 20 published the remaining seven (Kisumu,
 * Eldoret, Thika, Machakos, Meru, Nyeri, Kisii). All ten now carry real audit
 * metadata and clear the gate (see "How entries are authored" at the foot).
 *
 * WHY A GATE: local pages are the classic home of doorway / scaled-content
 * abuse (near-identical "software in <town>" pages that carry no real value).
 * `isPublishableLocation` refuses to render, index, or sitemap any entry that
 * is thin, templated, unapproved, or makes a claim we cannot stand behind.
 *
 * Pricing facts come from `@/config/pricing` so the KES 30,000 perpetual
 * licence and optional KES 12,000/year compliance plan are never restated by
 * hand and cannot drift.
 */
import { pricing } from './pricing'

/** The five shipped products a city hub navigates to. */
export type LocationProductId = 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'

/**
 * Publication lifecycle. Only 'published' entries can ever render/index, and
 * only alongside complete audit metadata (see the gate). Drafts and in-review
 * entries are held in the registry without being exposed.
 */
export type PublicationStatus = 'draft' | 'in-review' | 'approved' | 'published'

/**
 * Audit trail for a publication decision. Static config is acceptable; we do
 * NOT fabricate an approver. A draft keeps `approvedBy`/`approvedAt` null, and
 * the gate treats a missing approver as "not publishable" regardless of status.
 */
export interface LocationAudit {
  /** Named human who approved publication. Null until a real person signs off. */
  approvedBy: string | null
  /** ISO date of approval. Null until approved. */
  approvedAt: string | null
  /** Free-text review context (not rendered). */
  reviewNotes: string
}

/** A factual local claim plus where it comes from (evidence note). */
export interface LocationSource {
  claim: string
  note: string
}

/** One product entry in the five-product navigation, with city-local workflow copy. */
export interface LocationProductLink {
  id: LocationProductId
  /** Display name, e.g. "Omnix Pharmacy". */
  label: string
  /** Product page path within the locale, e.g. "/pharmacy". */
  path: string
  /** Demo pre-selection passed as ?product= on the contact route. */
  demoProduct: LocationProductId
  /**
   * How this product serves a buyer IN THIS CITY. Must be locally specific
   * (>= 60 chars), not a generic product blurb copied across cities.
   */
  localWorkflow: string
}

export interface KenyaLocation {
  slug: string
  city: string
  county: string
  region: string

  /** Explicit lifecycle + audit. Only published + approved + gate-passing renders. */
  status: PublicationStatus
  audit: LocationAudit
  /** Honest authored/reviewed date used for Article JSON-LD. */
  updated: string

  // Unique metadata.
  metaTitle: string
  metaDescription: string
  keywords: string[]
  ogTitle: string
  ogDescription: string

  // Hero.
  kicker: string
  title: string
  titleAccent: string
  /** Distinct intro / lede for this city. */
  intro: string

  // City / county / region context.
  contextIntro: string
  contextPoints: string[]

  // Honest buyer operating patterns.
  operatingIntro: string
  operatingPatterns: string[]

  // Product relevance with specific, locally relevant workflows.
  productIntro: string
  products: LocationProductLink[]

  // Connectivity / logistics / payment / tax boundaries.
  boundaryIntro: string
  local: string[]
  connected: string[]

  // Migration / evaluation advice.
  evaluationIntro: string
  evaluationPoints: string[]

  // Source / evidence notes for factual local claims.
  sources: LocationSource[]
}

/** The ten cities the registry is planned to support. Order is display order. */
export const PLANNED_CITIES = [
  'Nairobi',
  'Mombasa',
  'Nakuru',
  'Kisumu',
  'Eldoret',
  'Thika',
  'Machakos',
  'Meru',
  'Nyeri',
  'Kisii',
] as const

/**
 * Canonical product metadata reused by every city hub. Task 19/20 authors take
 * these and add city-specific `localWorkflow` copy per product.
 */
export const LOCATION_PRODUCT_META: Record<
  LocationProductId,
  { label: string; path: string; demoProduct: LocationProductId }
> = {
  pharmacy: { label: 'Omnix Pharmacy', path: '/pharmacy', demoProduct: 'pharmacy' },
  retail: { label: 'Omnix Retail', path: '/retail', demoProduct: 'retail' },
  hospitality: { label: 'Omnix Hospitality', path: '/hospitality', demoProduct: 'hospitality' },
  hardware: { label: 'Omnix Hardware & Equipment', path: '/hardware', demoProduct: 'hardware' },
  salon: { label: 'Omnix Salon & Spa', path: '/salon', demoProduct: 'salon' },
}

/** The five product ids a complete hub must navigate to. */
export const REQUIRED_PRODUCT_IDS: readonly LocationProductId[] = [
  'pharmacy',
  'retail',
  'hospitality',
  'hardware',
  'salon',
]

/**
 * The registry. All ten planned cities are now authored and published: the
 * three foundation hubs (Task 19) plus the seven Task 20 hubs. Every entry is a
 * complete, materially-unique buyer guide that clears `locationGateIssues`, and
 * the set as a whole clears `locationUniquenessIssues`. The publication gate and
 * uniqueness filter below are what let this list be trusted: any future entry
 * that is thin, templated, unapproved, or makes an unsupportable claim is
 * refused before it can render, index, or reach the sitemap.
 */
export const KENYA_LOCATIONS: readonly KenyaLocation[] = [
  // ── Nairobi (Task 19). Dense, mixed-format capital trade; branch/device
  //    planning; delivery timing around traffic. ──────────────────────────────
  {
    slug: 'nairobi',
    city: 'Nairobi',
    county: 'Nairobi',
    region: 'Nairobi Metropolitan',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 19)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 19: Nairobi buyer content authored and checked against locationGateIssues(); local claims cite KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Nairobi shops \u00b7 Omnix',
    metaDescription:
      'How a Nairobi shop chooses Omnix in a dense, mixed-format market: the way city counters trade, which of the five products fits, what keeps working when the line drops, and the one-time licence.',
    keywords: [
      'POS system Nairobi',
      'business software Nairobi',
      'Nairobi shop software',
      'M-Pesa POS Nairobi',
      'offline POS Nairobi',
      'multi-branch POS Nairobi',
    ],
    ogTitle: 'Choosing Omnix in Nairobi',
    ogDescription:
      'A buying guide for Nairobi owners in a high-volume city market, honest about the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Nairobi',
    title: 'Choosing business software',
    titleAccent: 'in Nairobi.',
    intro:
      'Trade in Nairobi packs a lot into a small map. A CBD counter, an estate mini-mart and a mall unit can sit within a few kilometres of each other, each serving a different crowd at a different pace. This guide walks how those counters actually take money through the day, points to which of the five Omnix products fits your line of trade, and stays honest about what runs on the computer in front of you and what waits for a connection.',
    contextIntro:
      'Nairobi is where a large share of Kenya\u2019s formal retail concentrates, so rent, competition and staff turnover all run higher than in a smaller town.',
    contextPoints: [
      'Nairobi City County is Kenya\u2019s capital and, in the 2019 census, its most populous county, so a city counter serves steady, high foot traffic.',
      'Formats sit side by side here: CBD shops, estate dukas, supermarket units and mall stores each trade to a different rhythm.',
      'Card and mobile-money payments are common alongside cash, so owners expect more than one tender type on a single sale.',
      'Many owners plan for more than one till, or a second branch, before the first year is out.',
    ],
    operatingIntro:
      'Counters in the city tend to open long hours and share a till across more than one cashier, so speed at the point of sale and a clean handover at shift change carry real weight.',
    operatingPatterns: [
      'Long trading days with several cashiers signing in and out of one system across a shift.',
      'Cash, M-Pesa and card often recorded against the same sale, then reconciled at close.',
      'Deliveries timed around traffic, so goods-in and price updates happen in the quieter parts of the day.',
      'Owners weighing a second till or branch want the same catalogue and prices to carry across devices.',
    ],
    productIntro:
      'The same five products run in the city; the one that fits depends on the trade you are in, not the part of town you trade from.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Nairobi chemist running a busy estate or hospital-adjacent counter can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A city mini-mart or CBD general shop gets barcode selling, held sales for queue spikes and stock that drops as it sells, quick enough for a counter that never really slows between deliveries.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Nairobi cafe, bar or eatery can hold tables open through a long lunch rush, fire orders to the kitchen and split a bill three ways, with recipe costing tied back to what leaves the store.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A hardware yard serving city sites can quote a contractor, turn that quote into an invoice without retyping, sell on account with monthly statements and print a delivery note as material leaves for a job across town.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Nairobi salon or barbershop can book by stylist across a full week, keep client history at the chair, deduct back-bar stock as it is used and work out commission at checkout, all on one shared diary.',
      },
    ],
    boundaryIntro:
      'The question that matters in any Kenyan town is what still works when the connection drops. In the city, where a queue forms fast, it matters even more. Keep the local job and the connected job apart before you commit.',
    local: [
      'Ringing up a sale and taking cash, M-Pesa or card against it.',
      'Printing and reprinting receipts at the counter.',
      'Recording stock movement as items sell, on each device.',
      'Reading the day\u2019s takings and cash position at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to the customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, with queued invoices retried when the line returns.',
    ],
    evaluationIntro:
      'Put these to any vendor selling into the city, not only to us, before money changes hands.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet is down, which in the city can be for minutes at a time in a storm or a power cut?',
      'Does it use your own Safaricom M-Pesa account, and who carries the transaction fee?',
      'If you add a second till or branch, do the catalogue, prices and reports stay in step across devices?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Nairobi City County is Kenya\u2019s capital and, in the 2019 census, its most populous county.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census Results (knbs.or.ke/2019-kenya-population-and-housing-census-results). A buyer reads this as dense, high-volume trade, so counter speed and a clean shift handover weigh more than in a quiet town.',
      },
      {
        claim: 'Nairobi is among the smallest counties by area yet the most populous, giving it high population density.',
        note: 'Kenya National Bureau of Statistics county figures from the 2019 census (knbs.or.ke). High density concentrates foot traffic per shop, which is why owners here plan for queues and often a second till before adding floor space.',
      },
    ],
  },
  // ── Mombasa (Task 19). Coast and port-linked trade; hospitality operations. ─
  {
    slug: 'mombasa',
    city: 'Mombasa',
    county: 'Mombasa',
    region: 'Coast',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 19)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 19: Mombasa buyer content authored and checked against locationGateIssues(); local claims cite Kenya Ports Authority and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Mombasa shops and hotels \u00b7 Omnix',
    metaDescription:
      'How a Mombasa business chooses Omnix on the coast: the way port-linked stock and tourist-season trade actually run, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Mombasa',
      'business software Mombasa',
      'hotel POS Mombasa',
      'restaurant POS Mombasa',
      'M-Pesa POS Mombasa',
      'offline POS Mombasa',
    ],
    ogTitle: 'Choosing Omnix in Mombasa',
    ogDescription:
      'A buying guide for Mombasa owners at the coast, honest about seasonal trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Mombasa',
    title: 'Choosing coastal business software',
    titleAccent: 'in Mombasa.',
    intro:
      'Mombasa keeps two clocks. One runs on ships and clearing, where stock lands in big, irregular consignments through the port. The other runs on visitors, filling beach hotels and restaurants hard in some months and leaving them quiet in others. A counter in Mombasa has to cope with both. This guide walks how coastal businesses actually trade, points to which of the five Omnix products fits, and is straight about what runs on the device and what needs a connection.',
    contextIntro:
      'Mombasa sits on the Indian Ocean coast, and its trade leans on two things a landlocked town does not have: a working seaport and a tourist season.',
    contextPoints: [
      'The Port of Mombasa is the principal seaport for Kenya and a landlocked hinterland reaching Uganda, Rwanda, South Sudan and beyond, so a lot of local stock arrives by container and clearing rather than off a lorry from town.',
      'Tourism swings footfall through the year, so hotels, restaurants and shops near the beaches plan stock and staff around peak and quiet months.',
      'Swahili coastal trade mixes long-standing family shops with hospitality aimed at visitors, so formats vary area by area.',
      'Clearing and shipping timelines shape when goods land, so receiving needs to handle a large consignment in one go.',
    ],
    operatingIntro:
      'Trade on the coast bunches up. A hotel or restaurant fills fast in season and a shop clears a container in a burst, so software has to handle a rush and a lull rather than a steady middle.',
    operatingPatterns: [
      'Seasonal peaks around holiday travel, with hospitality busiest when visitors arrive.',
      'Stock landing in large, irregular consignments through the port and clearing, then selling down over weeks.',
      'Cash and M-Pesa lead most counters, with card more common in hotels and tourist areas.',
      'Hospitality tables and room tabs running alongside ordinary retail in the same town.',
    ],
    productIntro:
      'All five products run on the coast; which one fits turns on whether you sell goods, serve guests, or both.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A coastal chemist can keep dispensing, batch and expiry tracking and the controlled register working on the device through a power dip, while SHA checks, M-Pesa and eTIMS wait for the line, useful where humidity and heat make expiry watching a daily job.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Mombasa general shop or supermarket can receive a whole container line against a goods received note, price it, and let stock draw down on the counter as it sells over the following weeks.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A beach hotel, bar or seafood restaurant can hold room tabs and tables open, fire orders to the kitchen, cost a plate against its ingredients and split a bill for a group, then read the season back at shift close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A coastal hardware or building-supplies yard can quote a contractor, turn the quote into an invoice, sell on account with statements and issue a delivery note as material leaves for a site up the coast.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Mombasa salon or spa can book by staff across the week, keep client history at the chair, draw down packages that visitors buy for a stay and deduct back-bar stock, working out commission at checkout.',
      },
    ],
    boundaryIntro:
      'Power and connectivity on the coast can dip in the heat of the afternoon or a heavy downpour. Know which parts of the flow hold on the device and which reach outside before you decide.',
    local: [
      'Ringing up a sale and taking cash, M-Pesa or card at the counter.',
      'Receiving a large delivery against a goods received note.',
      'Opening tables and room tabs, and sending orders to the kitchen.',
      'Reading the day\u2019s takings, stock and cash position.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a guest or customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, retried when the connection returns.',
      'Online SHA or private insurance checks where a chemist needs them.',
    ],
    evaluationIntro:
      'Ask these of any vendor selling on the coast, not only of us, before you sign anything.',
    evaluationPoints: [
      'Does it keep selling and serving when power or the line drops in the afternoon heat?',
      'Can it receive a large consignment in one goods received note, with batch and expiry where it matters?',
      'For a hotel or restaurant, can it hold tables and room tabs and split a bill on the same check?',
      'Is the price a one-time licence or a running subscription, and does the software keep working if you stop paying?',
    ],
    sources: [
      {
        claim: 'The Port of Mombasa is the principal seaport serving Kenya and a landlocked hinterland across the region.',
        note: 'Kenya Ports Authority, Port of Mombasa (kpa.co.ke/Ports/PortOfMombasa). For a buyer this explains why coastal stock often lands by container and clearing, so receiving and stock valuation carry more weight than in an inland town.',
      },
      {
        claim: 'Mombasa is a coastal city on the Indian Ocean and one of Kenya\u2019s 47 counties.',
        note: 'Kenya administrative geography and Kenya National Bureau of Statistics county records (knbs.or.ke). Its coastal, tourism-facing trade is why the hospitality product and seasonal stock planning matter here more than in a purely inland market.',
      },
    ],
  },
  // ── Nakuru (Task 19). Regional distribution and agri-linked trade; mixed
  //    urban operations in an established Rift Valley city. ──────────────────────
  {
    slug: 'nakuru',
    city: 'Nakuru',
    county: 'Nakuru',
    region: 'Rift Valley',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 19)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 19: Nakuru buyer content authored and checked against locationGateIssues(); local claims cite the City of Nakuru official site and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Nakuru shops and distributors \u00b7 Omnix',
    metaDescription:
      'How a Nakuru business chooses Omnix in a regional hub: the way distribution and agri-linked trade run, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Nakuru',
      'business software Nakuru',
      'wholesale POS Nakuru',
      'distributor software Nakuru',
      'M-Pesa POS Nakuru',
      'offline POS Nakuru',
    ],
    ogTitle: 'Choosing Omnix in Nakuru',
    ogDescription:
      'A buying guide for Nakuru owners in a Rift Valley hub, honest about wholesale and agri-linked trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Nakuru',
    title: 'Choosing software for a regional hub',
    titleAccent: 'in Nakuru.',
    intro:
      'Nakuru works as a market town for the farms and smaller centres around it. Grain, inputs, hardware and household goods move through it in bulk, and a fair number of shops here sell on to traders as well as to walk-in customers. Add the ordinary town trade of a chartered city, and a Nakuru counter often runs wholesale and retail at once. This guide walks how that mixed trade actually runs, points to which of the five Omnix products fits, and is honest about what works on the device and what waits for a connection.',
    contextIntro:
      'Nakuru is an established city and the headquarters of Nakuru County, and it has long acted as a trading centre for a productive farming region in the Rift Valley.',
    contextPoints: [
      'Nakuru is an established city and the headquarters of Nakuru County in the Rift Valley.',
      'It sits in the Rift Valley, ringed by farms, so grain, farm inputs and produce move through town in volume.',
      'A good share of trade here is wholesale or semi-wholesale, with shops supplying smaller traders in the surrounding centres.',
      'Alongside that, the chartered city carries ordinary urban retail, hospitality and services, so formats mix within a few blocks.',
    ],
    operatingIntro:
      'Trade here often runs in two directions at once: selling single items to a walk-in and cases or sacks to a trader who is reselling. Software has to price both and keep stock honest across the two.',
    operatingPatterns: [
      'Bulk and single-unit sales from the same shelf, so pricing bends with quantity.',
      'Selling on to smaller traders, sometimes on account, alongside cash-and-carry walk-ins.',
      'Deliveries in from producers and distributors landing in large lots, then broken down for resale.',
      'Seasonal swings tied to harvest and planting, when farm-linked demand rises and falls.',
    ],
    productIntro:
      'All five products run in the town; which one fits depends on whether you mostly distribute, mostly retail, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Nakuru chemist supplying nearby clinics as well as walk-in patients can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Nakuru wholesaler or general shop can price the same item by the piece and by the case, sell to traders on account and to walk-ins for cash, and watch stock draw down across both.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Nakuru restaurant, bar or lodge serving travellers passing through can hold tables open, fire orders to the kitchen, cost plates against stock and split a bill for a group.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Nakuru hardware or agrovet counter can quote a farmer or contractor, convert the quote to an invoice, sell on account with statements and issue a delivery note as inputs or materials leave for a farm or site.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Nakuru salon or barbershop serving a steady town clientele can book by staff, pull up a returning client\u2019s history at the chair, deduct back-bar stock as products are used and settle commission at checkout.',
      },
    ],
    boundaryIntro:
      'A trading counter that also supplies other shops cannot stop when the line drops. Sort the local job from the connected job before you commit to anything.',
    local: [
      'Ringing up a sale, by the piece or the case, and taking cash or M-Pesa.',
      'Selling on account to a trader and updating their statement.',
      'Receiving a bulk delivery against a goods received note and breaking it down.',
      'Reading stock, receivables and the day\u2019s takings.',
    ],
    connected: [
      'Sending an M-Pesa STK push to the customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, retried when the connection returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into the region, not only to us, before you commit your stock and your debtors to it.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down?',
      'Can it price the same item by the piece and by the case, and sell on account with statements?',
      'Does receiving a bulk delivery update stock, with batch and expiry where the goods need it?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Nakuru is an established city in the Rift Valley of Kenya.',
        note: 'City of Nakuru official site (www.city.nakuru.go.ke). For a buyer this marks Nakuru as an established urban market, not a small town, so mixed wholesale and retail trade is the norm to plan for.',
      },
      {
        claim: 'Nakuru is the headquarters of Nakuru County in the Rift Valley, a productive agricultural region.',
        note: 'Kenya administrative geography and Kenya National Bureau of Statistics county records (knbs.or.ke). Its farm-linked, distribution-heavy trade is why bulk pricing, goods-received handling and selling on account matter here more than for a purely retail counter.',
      },
    ],
  },
  // Kisumu (Task 20). Lakeside western-region trade; wholesale and retail
  //    together; fast-moving lake produce.
  {
    slug: 'kisumu',
    city: 'Kisumu',
    county: 'Kisumu',
    region: 'Nyanza (Lake region)',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Kisumu buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Kisumu and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Kisumu shops and traders \u00b7 Omnix',
    metaDescription:
      'How a Kisumu business chooses Omnix by Lake Victoria: the way lakeside and western-region trade runs, which of the five products fits, what keeps working offline, and the one-time licence.',
    keywords: [
      'POS system Kisumu',
      'business software Kisumu',
      'wholesale POS Kisumu',
      'lakeside shop software Kisumu',
      'M-Pesa POS Kisumu',
      'offline POS Kisumu',
    ],
    ogTitle: 'Choosing Omnix in Kisumu',
    ogDescription:
      'A buying guide for Kisumu owners by the lake, honest about western-region trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Kisumu',
    title: 'Choosing software by the lake',
    titleAccent: 'in Kisumu.',
    intro:
      'Kisumu trades with its back to the water and its face to a wide western hinterland. Fish come off Lake Victoria, produce comes down from the surrounding counties, and a good deal of what sells here moves on again to smaller towns further out. A counter in Kisumu often serves a walk-in household and a reseller on the same morning. This guide walks how lakeside and regional trade actually runs, points to which of the five Omnix products fits your line, and stays clear about what works on the computer in front of you and what waits for a connection.',
    contextIntro:
      'Kisumu is the headquarters of Kisumu County and a city on the shores of Lake Victoria, long a meeting point for trade across the wider western region.',
    contextPoints: [
      'Kisumu sits on Lake Victoria, so fish, fresh produce and lake-linked goods move through the town in volume.',
      'The town has long acted as a commercial centre for the western counties, so some shops here supply traders from further afield as well as walk-in customers.',
      'Cash and M-Pesa lead most counters, and many buyers settle across more than one method on a single purchase.',
      'Trade tied to the lake and to the surrounding farms rises and falls with the season, so stock planning has to bend with it.',
    ],
    operatingIntro:
      'Trade here often runs in two directions at once, selling single items to a household and larger lots to a reseller taking goods out to a smaller town, so software has to price both and keep stock honest across them.',
    operatingPatterns: [
      'Selling by the piece to walk-ins and by the lot to resellers from the surrounding area.',
      'Fish and fresh produce that move fast, so some lines need tight stock watch rather than long shelf life.',
      'Cash and M-Pesa on most counters, with account sales common where a shop supplies regular traders.',
      'Deliveries arriving from farms and distributors in bulk, then broken down for resale over the following days.',
    ],
    productIntro:
      'All five products run in the town; which one fits turns on whether you mostly wholesale, mostly retail, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Kisumu chemist serving a busy town counter and nearby clinics can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Kisumu general shop or wholesaler can price the same item by the piece and by the sack, sell to resellers on account and to households for cash, and watch stock draw down across both.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Kisumu restaurant, bar or lakeside eatery can hold tables open, fire orders to the kitchen, cost a plate against its ingredients and split a bill for a group before reading the day back at close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Kisumu hardware or agrovet counter can quote a builder or a farmer, turn that quote into an invoice without retyping, sell on account with monthly statements and print a delivery note as goods leave for a site or a shamba.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Kisumu salon or barbershop can book by staff across the week, pull up a returning client\u2019s history at the chair, deduct back-bar stock as products are used and settle commission at checkout.',
      },
    ],
    boundaryIntro:
      'Power and the line can both dip here, so the question that matters is what still works when the connection drops. Sort the local job from the connected job before you commit.',
    local: [
      'Ringing up a sale, by the piece or the lot, and taking cash or M-Pesa.',
      'Selling on account to a reseller and updating their statement.',
      'Receiving a bulk delivery against a goods received note and breaking it down.',
      'Reading stock, receivables and the day\u2019s takings at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a customer\u2019s phone at the till.',
      'Filing each sale to KRA eTIMS, with queued invoices retried when the line returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into the lake region, not only to us, before you commit your stock and your debtors to it.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down, which by the lake can happen in a storm?',
      'Can it watch fast-moving perishable lines like fish and fresh produce as closely as slow shelf stock?',
      'Can it price by the piece and by the lot, and carry account sales to resellers with statements?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Kisumu is the headquarters of Kisumu County and a city on the shores of Lake Victoria.',
        note: 'County Government of Kisumu official site (kisumu.go.ke). For an owner this marks Kisumu as a lakeside regional trade centre, so receiving in bulk and watching fast-moving produce matter more than in a quiet town.',
      },
      {
        claim: 'Kisumu lies in the lake region of western Kenya and functions as a commercial centre for the surrounding counties.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for mixed wholesale and retail trade with a wide western hinterland, not a single-counter shop.',
      },
    ],
  },
  // Eldoret (Task 20). North Rift grain-belt service and distribution
  //    corridor; seasonal, farm-linked, account-heavy trade.
  {
    slug: 'eldoret',
    city: 'Eldoret',
    county: 'Uasin Gishu',
    region: 'Rift Valley',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Eldoret buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Uasin Gishu and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Eldoret shops and distributors \u00b7 Omnix',
    metaDescription:
      'How an Eldoret business chooses Omnix in the North Rift: the way grain-belt and distribution trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Eldoret',
      'business software Eldoret',
      'distributor software Eldoret',
      'agrovet POS Eldoret',
      'M-Pesa POS Eldoret',
      'offline POS Eldoret',
    ],
    ogTitle: 'Choosing Omnix in Eldoret',
    ogDescription:
      'A buying guide for Eldoret owners in the North Rift, honest about grain-belt and distribution trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Eldoret',
    title: 'Choosing software for the grain belt',
    titleAccent: 'in Eldoret.',
    intro:
      'Eldoret grew up on grain. The highlands around it grow maize, wheat and dairy at scale, and the town works as the place where that produce is traded, stored and turned into the inputs for the next season. It also feeds goods out along the highway toward western Kenya and the border. A counter in Eldoret often sits somewhere on that supply chain rather than at the end of it. This guide walks how grain-belt and distribution trade actually run, points to which of the five Omnix products fits your line, and is honest about what works on the device and what needs a connection.',
    contextIntro:
      'Eldoret is the headquarters of Uasin Gishu County and was granted city status; it sits on the highland farming belt of the North Rift.',
    contextPoints: [
      'Eldoret sits amid the North Rift highlands, a grain and dairy area, so farm produce and farm inputs move through town in volume.',
      'It works as a distribution and service centre for a wide farming hinterland, so some shops here supply smaller centres as well as walk-in customers.',
      'The town lies on the highway corridor running toward western Kenya and the Uganda border, so goods pass through as well as land.',
      'Cash and M-Pesa lead the counter, with account sales common where a business supplies farms or resellers.',
    ],
    operatingIntro:
      'A season sets the rhythm here. Demand for inputs climbs at planting, produce and cash land at harvest, and a business that supplies farmers has to price and stock for both peaks.',
    operatingPatterns: [
      'Seasonal swings around planting and harvest, when farm-linked demand rises and falls sharply.',
      'Bulk sales to farms and smaller traders alongside single-unit sales to walk-ins.',
      'Inputs and produce landing in large lots, then held and drawn down over weeks.',
      'Account customers who buy through a season and settle later, so statements matter.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on whether you supply the farms, retail, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'An Eldoret chemist serving a town counter and a farming catchment can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'An Eldoret supermarket or general shop can receive a bulk delivery against a goods received note, price it, and let stock draw down at the counter as it sells through the following weeks.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'An Eldoret hotel, restaurant or bar serving travellers on the highway can hold tables and room tabs open, fire orders to the kitchen, cost plates against stock and split a group\u2019s bill.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'An Eldoret hardware or agrovet counter can quote a farmer or contractor, convert the quote to an invoice, sell inputs on account with statements through the season, and issue a delivery note as goods leave for a farm or site.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'An Eldoret salon or barbershop can book by staff across the week, keep a returning client\u2019s history at the chair, deduct back-bar stock as it is used and work out commission at checkout.',
      },
    ],
    boundaryIntro:
      'A business that supplies farms and other shops cannot down tools when the line drops. Keep the local job apart from the connected job before you commit.',
    local: [
      'Ringing up a sale, by the unit or the lot, and taking cash or M-Pesa.',
      'Selling inputs on account through a season and updating the statement.',
      'Receiving a bulk delivery against a goods received note and breaking it down.',
      'Reading stock, receivables and the day\u2019s takings at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a farmer or customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, held and retried when the line returns.',
    ],
    evaluationIntro:
      'Put these to any vendor selling into the North Rift, not only to us, before you commit your stock and your debtors.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down?',
      'Can it carry account customers through a season and produce a clear statement when they settle?',
      'Does receiving a bulk delivery update stock, with batch and expiry where inputs need it?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Eldoret is the headquarters of Uasin Gishu County and was granted city status.',
        note: 'County Government of Uasin Gishu official site (uasingishu.go.ke). For an owner this marks Eldoret as a North Rift service and distribution centre, so selling on account and receiving in bulk matter here.',
      },
      {
        claim: 'Eldoret sits on the highland farming belt of the North Rift, an area of grain and dairy production.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for seasonal, farm-linked trade rather than steady year-round demand.',
      },
    ],
  },
  // Thika (Task 20). Industrial / manufacturing town; business-to-business
  //    distribution and account trade near the metro.
  {
    slug: 'thika',
    city: 'Thika',
    county: 'Kiambu',
    region: 'Central',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Thika buyer content authored and checked against locationGateIssues(); local claims cite Kiambu County Government (Thika Municipality) and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Thika shops and distributors \u00b7 Omnix',
    metaDescription:
      'How a Thika business chooses Omnix in an industrial town: the way manufacturing-linked and distribution trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Thika',
      'business software Thika',
      'wholesale POS Thika',
      'distributor software Thika',
      'M-Pesa POS Thika',
      'offline POS Thika',
    ],
    ogTitle: 'Choosing Omnix in Thika',
    ogDescription:
      'A buying guide for Thika owners in an industrial town, honest about manufacturing-linked and distribution trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Thika',
    title: 'Choosing software for a factory town',
    titleAccent: 'in Thika.',
    intro:
      'Thika makes things. Factories and processing plants have clustered here for decades, and a lot of the town\u2019s trade runs off that: distributors moving factory output, hardware and industrial supplies feeding the plants, and shops serving the people who keep them running. Sitting on the A2 a short way from Nairobi, Thika also stocks up from the city and sells on to towns further north. This guide walks how manufacturing-linked and distribution trade actually run, points to which of the five Omnix products fits, and is straight about what works on the device and what needs a connection.',
    contextIntro:
      'Thika is a principal town of Kiambu County and an established industrial hub on the A2 road, near where the Thika and Chania rivers meet.',
    contextPoints: [
      'Thika has a long industrial base, so manufacturing, processing and the trade around them shape the town.',
      'It sits on the A2 road a short way from Nairobi, so goods flow in from the city and out to towns further north.',
      'Some businesses here distribute factory output or industrial supplies rather than selling only to walk-ins.',
      'Cash and M-Pesa lead the counter, with account sales common between businesses that trade with each other.',
    ],
    operatingIntro:
      'Business-to-business trade carries real weight here, so pricing by quantity, selling on account and moving stock in bulk matter as much as the ordinary walk-in sale.',
    operatingPatterns: [
      'Distributing in bulk to other businesses alongside single-unit sales to walk-ins.',
      'Account sales between businesses, settled later, so statements and credit terms matter.',
      'Stock arriving in large lots from plants or from the city, then broken down for resale.',
      'Steady weekday trade tied to the working rhythm of nearby industry.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on whether you distribute to other businesses, retail, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Thika chemist serving a town counter and a working population can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Thika general shop, supermarket or distributor can price the same item by the piece and by the case, sell to businesses on account and to walk-ins for cash, and watch stock draw down across both.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Thika restaurant, bar or lodge can hold tables open, fire orders to the kitchen, cost plates against stock and split a bill for a group, then read the day back at close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Thika hardware or industrial-supplies counter can quote a contractor or a plant, turn the quote into an invoice, sell on account with statements and issue a delivery note as material leaves for a site or a factory.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Thika salon or barbershop can book by staff across the week, keep a returning client\u2019s history at the chair, deduct back-bar stock as products are used and settle commission at checkout.',
      },
    ],
    boundaryIntro:
      'A distributor that supplies other businesses cannot stop when the line drops. Separate the local job from the connected job before you commit.',
    local: [
      'Ringing up a sale, by the piece or the case, and taking cash or M-Pesa.',
      'Selling on account to a business and updating its statement.',
      'Receiving a bulk delivery against a goods received note and breaking it down for resale.',
      'Reading stock, receivables and the day\u2019s takings at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a buyer\u2019s phone at checkout.',
      'Reporting each sale to KRA eTIMS, with queued invoices retried when the connection returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into an industrial town, not only to us, before you commit your stock and your debtors.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down?',
      'Can it price by the piece and by the case, and carry business accounts with clear statements and credit terms?',
      'Does receiving a bulk delivery update stock and cost, with batch tracking where goods need it?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Thika is a principal town of Kiambu County and an established industrial hub on the A2 road.',
        note: 'Kiambu County Government, Thika Municipality (kiambu.go.ke). For an owner this marks Thika as a manufacturing and distribution town, so business-to-business trade and account sales matter here.',
      },
      {
        claim: 'Thika sits in Kiambu County in the Central region, a short way from Nairobi.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for distribution and bulk trade alongside ordinary retail.',
      },
    ],
  },
  // Machakos (Task 20). County-service town in the Lower Eastern drylands;
  //    steady salaried and commuter custom near the metro.
  {
    slug: 'machakos',
    city: 'Machakos',
    county: 'Machakos',
    region: 'Lower Eastern',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Machakos buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Machakos and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Machakos shops \u00b7 Omnix',
    metaDescription:
      'How a Machakos business chooses Omnix in a county town: the way service-town and dryland trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Machakos',
      'business software Machakos',
      'shop software Machakos',
      'county town POS Machakos',
      'M-Pesa POS Machakos',
      'offline POS Machakos',
    ],
    ogTitle: 'Choosing Omnix in Machakos',
    ogDescription:
      'A buying guide for Machakos owners in a county town, honest about service-town and dryland trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Machakos',
    title: 'Choosing software for a county town',
    titleAccent: 'in Machakos.',
    intro:
      'Machakos wears two hats. It is a county headquarters, so a good share of its trade turns on county government, its staff and the people who come into town for a service. And it sits in dryland country a short drive from Nairobi, close enough that some residents commute and some trade follows the corridor. A counter in Machakos serves that steady town custom day to day rather than a harvest rush. This guide walks how a service town in dry country actually trades, points to which of the five Omnix products fits, and is honest about what works on the device and what needs a connection.',
    contextIntro:
      'Machakos is the headquarters of Machakos County in the Lower Eastern region, a mostly dryland county where rainfall can be uneven from season to season.',
    contextPoints: [
      'As a county headquarters, much of Machakos trade turns on county government, its staff and people coming into town for a service.',
      'The county is largely dryland, so farm output and the trade tied to it swing with the rain more than in a wetter highland town.',
      'Machakos sits a short drive from Nairobi, so some residents commute and some trade follows the corridor between the two.',
      'Cash and M-Pesa lead the counter, with card more common among salaried town customers.',
    ],
    operatingIntro:
      'Trade here leans on a steady town population rather than sharp harvest peaks, so day-to-day speed at the counter and clean records for salaried and account customers carry weight.',
    operatingPatterns: [
      'Steady weekday custom from town residents, county staff and visitors in for a service.',
      'Sales that lean on cash and M-Pesa, with card among salaried customers.',
      'Farm-linked stock that rises and falls with an uneven rainfall pattern.',
      'Some account customers, such as institutions or regular buyers, who settle later.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on the trade you are in, not the part of town you trade from.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Machakos chemist serving a town counter and county health traffic can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Machakos general shop or supermarket gets barcode selling, held sales for busy spells and stock that drops as it sells, quick enough for a steady town counter through the day.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Machakos hotel, restaurant or bar serving town custom and visitors can hold tables and room tabs open, fire orders to the kitchen, cost plates against stock and split a group\u2019s bill.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Machakos hardware counter can quote a builder or an institution, turn the quote into an invoice, sell on account with monthly statements and print a delivery note as material leaves for a site.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Machakos salon or barbershop serving a regular town clientele can book by staff, pull up a returning client\u2019s history at the chair, deduct back-bar stock as products are used and settle commission at checkout.',
      },
    ],
    boundaryIntro:
      'Dryland power supply and the line can both waver, so the question that matters is what still works when the connection drops. Keep the local job apart from the connected job before you commit.',
    local: [
      'Ringing up a sale and taking cash, M-Pesa or card at the counter.',
      'Printing and reprinting receipts for town and account customers.',
      'Recording stock movement as items sell, on each device.',
      'Reading the day\u2019s takings and cash position at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a salaried or walk-in customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, with invoices queued and retried when the line returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into a county town, not only to us, before money changes hands.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down?',
      'Does it handle several tender types, including card for salaried customers, on one sale?',
      'Can it carry account customers, such as institutions, with a clear statement?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Machakos is the headquarters of Machakos County and the principal town of the county.',
        note: 'County Government of Machakos official site (machakos.go.ke). For an owner this marks Machakos as a county service town, so steady salaried and account custom matters more than harvest peaks.',
      },
      {
        claim: 'Machakos County lies in the Lower Eastern region, a mostly dryland county.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for farm trade that swings with uneven rainfall rather than a reliable season.',
      },
    ],
  },
  // Meru (Task 20). Mount Kenya highland farming (coffee, tea, dairy, miraa)
  //    and regional commerce for Upper Eastern.
  {
    slug: 'meru',
    city: 'Meru',
    county: 'Meru',
    region: 'Upper Eastern (Mount Kenya)',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Meru buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Meru and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Meru shops and traders \u00b7 Omnix',
    metaDescription:
      'How a Meru business chooses Omnix in hill country: the way highland-farming and regional trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Meru',
      'business software Meru',
      'agrovet POS Meru',
      'wholesale POS Meru',
      'M-Pesa POS Meru',
      'offline POS Meru',
    ],
    ogTitle: 'Choosing Omnix in Meru',
    ogDescription:
      'A buying guide for Meru owners in hill country, honest about highland-farming and regional trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Meru',
    title: 'Choosing software for hill-country trade',
    titleAccent: 'in Meru.',
    intro:
      'Farming drives Meru. The slopes of Mount Kenya give it coffee, tea, dairy, potatoes and the miraa trade, and the town is where much of that produce is bought, sold and turned into the inputs for the next crop. Meru also serves as a commercial centre for the wider Upper Eastern region, so shops here trade with a farming hinterland as much as with walk-in custom. This guide walks how highland farming and regional trade actually run, points to which of the five Omnix products fits, and is honest about what works on the device and what needs a connection.',
    contextIntro:
      'Meru is the headquarters of Meru County, on the north-eastern slopes of Mount Kenya, a heavily farmed county known for coffee, tea, dairy and the miraa trade.',
    contextPoints: [
      'Meru sits on the slopes of Mount Kenya, so highland crops, dairy and miraa move through the town and shape its trade.',
      'The town works as a commercial centre for the wider Upper Eastern region, so some shops supply a farming hinterland as well as walk-in customers.',
      'Crops and inputs move in bulk with the crop calendar, so stock and pricing bend with the season.',
      'Cash and M-Pesa lead the counter, with account sales common where a business supplies farms or resellers.',
    ],
    operatingIntro:
      'The crop calendar sets the pace here. Input demand climbs before planting, produce and cash flow follow the harvest, and a business tied to farming has to price and stock for both.',
    operatingPatterns: [
      'Seasonal peaks around planting and harvest across several crops with different calendars.',
      'Bulk sales to farms and resellers alongside single-unit sales to walk-ins.',
      'Perishable and fast-turning produce lines that need tighter stock watch than shelf goods.',
      'Account customers who buy through a season and settle later, so statements matter.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on whether you supply farms, retail, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Meru chemist serving a town counter and a rural catchment can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Meru general shop or wholesaler can price the same item by the piece and by the sack, sell to resellers on account and to households for cash, and watch stock draw down across both.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Meru hotel, restaurant or bar can hold tables and room tabs open, fire orders to the kitchen, cost plates against stock and split a group\u2019s bill, then read the day back at close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Meru hardware or agrovet counter can quote a farmer or a builder, turn the quote into an invoice, sell inputs on account with statements through the season, and issue a delivery note as goods leave for a shamba or a site.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Meru salon or barbershop can book by staff across the week, keep a returning client\u2019s history at the chair, deduct back-bar stock as it is used and work out commission at checkout.',
      },
    ],
    boundaryIntro:
      'Hill-country power and the line can both drop, so the question that matters is what still works when the connection goes. Sort the local job from the connected job before you commit.',
    local: [
      'Ringing up a sale, by the piece or the sack, and taking cash or M-Pesa.',
      'Carrying a farm or reseller account and updating the statement.',
      'Receiving produce or inputs in bulk against a goods received note.',
      'Reading stock, receivables and the day\u2019s takings at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a farmer or walk-in customer\u2019s phone.',
      'Filing each sale to KRA eTIMS, held and retried when the connection returns.',
    ],
    evaluationIntro:
      'Put these to any vendor selling into hill country, not only to us, before you commit your stock and your debtors.',
    evaluationPoints: [
      'Does it keep selling and printing when hill-country power or the line drops?',
      'Can it watch perishable produce lines as closely as slow-moving shelf stock?',
      'Can it carry account customers through a season and produce a clear statement when they settle?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Meru is the headquarters of Meru County, on the north-eastern slopes of Mount Kenya.',
        note: 'County Government of Meru official site (meru.go.ke). For an owner this marks Meru as a farming and regional-trade centre, so seasonal stock and account sales matter here.',
      },
      {
        claim: 'Meru County is a heavily farmed area producing coffee, tea, dairy and miraa, with wholesale and retail trade important to its economy.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for bulk, seasonal produce trade with a farming hinterland.',
      },
    ],
  },
  // Nyeri (Task 20). Central highland farming, established service town,
  //    and a hospitality route toward Mount Kenya / the Aberdares.
  {
    slug: 'nyeri',
    city: 'Nyeri',
    county: 'Nyeri',
    region: 'Central (Mount Kenya)',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Nyeri buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Nyeri and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Nyeri shops and hotels \u00b7 Omnix',
    metaDescription:
      'How a Nyeri business chooses Omnix in the central highlands: the way farming, service-town and hospitality trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Nyeri',
      'business software Nyeri',
      'hotel POS Nyeri',
      'restaurant POS Nyeri',
      'M-Pesa POS Nyeri',
      'offline POS Nyeri',
    ],
    ogTitle: 'Choosing Omnix in Nyeri',
    ogDescription:
      'A buying guide for Nyeri owners in the central highlands, honest about farming, service and hospitality trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Nyeri',
    title: 'Choosing software in the highlands',
    titleAccent: 'in Nyeri.',
    intro:
      'Nyeri holds three kinds of trade at once. The highlands around it grow coffee, tea and dairy, so farming feeds the town. It is a long-standing administrative and service town, so county and national departments, schools and the traffic they bring keep counters busy. And it sits on the route toward the Aberdares and Mount Kenya, so some businesses in Nyeri serve visitors as well as locals. This guide walks how a central-highlands town of farms, services and hospitality actually trades, points to which of the five Omnix products fits, and is honest about what works on the device and what needs a connection.',
    contextIntro:
      'Nyeri is the headquarters of Nyeri County in the central highlands around Mount Kenya, and it was the administrative centre of the former Central region.',
    contextPoints: [
      'Nyeri sits in the central highlands, so coffee, tea and dairy farming shape the trade around the town.',
      'It has long been an administrative and service centre, so salaried staff, students and visitors in for services keep counters busy.',
      'The town lies on the route toward the Aberdares and Mount Kenya, so some businesses serve tourists alongside local custom.',
      'Cash and M-Pesa lead the counter, with card more common in hotels and among salaried customers.',
    ],
    operatingIntro:
      'Three rhythms overlap here: a farming calendar, steady salaried town custom, and visitor trade that rises with the travel season. Software has to cope with all three rather than one.',
    operatingPatterns: [
      'Steady weekday custom from salaried residents and students alongside farm-linked trade.',
      'Hospitality that fills with the travel season, so hotels and restaurants plan stock and staff around it.',
      'Cash and M-Pesa on most counters, with card common in hotels and among salaried buyers.',
      'Some account customers, from institutions to regular buyers, who settle later.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on whether you farm-trade, retail, serve guests, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Nyeri chemist serving a town counter and a highland catchment can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Nyeri general shop or supermarket gets barcode selling, held sales for busy spells and stock that drops as it sells, quick enough for a steady highland-town counter.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Nyeri hotel, lodge or restaurant on the Mount Kenya route can hold room tabs and tables open, fire orders to the kitchen, cost a plate against its ingredients and split a group\u2019s bill, then read the season back at close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Nyeri hardware counter can quote a builder or a farmer, turn the quote into an invoice, sell on account with monthly statements and print a delivery note as material leaves for a site or a farm.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Nyeri salon or spa can book by staff across the week, keep a returning client\u2019s history at the chair, draw down packages and back-bar stock, and work out commission at checkout.',
      },
    ],
    boundaryIntro:
      'Highland power and the line can both drop, so the question that matters is what still works when the connection goes. Keep the local job apart from the connected job before you commit.',
    local: [
      'Ringing up a sale and taking cash, M-Pesa or card at the counter.',
      'Opening tables and room tabs, and sending orders to the kitchen.',
      'Recording stock movement as items sell, on each device.',
      'Reading the day\u2019s takings, stock and cash position at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a guest\u2019s or customer\u2019s phone.',
      'Submitting each sale to KRA eTIMS, with queued invoices retried when the line returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into a highland service town, not only to us, before money changes hands.',
    evaluationPoints: [
      'Does it keep selling and serving when highland power or the line drops?',
      'For a hotel or restaurant, can it hold tables and room tabs and split a bill on the same check?',
      'Does it handle several tender types, including card, on one sale?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Nyeri is the headquarters of Nyeri County in the central highlands and was the administrative centre of the former Central region.',
        note: 'County Government of Nyeri official site (nyeri.go.ke). For an owner this marks Nyeri as a service and administrative town, so steady salaried custom matters alongside farm and visitor trade.',
      },
      {
        claim: 'Nyeri County lies in the highlands around Mount Kenya, an area of coffee, tea and dairy farming and a route toward the Aberdares.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for farming, salaried and seasonal visitor trade together.',
      },
    ],
  },
  // Kisii (Task 20). Densely settled Gusii highlands; smallholder farming
  //    feeding a busy market town of many small transactions.
  {
    slug: 'kisii',
    city: 'Kisii',
    county: 'Kisii',
    region: 'Nyanza (Gusii highlands)',
    status: 'published',
    audit: {
      approvedBy: 'Kiro editorial review (Task 20)',
      approvedAt: '2026-07-21',
      reviewNotes:
        'Task 20: Kisii buyer content authored and checked against locationGateIssues(); local claims cite the County Government of Kisii and KNBS. Transparent process label, not a named human approver, kept out of the rendered page.',
    },
    updated: '2026-07-21',
    metaTitle: 'Business software and POS for Kisii shops and traders \u00b7 Omnix',
    metaDescription:
      'How a Kisii business chooses Omnix in the Gusii highlands: the way dense smallholder-farming and market-town trade runs, which of the five products fits, what holds up offline, and the one-time licence.',
    keywords: [
      'POS system Kisii',
      'business software Kisii',
      'shop software Kisii',
      'market town POS Kisii',
      'M-Pesa POS Kisii',
      'offline POS Kisii',
    ],
    ogTitle: 'Choosing Omnix in Kisii',
    ogDescription:
      'A buying guide for Kisii owners in the Gusii highlands, honest about smallholder-farming and market-town trade, the offline boundary and the one-time price.',
    kicker: 'City guide \u00b7 Kisii',
    title: 'Choosing software for a market town',
    titleAccent: 'in Kisii.',
    intro:
      'Kisii sits in a crowded, green highland where farms are small and close together. Bananas, tea, coffee and the soapstone trade come off the surrounding land, and the town works as the market that gathers, sells and supplies a densely settled countryside. Trade here tends to run in high volumes of smaller transactions rather than a few big ones. This guide walks how a busy market town in the Gusii highlands actually trades, points to which of the five Omnix products fits, and is honest about what works on the device and what needs a connection.',
    contextIntro:
      'Kisii is the headquarters of Kisii County in the Gusii highlands of south-western Kenya, a densely settled farming area of small landholdings.',
    contextPoints: [
      'Kisii sits in a densely populated highland, so a lot of small farms feed a busy market town.',
      'Smallholder crops such as bananas, tea and coffee, plus the soapstone trade, move through the town in many small lots.',
      'The town works as a commercial centre for a wide rural area, so some shops supply smaller traders as well as walk-in customers.',
      'Cash and M-Pesa lead most counters, with many purchases small and frequent.',
    ],
    operatingIntro:
      'High volumes of small sales set the rhythm here. Speed at the counter, tight stock control on many low-value lines, and honest handling of frequent M-Pesa payments carry more weight than the occasional large ticket.',
    operatingPatterns: [
      'Many small, frequent transactions rather than a few large ones.',
      'A wide range of low-value lines that still need accurate stock counts.',
      'Cash and M-Pesa on most counters through a busy trading day.',
      'Some resale to smaller traders from the surrounding countryside, sometimes on account.',
    ],
    productIntro:
      'All five products run in the town; the fit depends on whether you retail at volume, supply other traders, or run a service counter.',
    products: [
      {
        id: 'pharmacy',
        ...LOCATION_PRODUCT_META.pharmacy,
        localWorkflow:
          'A Kisii chemist serving a steady stream of walk-in patients can keep dispensing, batch and expiry tracking and the controlled register on the device, while SHA checks, M-Pesa and eTIMS reach out only when the line is up.',
      },
      {
        id: 'retail',
        ...LOCATION_PRODUCT_META.retail,
        localWorkflow:
          'A Kisii general shop or mini-mart gets barcode selling, held sales for busy spells and stock that drops as it sells, quick enough for a counter handling many small purchases in a day.',
      },
      {
        id: 'hospitality',
        ...LOCATION_PRODUCT_META.hospitality,
        localWorkflow:
          'A Kisii restaurant, bar or eatery can hold tables open, fire orders to the kitchen, cost a plate against its ingredients and split a bill, then read the day back at close.',
      },
      {
        id: 'hardware',
        ...LOCATION_PRODUCT_META.hardware,
        localWorkflow:
          'A Kisii hardware or agrovet counter can quote a builder or a farmer, turn the quote into an invoice, sell on account with statements and issue a delivery note as goods leave for a site or a smallholding.',
      },
      {
        id: 'salon',
        ...LOCATION_PRODUCT_META.salon,
        localWorkflow:
          'A Kisii salon or barbershop can book by staff, pull up a returning client\u2019s history at the chair, deduct back-bar stock as products are used and settle commission at checkout.',
      },
    ],
    boundaryIntro:
      'A counter handling many small sales cannot pause every time the line drops, so the question that matters is what still works offline. Keep the local job apart from the connected job before you commit.',
    local: [
      'Ringing up many small sales quickly and taking cash or M-Pesa.',
      'Keeping accurate stock counts across a wide range of low-value lines.',
      'Printing and reprinting receipts at the counter.',
      'Reading the day\u2019s takings and cash position at close.',
    ],
    connected: [
      'Sending an M-Pesa STK push to a customer\u2019s phone during a busy spell.',
      'Submitting each sale to KRA eTIMS, with queued invoices retried when the line returns.',
    ],
    evaluationIntro:
      'Take these to any vendor selling into a busy market town, not only to us, before money changes hands.',
    evaluationPoints: [
      'Does it keep selling and printing when the internet or power is down through a busy trading day?',
      'Is it quick enough at the counter to handle many small sales without slowing the queue?',
      'Can it keep accurate stock counts across a wide range of low-value lines?',
      'Is the price a one-time licence or a running subscription, and what keeps working if you stop paying?',
    ],
    sources: [
      {
        claim: 'Kisii is the headquarters of Kisii County in the Gusii highlands of south-western Kenya.',
        note: 'County Government of Kisii official site (kisii.go.ke). For an owner this marks Kisii as a busy market town for a densely settled area, so counter speed and tight stock control matter here.',
      },
      {
        claim: 'Kisii County is a densely settled highland farming area of small landholdings.',
        note: 'Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census (knbs.or.ke). A buyer plans for high volumes of small transactions rather than a few large ones, so counter density matters.',
      },
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────────
 * Publication-quality gate.
 *
 * `locationGateIssues` returns a list of stable reason codes. An entry is
 * publishable only when the list is empty. The codes let tests assert exactly
 * why a given entry is rejected. Every check below maps to a doorway /
 * scaled-content / dishonest-claim risk called out in the brief.
 * ──────────────────────────────────────────────────────────────────────────*/

/** Free text scanned for banned language (proper-noun facts scanned separately). */
function scannableCorpus(loc: KenyaLocation): string {
  return [
    loc.metaTitle,
    loc.metaDescription,
    loc.ogTitle,
    loc.ogDescription,
    loc.kicker,
    loc.title,
    loc.titleAccent,
    loc.intro,
    loc.contextIntro,
    ...loc.contextPoints,
    loc.operatingIntro,
    ...loc.operatingPatterns,
    loc.productIntro,
    ...loc.products.map((p) => p.localWorkflow),
    loc.boundaryIntro,
    ...loc.local,
    ...loc.connected,
    loc.evaluationIntro,
    ...loc.evaluationPoints,
    ...loc.sources.flatMap((s) => [s.claim, s.note]),
    ...loc.keywords,
  ].join('\n')
}

/**
 * Banned-language patterns. Documented here so Task 19/20 authors know what the
 * gate refuses. Each maps to an issue code.
 */
const BANNED_PATTERNS: Array<{ code: string; re: RegExp }> = [
  // Placeholder / unfinished text.
  { code: 'placeholder', re: /\bTODO\b|\bTBD\b|\bFIXME\b|\bplaceholder\b|lorem ipsum|\bxxx+\b|coming soon|\[[^\]]*\]|\{\{[^}]*\}\}/i },
  // Unsupported superlatives / rankings.
  { code: 'superlative', re: /\bbest\b|#1\b|\bno\.?\s*1\b|\bnumber one\b|\bleading\b|\btop[- ]rated\b|world[- ]class|revolutionar|\bunmatched\b|\bunrivall?ed\b|\bmost popular\b|\bfastest\b|\bcheapest\b|\blargest\b|\bbiggest\b/i },
  // Competitor denigration.
  { code: 'superlative', re: /\b(better|worse|cheaper|faster|superior)\s+than\b|\bunlike (other|competing|the)\b/i },
  // Invented metrics / savings / adoption counts / ratings.
  { code: 'metric', re: /\d+\s*%|\bsave (up to )?(ksh|kes|\$|\d)/i },
  { code: 'metric', re: /\d[\d,]*\+?\s*(customers|businesses|shops|users|pharmacies|clients|installs|downloads|stores|outlets)\b/i },
  { code: 'metric', re: /\brated\s*\d|\bstar rating\b|\d(\.\d)?\s*\/\s*5\b/i },
  // Certifications / regulatory guarantees.
  { code: 'certification', re: /\bcertified\b|fully compliant|guarantee[sd]?\s+(compliance|success|results|uptime)|regulatory (approval|guarantee)|\baccredited\b/i },
  // Response-time / availability promises we do not make.
  { code: 'response-time', re: /\bwithin\s+\d+\s*(minutes?|hours?|days?)\b|\b24\/7\b|same[- ]day (support|response|setup|install)|\d+[- ]hour (response|support)|round[- ]the[- ]clock/i },
  // AI / Pro-tier / trial / ERP acquisition positioning.
  { code: 'ai-pro-trial', re: /\bAI\b|artificial intelligence|\bERP\b/ },
  { code: 'ai-pro-trial', re: /\btrial\b|free trial|start your trial|sign up free/i },
  { code: 'ai-pro-trial', re: /\bPro\b(?!duct|cess|cedure|vide|per|mpt|of|xim|gress|file|ven|spect)/ },
  { code: 'ai-pro-trial', re: /\bsign up\b|\bregister now\b|\bcreate an account\b/i },
  // Local presence / office / address / testimonial claims (none are verified).
  { code: 'local-presence', re: /\boffice\b|\bshowroom\b|\bour branch(es)?\b|\bour premises\b|\bbased in\b|\blocated (at|in)\b|\bvisit (us|our)\b|\bwalk into\b|\bcome to our\b|\bnear you\b|\bdrop by\b|\bour (shop|store|team|staff|reps?|agents?)\b|\bwe (have|run|operate) (a|an|our)\b/i },
  { code: 'local-presence', re: /\b\d{1,4}\s+[A-Za-z]+\s+(street|st|road|rd|avenue|ave|lane|highway|hwy)\b|\bP\.?\s?O\.?\s*Box\b/i },
  { code: 'local-presence', re: /\btestimonial|\btrusted by\b|\bour clients say\b|\bcustomers love\b|\breview[s]? from\b/i },
]

function countWord(text: string, word: string): number {
  if (!word.trim()) return 0
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  return (text.match(re) ?? []).length
}

function hasDuplicates(items: string[]): boolean {
  const norm = items.map((i) => i.trim().toLowerCase()).filter(Boolean)
  return new Set(norm).size !== norm.length
}

/**
 * Returns the list of gate failures for a single location. Empty === passes the
 * intrinsic gate. Registry-level uniqueness is checked separately (see
 * `locationUniquenessIssues`) so that a single doorway clone is caught too.
 */
export function locationGateIssues(loc: KenyaLocation): string[] {
  const issues: string[] = []

  // 1. Explicit publication status + approval (no publishing without a sign-off).
  if (loc.status !== 'published') issues.push('status')
  if (!loc.audit || !loc.audit.approvedBy?.trim() || !loc.audit.approvedAt?.trim()) {
    issues.push('approval')
  }

  // 2. Completeness (anti-thin-template).
  if (loc.city.trim().length < 2) issues.push('thin:city')
  if (loc.county.trim().length < 2) issues.push('thin:county')
  if (loc.region.trim().length < 2) issues.push('thin:region')
  if (loc.metaTitle.trim().length < 15) issues.push('thin:metaTitle')
  if (loc.metaDescription.trim().length < 60) issues.push('thin:metaDescription')
  if (loc.ogDescription.trim().length < 40) issues.push('thin:ogDescription')
  if (loc.title.trim().length < 4) issues.push('thin:title')
  if (loc.intro.trim().length < 120) issues.push('thin:intro')
  if (loc.contextIntro.trim().length < 20) issues.push('thin:contextIntro')
  if (loc.contextPoints.length < 3) issues.push('thin:contextPoints')
  if (loc.operatingIntro.trim().length < 20) issues.push('thin:operatingIntro')
  if (loc.operatingPatterns.length < 3) issues.push('thin:operatingPatterns')
  if (loc.boundaryIntro.trim().length < 20) issues.push('thin:boundaryIntro')
  if (loc.local.length < 3) issues.push('thin:local')
  if (loc.connected.length < 2) issues.push('thin:connected')
  if (loc.evaluationIntro.trim().length < 20) issues.push('thin:evaluationIntro')
  if (loc.evaluationPoints.length < 3) issues.push('thin:evaluationPoints')

  // 3. Five-product navigation with matching links + locally relevant copy.
  const ids = new Set(loc.products.map((p) => p.id))
  const missing = REQUIRED_PRODUCT_IDS.filter((id) => !ids.has(id))
  if (loc.products.length !== REQUIRED_PRODUCT_IDS.length || missing.length > 0) {
    issues.push('products')
  }
  for (const p of loc.products) {
    const meta = LOCATION_PRODUCT_META[p.id]
    if (!meta || p.path !== meta.path || p.demoProduct !== meta.demoProduct) issues.push('products')
    if (!p.path.startsWith('/')) issues.push('products')
    if (p.localWorkflow.trim().length < 60) issues.push('products')
  }

  // 4. Source / evidence notes for factual local claims.
  if (loc.sources.length < 1 || loc.sources.some((s) => !s.claim.trim() || !s.note.trim())) {
    issues.push('sources')
  }

  // 5. Duplicated blocks within the entry (templating tell).
  if (loc.intro.trim().length > 0 && loc.intro.trim() === loc.metaDescription.trim()) {
    issues.push('duplicate-block')
  }
  for (const list of [loc.contextPoints, loc.operatingPatterns, loc.local, loc.connected, loc.evaluationPoints]) {
    if (hasDuplicates(list)) {
      issues.push('duplicate-block')
      break
    }
  }
  if (hasDuplicates(loc.products.map((p) => p.localWorkflow))) issues.push('duplicate-block')

  // 6. Banned language: placeholders, superlatives, metrics, certifications,
  //    response times, AI/Pro/trial, local-presence/office/address/testimonials.
  const corpus = scannableCorpus(loc)
  for (const { code, re } of BANNED_PATTERNS) {
    if (re.test(corpus) && !issues.includes(code)) issues.push(code)
  }

  // 7. Keyword stuffing.
  const kw = loc.keywords.map((k) => k.trim().toLowerCase())
  if (loc.keywords.length > 8) issues.push('keyword-stuffing')
  else if (hasDuplicates(loc.keywords)) issues.push('keyword-stuffing')
  else if (loc.intro.trim().length > 0 && countWord(loc.intro, loc.city) > 4) issues.push('keyword-stuffing')
  else if (kw.length > 0 && new Set(kw).size !== kw.length) issues.push('keyword-stuffing')

  // 8. City-name match (catches copy-paste of the wrong city).
  if (loc.title.trim().length > 0 || loc.metaTitle.trim().length > 0) {
    const ownIn = (t: string) => new RegExp(`\\b${loc.city}\\b`, 'i').test(t)
    const ownPresent = (ownIn(loc.title) || ownIn(loc.titleAccent)) && ownIn(loc.metaTitle) && ownIn(loc.intro)
    if (!ownPresent) issues.push('city-mismatch')

    const headline = [loc.title, loc.titleAccent, loc.metaTitle, loc.ogTitle, loc.kicker].join(' ')
    const foreign = PLANNED_CITIES.filter((c) => c.toLowerCase() !== loc.city.toLowerCase()).some(
      (c) => new RegExp(`\\b${c}\\b`, 'i').test(headline),
    )
    if (foreign && !issues.includes('city-mismatch')) issues.push('city-mismatch')
  }

  return issues
}

/** True only for a complete, approved, gate-passing entry. */
export function isPublishableLocation(loc: KenyaLocation): boolean {
  return locationGateIssues(loc).length === 0
}

/**
 * Registry-level uniqueness. Even a single materially-duplicate hub is a
 * doorway risk, so distinctness is enforced across the publishable set on
 * headline, metadata and body blocks.
 */
export function locationUniquenessIssues(locations: KenyaLocation[]): string[] {
  const issues: string[] = []
  const uniqueFields: Array<keyof KenyaLocation> = [
    'slug',
    'city',
    'title',
    'metaTitle',
    'metaDescription',
    'ogDescription',
    'intro',
  ]
  for (const field of uniqueFields) {
    const values = locations.map((l) => String(l[field]).trim().toLowerCase())
    if (new Set(values).size !== values.length) issues.push(`duplicate:${String(field)}`)
  }
  // Whole-block duplication across cities.
  const blocks = locations.map((l) =>
    [...l.contextPoints, ...l.operatingPatterns, ...l.evaluationPoints].join('~').trim().toLowerCase(),
  )
  if (new Set(blocks).size !== blocks.length) issues.push('duplicate:blocks')
  return issues
}

/**
 * The publishable, mutually-distinct set. Filters to gate-passing entries, then
 * drops any later entry that collides with an earlier one on a uniqueness key
 * (first occurrence wins) so a duplicate can never sneak into render/sitemap.
 */
export function publishedLocations(): KenyaLocation[] {
  const passing = KENYA_LOCATIONS.filter(isPublishableLocation)
  const seen = { slug: new Set<string>(), city: new Set<string>(), title: new Set<string>(), meta: new Set<string>(), intro: new Set<string>() }
  const out: KenyaLocation[] = []
  for (const loc of passing) {
    const slug = loc.slug.toLowerCase()
    const city = loc.city.trim().toLowerCase()
    const title = loc.title.trim().toLowerCase()
    const meta = loc.metaTitle.trim().toLowerCase()
    const intro = loc.intro.trim().toLowerCase()
    if (seen.slug.has(slug) || seen.city.has(city) || seen.title.has(title) || seen.meta.has(meta) || seen.intro.has(intro)) {
      continue
    }
    seen.slug.add(slug)
    seen.city.add(city)
    seen.title.add(title)
    seen.meta.add(meta)
    seen.intro.add(intro)
    out.push(loc)
  }
  return out
}

export function publishedLocationSlugs(): string[] {
  return publishedLocations().map((l) => l.slug)
}

export function locationBySlug(slug: string): KenyaLocation | null {
  return KENYA_LOCATIONS.find((l) => l.slug === slug) ?? null
}

/** True only for a slug that exists and passes the publication gate. */
export function publishedLocationBySlug(slug: string): KenyaLocation | null {
  const loc = locationBySlug(slug)
  return loc && isPublishableLocation(loc) && publishedLocationSlugs().includes(slug) ? loc : null
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-US')}`
}

/**
 * Pricing facts derived from the pricing config. Never restated by hand.
 * `oneTime` is the perpetual per-device starter licence; `maintenanceYearly`
 * is the optional compliance-update plan.
 */
export function locationPricingFacts(): { oneTime: string; maintenanceYearly: string } {
  return {
    oneTime: formatKes(pricing.starter.oneTimeFee.KES),
    maintenanceYearly: formatKes(pricing.starter.maintenanceYearly.KES),
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * How entries are authored (the recipe every one of the ten followed)
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Add a fully-authored KenyaLocation literal to KENYA_LOCATIONS, keeping the
 *    verifiable slug/city/county/region.
 * 2. Fill EVERY buyer field with materially unique, city-specific copy:
 *    metaTitle/description, keywords (<= 8, no duplicates), ogTitle/description,
 *    kicker, title + titleAccent (must contain the city name), intro (>= 120,
 *    city named but not stuffed), contextIntro + >=3 contextPoints,
 *    operatingIntro + >=3 operatingPatterns, productIntro + all five products
 *    with a >=60-char city-local `localWorkflow`, boundaryIntro + >=3 local +
 *    >=2 connected, evaluationIntro + >=3 evaluationPoints, and >=1 source with
 *    a real evidence note (official host + publisher + buyer angle) per claim.
 * 3. Do NOT claim an office/branch/address/testimonial/customer count, any
 *    superlative/metric/certification/response-time, or AI/Pro/trial framing.
 *    The gate rejects all of these (see BANNED_PATTERNS).
 * 4. Set audit.approvedBy to a truthful, non-public process label (never a
 *    fabricated human), audit.approvedAt to the approval date, and status to
 *    'published'. Only then does the entry render, enter generateStaticParams,
 *    and appear in the sitemap.
 * 5. `publishedLocations()` must include the city and
 *    `locationUniquenessIssues(publishedLocations())` must stay empty.
 */

/**
 * National Kenyan buyer-guide registry. Task 17.
 *
 * These are high-intent, decision-stage guides for real buyer queries
 * (POS, inventory, pharmacy, restaurant, hardware, salon software). They are
 * evaluative content, not product-sales pages: each guide helps a Kenyan buyer
 * decide, states honest boundaries, and hands off to the matching product page
 * and a locale-aware demo.
 *
 * Publication is gated. `isPublishedGuide` enforces that only substantive,
 * materially distinct guides render and enter the sitemap. A thin or unfinished
 * entry (short lede, missing checklist, empty boundary) never ships. This is
 * the guard against doorway / scaled-content abuse. The registry can hold work
 * in progress without exposing it for indexing.
 *
 * Pricing facts are derived from `@/config/pricing` so the KES 30,000 perpetual
 * licence and optional KES 12,000/year compliance updates are never restated by
 * hand and cannot drift from the source of truth.
 */
import { pricing } from './pricing'

export type GuideProductId = 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'

export interface GuideWorkflowStep {
  /** Short stage marker, e.g. "Receive". */
  marker: string
  title: string
  body: string
}

export interface GuideProductHandoff {
  /** Display name, e.g. "Omnix Pharmacy". */
  label: string
  /** Product page path within the locale, e.g. "/pharmacy". */
  path: string
  /** Demo pre-selection passed as ?product= on the contact route. */
  demoProduct: GuideProductId
  /** How the matching Omnix product fits this buyer (>= 80 chars). */
  body: string
}

export interface BuyerGuide {
  slug: string
  /** Explicit opt-in. Only published + gate-passing guides render / index. */
  published: boolean
  /** Honest authored date used for Article JSON-LD. */
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
  lede: string

  // Who it is for / not for.
  audienceIntro: string
  forYou: string[]
  notForYou: string[]

  // Workflow checklist.
  workflowIntro: string
  workflow: GuideWorkflowStep[]

  // Local vs connected boundary.
  boundaryIntro: string
  local: string[]
  connected: string[]

  // Data migration.
  migrationIntro: string
  migrationQuestions: string[]

  // Evaluation questions for any vendor.
  evaluationIntro: string
  evaluationQuestions: string[]

  // Product handoff.
  productIntro: string
  product: GuideProductHandoff
}

export const BUYER_GUIDES: readonly BuyerGuide[] = [
  {
    slug: 'pos-system-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'How to choose a POS system in Kenya · Buyer guide · Omnix',
    metaDescription:
      'A practical guide to choosing a point-of-sale system for a Kenyan shop: the counter workflow, where M-Pesa and KRA eTIMS fit, what keeps working offline, migration questions and a perpetual licence.',
    keywords: [
      'POS system Kenya',
      'point of sale Kenya',
      'shop POS Kenya',
      'M-Pesa POS',
      'KRA eTIMS POS',
      'offline POS Kenya',
    ],
    ogTitle: 'Choosing a POS system in Kenya',
    ogDescription:
      'The counter workflow, the local-versus-connected line, migration questions and pricing, written for Kenyan shop owners.',
    kicker: 'Buyer guide · POS in Kenya',
    title: 'How to choose a POS system',
    titleAccent: 'in Kenya.',
    lede: 'A point-of-sale system decides how fast you serve a customer and how honest your day-end numbers are. This guide walks the counter a Kenyan shop actually runs, shows where M-Pesa and KRA eTIMS fit, and lists the questions worth asking before you pay for anything.',
    audienceIntro:
      'A general-purpose till suits some counters and frustrates others. Read both lists before you shortlist.',
    forYou: [
      'You run a shop, mini-mart or counter where staff ring up sales all day and need speed over configuration.',
      'You want cash, M-Pesa and card recorded against the same sale instead of three separate notebooks.',
      'Your internet drops and you still need to keep selling and printing receipts.',
      'You want stock to move as you sell, not only after a Saturday count.',
    ],
    notForYou: [
      'You issue a handful of invoices a month. A simple invoicing tool may be enough.',
      'You need a specialised trade flow such as pharmacy dispensing or restaurant kitchen tickets. Start with that trade guide instead.',
      'You expect the till to run entirely in a phone browser with no install. Omnix is a Windows desktop product.',
    ],
    workflowIntro:
      'A POS is more than a screen that adds up prices. Walk the day and check the software carries each step without a side spreadsheet.',
    workflow: [
      { marker: 'Open', title: 'Start the shift', body: 'Set the opening float, sign in the cashier and confirm the till is ready before the first customer.' },
      { marker: 'Sell', title: 'Ring up quickly', body: 'Search or scan an item, adjust the quantity, apply a price or discount and take the payment the customer offers.' },
      { marker: 'Pay', title: 'Record how they paid', body: 'Cash, M-Pesa and card all land on the same sale, so the total reconciles at close rather than in your head.' },
      { marker: 'Stock', title: 'Move inventory as you sell', body: 'Each sale reduces the item count, so the shelf figure stays close to reality between counts.' },
      { marker: 'Close', title: 'Read the day back', body: 'See sales, payments by method and cash variance from the transactions already recorded.' },
    ],
    boundaryIntro:
      'The honest question with any Kenyan POS is what happens when the line drops. Keep the local job and the connected job separate before you decide.',
    local: [
      'Ringing up a sale and choosing the payment method.',
      'Printing and reprinting a receipt.',
      'Recording stock movement as items sell.',
      "Reading the day's sales and cash position.",
    ],
    connected: [
      "Sending an M-Pesa STK push to the customer's phone.",
      'Submitting a sale to KRA eTIMS, with queued invoices retried when the connection returns.',
    ],
    migrationIntro:
      'Moving from a notebook, a spreadsheet or another till is real work. Ask these before you set a switch date.',
    migrationQuestions: [
      'Which products, prices and opening stock counts must be ready on the first trading day?',
      'Can your current system export its data, and in what format?',
      'Who in the business will confirm that stock values and balances came across correctly?',
      'What stays in the old records as history instead of being keyed in again?',
    ],
    evaluationIntro:
      'Take these to any vendor, not only to us. The answers separate a till that fits Kenya from one adapted from elsewhere.',
    evaluationQuestions: [
      'Does it keep selling and printing when the internet is down?',
      'Does it use my own Safaricom M-Pesa account, and who pays the transaction fee?',
      'How does it handle KRA eTIMS, and what happens to a sale that cannot be submitted right away?',
      'Is the price a one-time licence or a recurring subscription, and what keeps working if I stop paying?',
      'What does installing and activating it on my computer actually involve?',
    ],
    productIntro:
      'Once you know what the counter needs, you can look at a specific product against it.',
    product: {
      label: 'Omnix Retail',
      path: '/retail',
      demoProduct: 'retail',
      body: 'Omnix Retail is the general shop counter in the range: barcode sales, variants, returns, held sales and stock that moves as you sell, on a Windows desktop that keeps working offline. If you run a specific trade, the pharmacy, restaurant, hardware and salon guides point to the product shaped for it.',
    },
  },
  {
    slug: 'inventory-management-software-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'Choosing inventory management software in Kenya · Buyer guide · Omnix',
    metaDescription:
      'How to choose inventory software for a Kenyan business: receiving and stock-takes, batches and expiry, multi-branch stock, how it ties to the till and KRA eTIMS, migration questions and perpetual pricing.',
    keywords: [
      'inventory management software Kenya',
      'stock control software Kenya',
      'stock take software',
      'batch expiry tracking',
      'multi-branch inventory Kenya',
    ],
    ogTitle: 'Choosing inventory management software in Kenya',
    ogDescription:
      'Receiving, stock-takes, batches, multi-branch stock and how inventory ties to the till, for Kenyan businesses.',
    kicker: 'Buyer guide · Inventory in Kenya',
    title: 'Choosing inventory management software',
    titleAccent: 'in Kenya.',
    lede: 'Stock is usually the largest number on a small business balance sheet and the easiest to lose track of. This guide covers what inventory software should do for a Kenyan business, how it connects to the till and to KRA, and the questions that show whether a system will match your shelf.',
    audienceIntro:
      'Inventory tools range from a single stock list to full batch and multi-branch control. Decide which end you sit at.',
    forYou: [
      'You carry enough stock that a wrong count costs real money, and counts drift between stock-takes.',
      'You receive goods against supplier deliveries and want the received quantity to update stock automatically.',
      'You handle items with batches or expiry dates and need to see what is ageing before it becomes a write-off.',
      'You run more than one branch and want to move stock between them and see each location on its own.',
    ],
    notForYou: [
      'You hold almost no stock and sell a service. A simpler record may serve you better.',
      'You need warehouse-scale features such as automated pick-and-pack. That is a different class of system.',
      'You expect stock to sync live over the internet between branches with no local database. Omnix keeps each device\u2019s records locally first.',
    ],
    workflowIntro:
      'Good inventory software follows an item from delivery to sale to count. Check each stage writes to one record rather than a parallel sheet.',
    workflow: [
      { marker: 'Receive', title: 'Book in a delivery', body: 'Record the supplier, quantity, buying price and, where relevant, batch and expiry against a goods received note.' },
      { marker: 'Value', title: 'Know what stock is worth', body: 'See quantity on hand and stock value so the shelf ties back to what you paid.' },
      { marker: 'Sell', title: 'Deplete as items leave', body: 'Each sale, return or transfer adjusts the count, so you are not reconciling from memory.' },
      { marker: 'Count', title: 'Run a stock-take', body: 'Compare a physical count against the system figure and record the variance with a reason.' },
      { marker: 'Reorder', title: 'See what to buy again', body: 'Read low and dead stock from real movement instead of guessing at the supplier counter.' },
    ],
    boundaryIntro:
      'Inventory records live on the device. A few connected steps sit around them. Keep the two apart when you evaluate.',
    local: [
      'Receiving stock, adjusting counts and running a stock-take.',
      'Recording stock value and movement history.',
      'Moving stock between branches on the same setup.',
      'Reading low-stock and ageing-stock views.',
    ],
    connected: [
      'Sending an M-Pesa STK push when a linked sale is paid.',
      'Submitting a linked sale to KRA eTIMS, retried when the connection returns.',
    ],
    migrationIntro:
      'An opening stock figure that is wrong on day one stays wrong for months. Ask these before you load anything.',
    migrationQuestions: [
      'What is the agreed opening quantity and value for each item, and who signs it off?',
      'Do your current records carry batch, expiry and buying price, or only a name and a count?',
      'How will duplicates, unclear units and missing prices be resolved rather than guessed?',
      'Which historical movements do you need, and which can stay in the old system as reference?',
    ],
    evaluationIntro:
      'Ask any inventory vendor these. They surface whether the system was built for a real Kenyan stockroom.',
    evaluationQuestions: [
      'Does receiving a delivery update stock, or is it a separate step I have to remember?',
      'Can it track batches and expiry, and warn me before stock ages out?',
      'Does it handle more than one branch, and can I move stock between them?',
      'Does stock value reconcile with what the till sold, without a second spreadsheet?',
      'Is the price a one-time licence, and does the software keep working if I stop paying for updates?',
    ],
    productIntro:
      'With those criteria in hand, you can weigh a specific product against your stockroom.',
    product: {
      label: 'Omnix Retail',
      path: '/retail',
      demoProduct: 'retail',
      body: 'Omnix Retail carries the inventory engine used across the range: goods received notes, batch and expiry, stock-take variance, branch transfers and reorder views, tied to each POS sale on a Windows desktop. The pharmacy, hardware, hospitality and salon products add the stock rules specific to those trades.',
    },
  },
  {
    slug: 'pharmacy-software-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'Choosing pharmacy software in Kenya · Buyer guide · Omnix',
    metaDescription:
      'A guide to choosing pharmacy software in Kenya: dispensing and patient records, batch and expiry, the controlled register, SHA and private insurance, M-Pesa and KRA eTIMS, migration questions and perpetual pricing.',
    keywords: [
      'pharmacy software Kenya',
      'pharmacy POS Kenya',
      'dispensing software Kenya',
      'controlled register software',
      'SHA pharmacy billing',
      'batch expiry pharmacy',
    ],
    ogTitle: 'Choosing pharmacy software in Kenya',
    ogDescription:
      'Dispensing, the controlled register, batch and expiry, SHA and insurance, and where M-Pesa and eTIMS fit.',
    kicker: 'Buyer guide · Pharmacy software in Kenya',
    title: 'Choosing pharmacy software',
    titleAccent: 'in Kenya.',
    lede: 'A pharmacy carries obligations a general shop does not: prescriptions, controlled medicines, expiry dates and insurance claims sit on top of ordinary selling. This guide covers what pharmacy software should record, where SHA, M-Pesa and KRA eTIMS fit, and the questions to ask before you trust a system with a dispensing counter.',
    audienceIntro:
      'Pharmacy tools differ from a general till in what they must keep. Decide whether you need the dispensing side at all.',
    forYou: [
      'You dispense against prescriptions and want patient and prescriber details kept with the sale.',
      'You stock medicines with batches and expiry dates and need to see what is close to expiring.',
      'You keep a controlled-medicines register and want each entry recorded consistently.',
      'You claim from SHA or private insurers and want member, cover and copay details captured at the counter.',
    ],
    notForYou: [
      'You run a general shop with a small over-the-counter shelf and no dispensing. A retail till may be enough.',
      'You expect the software to certify your regulatory compliance for you. Software records the work; the statutory duty stays with the pharmacy.',
      'You need a hospital-wide clinical system. Pharmacy POS software is a narrower tool.',
    ],
    workflowIntro:
      'Pharmacy software should follow a medicine from delivery to the patient. Check each stage keeps the records a pharmacy is expected to hold.',
    workflow: [
      { marker: 'Receive', title: 'Book stock in by batch', body: 'Record supplier, quantity, buying price, batch number and expiry date as medicines arrive.' },
      { marker: 'Dispense', title: 'Prepare the prescription', body: 'Keep patient, prescriber, medicine, dosage and refill details together before payment.' },
      { marker: 'Register', title: 'Record controlled items', body: 'Capture the medicine, patient, batch, quantity, prescriber and dispenser for controlled entries.' },
      { marker: 'Claim', title: 'Handle insurance at the counter', body: 'Capture SHA or private cover, the claimed amount and the patient copay at the point of dispensing.' },
      { marker: 'Sell', title: 'Take payment and close the sale', body: 'Move prepared items into the pharmacy POS, take the payment method and complete the sale.' },
    ],
    boundaryIntro:
      'A pharmacy counter cannot stop when the line drops. Know which parts sit in the local record and which reach outside.',
    local: [
      'Dispensing, prescriptions and patient records.',
      'Batch and expiry stock, and the controlled register.',
      'Ringing up and printing a pharmacy sale.',
      "Reading the day's sales, stock and registers.",
    ],
    connected: [
      'An M-Pesa STK push at the counter.',
      'KRA eTIMS submission, retried when the connection returns.',
      'Online SHA or private insurance checks where the provider requires them.',
    ],
    migrationIntro:
      'A pharmacy carries more than a product list. Ask these before any record moves.',
    migrationQuestions: [
      'Which medicines, batches, expiry dates and buying prices must be in place on day one?',
      'Do your current records hold patient and prescriber detail, or only product and price?',
      'How will controlled-register history be treated: keyed in, archived or left in the old book?',
      'Who confirms opening stock and balances before the first live dispense?',
    ],
    evaluationIntro:
      'Ask any pharmacy vendor these before you commit a dispensing counter to their software.',
    evaluationQuestions: [
      'Does it keep patient and prescriber details with the dispensed sale?',
      'Can it track batches and warn on expiry before stock is a loss?',
      'Does the controlled register capture the fields your pharmacy is expected to keep?',
      'How does it handle SHA and private insurance claims at the counter?',
      'Does it keep dispensing and stock working when the internet is down?',
    ],
    productIntro:
      'When the checklist is clear, look at the product built for a Kenyan dispensary.',
    product: {
      label: 'Omnix Pharmacy',
      path: '/pharmacy',
      demoProduct: 'pharmacy',
      body: 'Omnix Pharmacy keeps dispensing, pharmacy POS, batch and expiry stock, prescriptions, patient records and the controlled register in one local working record, with M-Pesa, KRA eTIMS and SHA or private insurance handled as connected steps. It provides the recordkeeping tools; your pharmacy stays responsible for its own procedures and statutory obligations.',
    },
  },
  {
    slug: 'restaurant-pos-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'Choosing a restaurant POS in Kenya · Buyer guide · Omnix',
    metaDescription:
      'How to choose a restaurant, bar or lodge POS in Kenya: tables and kitchen orders, recipe costing, rooms and folios, bill splitting, M-Pesa and KRA eTIMS, migration questions and perpetual pricing.',
    keywords: [
      'restaurant POS Kenya',
      'bar POS Kenya',
      'kitchen display Kenya',
      'recipe costing POS',
      'hotel POS Kenya',
      'M-Pesa restaurant POS',
    ],
    ogTitle: 'Choosing a restaurant POS in Kenya',
    ogDescription:
      'Tables, kitchen orders, recipe costing, rooms and folios, bill splitting, and where M-Pesa and eTIMS fit.',
    kicker: 'Buyer guide · Restaurant POS in Kenya',
    title: 'Choosing a restaurant POS',
    titleAccent: 'in Kenya.',
    lede: 'A restaurant till has to do things a shop counter never will: hold a table open, send the order to the kitchen, cost a plate against its ingredients and split a bill. This guide covers what a Kenyan restaurant, bar or lodge needs from a POS, where M-Pesa and KRA eTIMS fit, and the questions worth asking before service depends on it.',
    audienceIntro:
      'Table service software and a quick-sale till pull in different directions. Check which side your venue sits on.',
    forYou: [
      'You seat guests, keep a table order open and add to it over the course of a meal.',
      'You want orders to reach the kitchen or bar without a waiter walking a paper ticket.',
      'You want to cost recipes so a plate of food deducts its ingredients from stock.',
      'You run rooms or a bar tab and want folios and checkout on the same record.',
    ],
    notForYou: [
      'You run a quick takeaway counter with no table service. A general retail till may be simpler.',
      'You need hotel property management across many properties. That is wider than a POS.',
      'You want kitchen screens to run with no computer on site. Omnix is a Windows desktop product.',
    ],
    workflowIntro:
      'A restaurant POS should follow a table from seating to shift close. Walk service and check each step is on one record.',
    workflow: [
      { marker: 'Seat', title: 'Open a table', body: 'Start an order against a table or tab and keep it open as the guest adds to it.' },
      { marker: 'Fire', title: 'Send to the kitchen', body: 'Push the order to a kitchen display or ticket so the line knows what to prepare.' },
      { marker: 'Cost', title: 'Deduct the recipe', body: 'A sold dish consumes its ingredients by recipe, so stock stays close to the plate.' },
      { marker: 'Bill', title: 'Split and take payment', body: 'Split a bill, add service where it applies and take cash, M-Pesa or card on the same check.' },
      { marker: 'Close', title: 'Reconcile the shift', body: 'Read sales by method, tips and cash variance at shift close from the recorded checks.' },
    ],
    boundaryIntro:
      'Service cannot pause for the network. Know which parts of the flow are local and which reach Safaricom or KRA.',
    local: [
      'Opening tables and taking orders.',
      'Sending orders to a kitchen display on the same setup.',
      'Costing recipes and deducting stock.',
      'Printing checks and reading the shift close.',
    ],
    connected: [
      'An M-Pesa STK push at the table.',
      'KRA eTIMS submission, retried when the connection returns.',
    ],
    migrationIntro:
      'A menu is more than a price list once recipes are involved. Ask these before the first service.',
    migrationQuestions: [
      'Which menu items, recipes and prices must be ready before the first service?',
      'Do you have ingredient costs and recipe quantities, or only menu prices?',
      'How will tables, rooms and folios be set up to match how you actually run?',
      'Who signs off opening stock for the kitchen and bar?',
    ],
    evaluationIntro:
      'Ask any restaurant vendor these before a busy service depends on their software.',
    evaluationQuestions: [
      'Can it hold a table open and add to the order during a meal?',
      'Does it send orders to the kitchen without a paper ticket?',
      'Does a sold dish deduct its ingredients from stock?',
      'Can it split a bill and record several payment methods on one check?',
      'Does service keep running when the internet drops?',
    ],
    productIntro:
      'With the service flow mapped, look at the product built for a Kenyan dining room.',
    product: {
      label: 'Omnix Hospitality',
      path: '/hospitality',
      demoProduct: 'hospitality',
      body: 'Omnix Hospitality runs from table to kitchen to checkout: tables and tabs, a kitchen display, recipe costing, rooms, bookings and folios, on a Windows desktop that keeps taking orders offline. M-Pesa and KRA eTIMS sit around it as connected steps.',
    },
  },
  {
    slug: 'hardware-shop-pos-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'Choosing a hardware shop POS in Kenya · Buyer guide · Omnix',
    metaDescription:
      'How to choose a hardware or equipment POS in Kenya: quotations, contractor accounts and credit, delivery notes, bulk pricing, serialised stock, M-Pesa and KRA eTIMS, migration questions and perpetual pricing.',
    keywords: [
      'hardware POS Kenya',
      'hardware shop software Kenya',
      'contractor credit POS',
      'quotation software Kenya',
      'delivery note software',
      'building supplies POS',
    ],
    ogTitle: 'Choosing a hardware shop POS in Kenya',
    ogDescription:
      'Quotations, contractor credit, delivery notes, bulk pricing and serialised stock, with M-Pesa and eTIMS.',
    kicker: 'Buyer guide · Hardware POS in Kenya',
    title: 'Choosing a hardware shop POS',
    titleAccent: 'in Kenya.',
    lede: 'A hardware counter trades differently from a supermarket: contractors want quotes and credit, deliveries need notes, and prices bend with quantity. This guide covers what a Kenyan hardware store or equipment yard needs from a POS, where M-Pesa and KRA eTIMS fit, and the questions to ask before you tie your stock and your debtors to it.',
    audienceIntro:
      'Trade-counter software and a plain retail till diverge fast once credit and quotes appear. Check where you sit.',
    forYou: [
      'You quote contractors and want a quote to become an invoice without retyping it.',
      'You sell on account and need per-customer credit limits and statements.',
      'You issue delivery notes when goods leave the yard, sometimes before payment.',
      'You price in bulk and want quantity to change the price at the till.',
    ],
    notForYou: [
      'You run a small general shop with no credit customers and no quoting. A general retail till may fit better.',
      'You need heavy-equipment fleet telematics. That is a separate system from a counter POS.',
      'You expect the counter to run only on a phone with no computer on site. Omnix is a Windows desktop product.',
    ],
    workflowIntro:
      'A hardware POS should follow a job from quote to statement. Walk a contractor sale and check each step holds.',
    workflow: [
      { marker: 'Quote', title: 'Prepare a quotation', body: 'Build a quote with bulk pricing, hand it to the contractor and keep it ready to convert.' },
      { marker: 'Convert', title: 'Turn it into a sale', body: 'Accept the quote as an invoice without keying the items again.' },
      { marker: 'Deliver', title: 'Issue a delivery note', body: 'Print and sign a note as goods leave the yard, and open the receivable when they do.' },
      { marker: 'Account', title: 'Sell on contractor credit', body: 'Record the sale against the account, apply the credit limit and produce a statement on demand.' },
      { marker: 'Stock', title: 'Track heavy and serialised items', body: 'Keep counts, tiered prices and serialised units with their warranty details.' },
    ],
    boundaryIntro:
      'A trade counter keeps selling on credit whether the line is up or not. Separate the local record from the connected steps.',
    local: [
      'Quoting, converting quotes and issuing delivery notes.',
      'Recording contractor account sales and statements.',
      'Counting stock and applying tiered prices.',
      "Reading sales, receivables and the day's position.",
    ],
    connected: [
      'An M-Pesa STK push at the counter.',
      'KRA eTIMS submission, retried when the connection returns.',
    ],
    migrationIntro:
      'A hardware store carries debtors as well as stock. Ask these before the switch.',
    migrationQuestions: [
      'Which products, tiered prices and opening stock must be ready on the first day?',
      'Do you have contractor accounts with opening balances and agreed credit limits?',
      'Are there open quotes or delivery notes that need to carry across the switch?',
      'Who confirms opening stock value and debtor balances before going live?',
    ],
    evaluationIntro:
      'Ask any hardware vendor these before your quotes and credit book depend on their software.',
    evaluationQuestions: [
      'Can a quote become an invoice without retyping the items?',
      'Does it hold per-customer credit limits and print a statement?',
      'Does issuing a delivery note open the receivable correctly?',
      'Can the price change with quantity at the till?',
      'Does the counter keep working when the internet is down?',
    ],
    productIntro:
      'With the trade flow clear, look at the product built for a Kenyan hardware counter.',
    product: {
      label: 'Omnix Hardware & Equipment',
      path: '/hardware',
      demoProduct: 'hardware',
      body: 'Omnix Hardware handles the way a trade counter actually sells: quotations that convert to invoices, contractor accounts and statements, delivery notes, tiered pricing and serialised units with warranty records, on a Windows desktop that keeps trading offline. M-Pesa and KRA eTIMS run as connected steps.',
    },
  },
  {
    slug: 'salon-appointment-software-kenya',
    published: true,
    updated: '2026-07-21',
    metaTitle: 'Choosing salon and appointment software in Kenya · Buyer guide · Omnix',
    metaDescription:
      'How to choose salon, barbershop or spa software in Kenya: the appointment diary, staff commissions, packages and memberships, client history, back-bar stock, M-Pesa and KRA eTIMS, migration questions and perpetual pricing.',
    keywords: [
      'salon software Kenya',
      'salon appointment software Kenya',
      'barbershop POS Kenya',
      'spa booking software',
      'staff commission salon',
      'salon POS Kenya',
    ],
    ogTitle: 'Choosing salon and appointment software in Kenya',
    ogDescription:
      'The appointment diary, staff commissions, packages, client history and back-bar stock, with M-Pesa and eTIMS.',
    kicker: 'Buyer guide · Salon software in Kenya',
    title: 'Choosing salon and appointment software',
    titleAccent: 'in Kenya.',
    lede: 'A salon runs on a diary and on trust: who is booked with which stylist, what a returning client had last time, and how commission is worked out at month end. This guide covers what a Kenyan salon, barbershop or spa needs from appointment and checkout software, where M-Pesa and KRA eTIMS fit, and the questions to ask before you move your book onto a screen.',
    audienceIntro:
      'Appointment software and a plain till answer different needs. Decide whether the diary is central to your day.',
    forYou: [
      'You book clients by staff member and day, and want the diary to catch a double-booking for you.',
      'You pay commission and want it worked out at checkout instead of from memory.',
      'You sell packages or memberships that a client draws down over several visits.',
      'You keep client history, formulas and preferences and want them one click away at the chair.',
    ],
    notForYou: [
      'You take walk-ins only and never book ahead. A simple till may be enough.',
      'You need a resort system spanning rooms, restaurants and a full hotel. That is wider than salon software.',
      'You expect the diary to run only in a browser with no computer in the salon. Omnix is a Windows desktop product.',
    ],
    workflowIntro:
      'Salon software should follow a client from booking to checkout. Walk a visit and check each step is on one record.',
    workflow: [
      { marker: 'Book', title: 'Fill the diary', body: 'Book by staff, day or week, with the diary checking the clash before it is saved.' },
      { marker: 'Serve', title: 'Check in the client', body: 'Open the client, see past visits, formulas and preferences, and start the service.' },
      { marker: 'Deduct', title: 'Use back-bar stock', body: 'Products used during a service deduct from stock, so the shelf figure stays honest.' },
      { marker: 'Reward', title: 'Redeem packages and memberships', body: 'A booked session draws down from a package or membership the client bought earlier.' },
      { marker: 'Checkout', title: 'Take payment and accrue commission', body: 'Complete the sale, take the payment method and accrue staff commission at the same time.' },
    ],
    boundaryIntro:
      'A busy diary cannot wait for the network. Know which parts are local and which reach Safaricom or KRA.',
    local: [
      'Booking, rescheduling and checking the diary for clashes.',
      'Client history, formulas and preferences.',
      'Back-bar stock deduction and package redemption.',
      'Checkout and commission accrual.',
    ],
    connected: [
      'An M-Pesa STK push at checkout.',
      'KRA eTIMS submission, retried when the connection returns.',
    ],
    migrationIntro:
      'A salon carries a client book and open packages, not just a service list. Ask these before the switch.',
    migrationQuestions: [
      'Which staff, services, prices and commission rates must be set up before the first booking?',
      'Do you have client history and outstanding packages or memberships to bring across?',
      'How will existing future bookings be entered so nothing is lost on the switch day?',
      'Who confirms back-bar opening stock and package balances before going live?',
    ],
    evaluationIntro:
      'Ask any salon vendor these before your diary and commissions depend on their software.',
    evaluationQuestions: [
      'Does the diary catch a double-booking before it is saved?',
      'Is commission worked out at checkout, per service or at a default rate?',
      'Can a client draw down a package or membership over several visits?',
      'Do products used in a service deduct from back-bar stock?',
      'Do the diary and checkout keep working when the internet drops?',
    ],
    productIntro:
      'With the diary flow mapped, look at the product built for a Kenyan salon.',
    product: {
      label: 'Omnix Salon & Spa',
      path: '/salon',
      demoProduct: 'salon',
      body: 'Omnix Salon keeps the diary, service checkout and stock in one place: appointments with clash checking, staff skills and commission, packages and memberships, client history and back-bar stock, on a Windows desktop that keeps booking offline. M-Pesa and KRA eTIMS run as connected steps.',
    },
  },
]

/**
 * Publication-quality gate.
 *
 * A guide only renders and enters the sitemap when it is explicitly published
 * AND carries every substantive section a buyer guide must have. This blocks
 * thin, templated, or half-written entries from ever being advertised for
 * indexing (the doorway / scaled-content guard).
 */
export function isPublishedGuide(guide: BuyerGuide): boolean {
  return (
    guide.published === true &&
    guide.metaTitle.trim().length >= 15 &&
    guide.metaDescription.trim().length >= 60 &&
    guide.lede.trim().length >= 120 &&
    guide.audienceIntro.trim().length >= 20 &&
    guide.forYou.length >= 3 &&
    guide.notForYou.length >= 2 &&
    guide.workflow.length >= 4 &&
    guide.workflow.every((step) => step.title.trim().length > 0 && step.body.trim().length >= 20) &&
    guide.local.length >= 3 &&
    guide.connected.length >= 2 &&
    guide.migrationQuestions.length >= 3 &&
    guide.evaluationQuestions.length >= 4 &&
    guide.product.path.startsWith('/') &&
    guide.product.body.trim().length >= 80
  )
}

export function publishedGuides(): BuyerGuide[] {
  return BUYER_GUIDES.filter(isPublishedGuide)
}

export function publishedGuideSlugs(): string[] {
  return publishedGuides().map((guide) => guide.slug)
}

export function guideBySlug(slug: string): BuyerGuide | null {
  return BUYER_GUIDES.find((guide) => guide.slug === slug) ?? null
}

/** True only for a guide that exists and passes the publication gate. */
export function publishedGuideBySlug(slug: string): BuyerGuide | null {
  const guide = guideBySlug(slug)
  return guide && isPublishedGuide(guide) ? guide : null
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-US')}`
}

/**
 * Pricing facts derived from the pricing config. Never restated by hand.
 * `oneTime` is the perpetual per-device starter licence; `maintenanceYearly`
 * is the optional compliance-update plan.
 */
export function guidePricingFacts(): { oneTime: string; maintenanceYearly: string } {
  return {
    oneTime: formatKes(pricing.starter.oneTimeFee.KES),
    maintenanceYearly: formatKes(pricing.starter.maintenanceYearly.KES),
  }
}

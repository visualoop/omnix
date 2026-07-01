# Omnix — 30-day sales plan

Written 2026-07-01 by CTO. Turning a working four-module product into paying customers in 30 days. Nothing in here needs new code — every capability referenced is shipped and verified.

---

## The situation

Justine has a working, KRA-compliant, offline-first POS at KES 30,000 one-time. Four variants for four verticals: **Dawa** (pharmacy), **Retail** (mini-marts, supermarkets, salons, spa, general trade), **Hospitality** (restaurants, bars, hotels, lodges), **Hardware** (hardware stores, contractors). Verified: auto-updater, licensing, payments end-to-end.

What's missing is outreach. The product is not the bottleneck; the phone is. This plan is 30 days of specific actions per module.

## The four modules — how each one sells

Each module has a different buyer, a different pitch, and a different objection to overcome. Do not use the same script for a pharmacy owner as a restaurant manager — you'll lose both.

### Dawa · Pharmacy

- **Buyer**: pharmacist-owner (often the technologist), age 30-55, licensed by Pharmacy & Poisons Board
- **Where they hang out**: WhatsApp groups ("Kenya Pharmacists", "Chemists Kenya"), Facebook (Nairobi Pharmacy Owners), pharmacy distributor loyalty programs
- **The hook**: KRA eTIMS from March 2026 audits, SHA insurance claim delays, batch expiry losses
- **The 30-second pitch (voice note)**:
  > "Habari [Chemist Name], I'm Justine — I built pharmacy software specifically for Kenya. Auto-signs your eTIMS receipts, submits SHA claims, tracks batch expiry so you don't lose stock. KES 15,000 first week — no monthly fees. Free install by me. Can I show you Thursday?"
- **Killer demo moment**: ring up a sale → M-Pesa STK → receipt prints → **KRA control number stamped**. Then dispense a prescription → **amber batch-expiry warning** fires on an old batch.
- **Common objection**: "Loyverse works fine" → "Does Loyverse file your eTIMS? Handle SHA claims? Warn on expiring dawa? Because from March 2026, missing eTIMS = KES 10,000 daily fine."
- **Sweet spot**: independent chemists (not chain outlets). 1-2 branches, KES 300k-2M/month revenue. Owner sits at the counter half the day.
- **First-customer target**: 2 in Week 1

### Retail · Mini-marts, dukas, salons, spa, general trade

- **Buyer**: shop owner, often the till operator herself, age 25-60, may have a diploma or not
- **Where they hang out**: local M-Pesa agent lists, Facebook Marketplace groups, supplier delivery routes (Coca-Cola, Bidco, Kabras — the reps know every shop)
- **The hook**: M-Pesa reconciliation nightmare, stock loss to shoplifting, "I can't tell if I'm actually making money"
- **The 30-second pitch (voice note)**:
  > "Habari [Owner name], I'm Justine — I built POS software for Kenyan shops. Works with your M-Pesa Till or Paystack, tracks every sale, tells you at close of day exactly what you made — cash, mpesa, credit. KES 15,000 to install this week. No monthly fees. Can I stop by tomorrow?"
- **Killer demo moment**: at close of shift, hit "Close shift" → screen shows exactly how much cash should be in the drawer, how much M-Pesa hit the Till, and any variance. Owner nods slowly.
- **Common objection**: "It's expensive" → "You lose KES 800 a day on shrinkage right now — that's KES 24,000 a month. This pays back in 3 weeks."
- **Sweet spot**: mini-marts and dukas with 200-800 SKUs, KES 200k-1M/month revenue. Salon/spa owners who charge M-Pesa and don't reconcile.
- **First-customer target**: 3 in Week 2

### Hospitality · Restaurants, bars, hotels, lodges

- **Buyer**: manager or chef-owner, age 30-50, comfortable with technology (they've been burned by cheap POS before)
- **Where they hang out**: Nairobi Restaurant Owners Facebook group, Airbnb Superhost communities, Zomato/Glovo delivery-partner WhatsApp channels
- **The hook**: split payments per table are painful, kitchen order tickets get lost, no way to track a bar tab across 3 rounds
- **The 30-second pitch (voice note)**:
  > "Habari [Restaurant Name], I'm Justine — I built restaurant POS software. Tables, KOT to the kitchen printer, split-bill payment (2 cash + 2 M-Pesa), and every eTIMS + SHIF receipt handled automatically. KES 15,000 install this week. Can I show you between lunch and dinner service on Thursday?"
- **Killer demo moment**: order at table 4 → send to kitchen (KOT prints in "kitchen") → close bill with 4 different M-Pesa Till numbers → each customer gets their own eTIMS receipt.
- **Common objection**: "We're using [pen and paper / Excel]" → "Ask your accountant how much time they spend cleaning up the receipt book each month. You're paying them KES 30,000/month for that. Automate it once."
- **Sweet spot**: single-location restaurant with 20-60 seats, 4-8 staff, KES 500k-3M/month. Coastal beach lodges (they don't get Nairobi-based sales calls).
- **First-customer target**: 2 in Week 3

### Hardware · Hardware stores, building materials, contractors

- **Buyer**: shop owner, age 40-70, sceptical of software, best reached in person or through a supplier rep who already visits them
- **Where they hang out**: Kenya Hardware Owners' Association, Kambaa quarry co-op, cement distributor sales meetings, physical Enterprise Road / Industrial Area shops
- **The hook**: **bulk pricing tiers** are guessed at manually, quotes take 30 min to write, contractor accounts are on scraps of paper, invoices get lost
- **The 30-second pitch (in person or WhatsApp voice)**:
  > "Habari mzee, I'm Justine — I built software for hardware shops. Bulk pricing per customer type, quotes → convert to invoice in one click, contractor account tracking, delivery notes with signatures. KES 15,000 install this week. Free install by me — I'll come to your shop Thursday and set it up in 45 minutes."
- **Killer demo moment**: contractor walks in for 50 bags of cement → search "cement 50kg" → system auto-applies contractor pricing → generate quote → convert to invoice → print delivery note. All in 40 seconds.
- **Common objection**: "My son handles the books" → "Bring him in. If he can't run this in 20 minutes I'll refund." (High confidence because the UI actually is simple.)
- **Sweet spot**: shops on Enterprise Road, Landhies Road, Kariokor, Kariobangi light industries, Ruaraka. KES 1M-5M/month, 3-8 contractor accounts, physical premises with a counter.
- **First-customer target**: 1 in Week 3, expand in Month 2 (long sales cycle — these owners buy in person, not on WhatsApp)

## The commercial offer (same across all modules)

**Price:** KES 30,000 one-time per module.

**Launch offer (first 10 customers per module):** KES 15,000 (50% off). Payable to Paystack via M-Pesa STK OR to your Till + admin captures the M-Pesa code. **Free install by Justine personally** that same week.

**Why this offer closes:**
- **Free install** removes the biggest fear (setup + trust). You show up in person.
- **Half price for first 10** = real urgency (you can only install 10 solo per module per month). Not a lie.
- **No monthly fees ever.** The single strongest differentiator vs Loyverse, Sokoni, Vend.
- **KRA eTIMS included.** Owners are terrified of KRA fines from March 2026 audits.

## The 30-day plan

### Which module to attack when

Order matters. Do NOT try to sell all four modules at once — you'll dilute your pitch and confuse yourself.

| Week | Primary module | Secondary | Why |
|---|---|---|---|
| 1 | **Dawa** | — | Strongest fear-driven pitch (KRA + SHA), highest willingness-to-pay, best differentiation vs incumbents |
| 2 | **Dawa** | **Retail** | Ride week 1 momentum + testimonials; add retail for volume |
| 3 | **Retail** | **Hospitality** | Retail cycle is fast; hospitality demos require between-service timing |
| 4 | **Hospitality** | **Hardware** (in person) | Hardware needs walk-in demos — save for when you have testimonials from all three other modules |

Total target after 30 days: **10 Dawa + 8 Retail + 3 Hospitality + 2 Hardware = 23 paying customers**. At blended KES 15k avg = **KES 345,000 gross**.

---

### Week 1 — Dawa launch (goal: 2 paying pharmacies)

**Monday**
1. Atlas → Prospector → **"pharmacies Nairobi CBD"** → import 50 as companies. Tag: `#dawa`, `#week1`.
2. Draft **Dawa voice note** (see script above). Record it. Listen. Re-record until it sounds like you, not a script.
3. Send **20 voice notes** before lunch. Do not wait for perfect.
4. Reply to every response within 2 hours.

**Tuesday–Wednesday**
5. Book **3 pharmacy demos** for Thursday.
6. Rehearse the pharmacy demo: ring up 3 items → M-Pesa STK → **eTIMS control number stamps on receipt** → dispense prescription → **amber batch-expiry toast**. Under 3 minutes.
7. Pack the demo bag: laptop, thermal printer, USB scanner, M-Pesa Till number, license keys pre-generated for Dawa.

**Thursday** — install day
8. Do the 3 pharmacy demos. Install on-the-spot for anyone who says yes.
9. Take KES 15,000 via M-Pesa. Use `/admin/licenses/[id]/mark-paid` to record.
10. Get their permission for a photo + 15-second video testimonial while Omnix is live on their counter.

**Friday**
11. Post yesterday's install on WhatsApp Status + X. **Tag the pharmacy name** if they allowed it.
12. Send 20 more Dawa voice notes.

**Weekend**
13. Follow up week-1 non-repliers via Atlas Campaigns (WhatsApp drip #2).

**Week 1 target: 2 paying pharmacies. KES 30,000 gross.**

---

### Week 2 — Dawa expands + Retail begins (goal: 3 more Dawa, 2 Retail)

**Monday**
1. Atlas Prospector: pull another 50 pharmacies — **Mombasa / Kisumu / Nakuru** if possible; otherwise Westlands / Kilimani / Karen.
2. Send 30 more Dawa voice notes (with the video testimonial from Week 1 attached).
3. Same day: pull **50 retail shops** in Nairobi CBD via Prospector query "shops Nairobi CBD" or "mini-marts Nairobi CBD".
4. Draft the **Retail voice note** (see script above).
5. Send 20 Retail voice notes.

**Tuesday–Wednesday**
6. Book **3 pharmacy demos + 2 retail demos** for Thursday.

**Thursday**
7. Morning: pharmacy demos (you're now on your 3rd of these — you can do it in your sleep).
8. Afternoon: retail demos. Different pitch, same product logic. Show the close-shift screen (Retail's killer moment).
9. Install anyone who says yes.

**Friday**
10. Identify **one reseller candidate**. Someone who talks to shop owners daily — a pharmacy distributor rep, a soft-drink route salesperson, an M-Pesa agent, or a friend who runs an IT support shop.
11. Offer them **25% commission** per install. Sign them via `/admin/users/[id]` → promote to reseller.
12. Send them the welcome kit: pitch script, screenshots, referral link, WhatsApp templates for both Dawa + Retail.

**Weekend**
13. Post the second batch of install photos + testimonials.
14. Send a "only 6 half-price slots left" urgency nudge to non-responders.

**Week 2 target: 3 more Dawa + 2 Retail = 5 more customers. KES 75,000 gross. Running total: 7 customers, KES 105,000.**

---

### Week 3 — Retail scales, Hospitality opens, Hardware begins (goal: 6 Retail, 2 Hospitality, 1 Hardware)

**Monday**
1. Reseller now has 3-5 leads from their own network. Support them: 15-min video call to answer product questions.
2. You focus on **retail walk-ins in Nairobi CBD** — walk into 20 mini-marts with your laptop between 10am and 2pm (owners are usually at the counter).

**Tuesday**
3. Atlas Prospector: pull **30 restaurants + bars** — query "restaurants Nairobi", "bars Nairobi", "hotels Nairobi Westlands".
4. Draft the **Hospitality voice note** (see script above).
5. Send 20 hospitality voice notes.
6. Timing matters: restaurants respond best between 3pm-5pm (between lunch and dinner service).

**Wednesday**
7. Atlas Prospector: pull **15 hardware stores** — query "hardware Nairobi", "hardware Enterprise Road", "hardware Landhies".
8. Hardware is different — send **fewer, more targeted** voice notes. And plan to **visit in person** for the demo. Hardware owners buy face-to-face.

**Thursday–Friday**
9. Do the demos: 2 restaurants + 1 hardware store + any retail from Monday's walk-ins.
10. Ask every existing customer for **one referral** — offer KES 5,000 off their next maintenance for each referral who buys.

**Weekend**
11. Post to Facebook groups: "Kenya Pharmacists", "Nairobi Restaurant Owners", "Hardware Owners Kenya", "Kenya Shop Owners". **Not "buy my software"** — share the free "How to file eTIMS in 5 minutes" video guide. Attracts owners; conversation opens naturally in comments.

**Week 3 target: 6 Retail + 2 Hospitality + 1 Hardware = 9 more customers. KES 135,000 gross. Running total: 16 customers, KES 240,000.**

---

### Week 4 — Compound + scale (goal: 4 mixed, close month at 20+)

**Monday**
1. Reseller now has their own referrals compounding. Their pipeline is ~10 open, closing 4-6. You're less involved.
2. You focus on **the highest-value verticals**:
   - Restaurant chains (2-3 locations from the same owner)
   - Hardware stores near where you've already installed a pharmacy (referral density)

**Tuesday**
3. Email one distributor rep (pharmacy or cement — the ones who visit every shop weekly) offering commission demo for their whole network. This is a longer play; plant the seed in Month 1, harvest in Month 2.

**Wednesday–Thursday**
4. **Walk-in day**: Kikuyu / Kiambu / Thika Road — different geography, different competition. Retail focus.
5. Existing customers (weeks 1-3): check in, verify working well, ask for one referral each.

**Friday**
6. **First month wrap-up**: post totals + testimonials on X/LinkedIn/Facebook. This "we're real, we have 20 customers" post unlocks the next wave.

**Weekend**
7. Compile a **case study** from your best week-1 pharmacy — a 1-page PDF ("How Sokoro Chemist saved KES 40,000 in month 1 with Omnix"). This becomes your Month 2 marketing artifact.

**Week 4 target: 4-6 more customers. Running total: 20-23 customers. KES 300,000-345,000 gross.**

---

## The math, per module

Real Kenyan cold-outreach conversion, tuned per vertical:

| Module | 1 outreach cycle → replies | Replies → demos | Demos → paid | Expected paid per 200 outreach |
|---|---|---|---|---|
| Dawa | 20-30% (KRA hook is strong) | 30-40% | 40-50% | 8-15 customers |
| Retail | 15-25% (crowded market) | 20-30% | 25-35% | 4-9 customers |
| Hospitality | 20-30% (higher intent) | 30-40% | 35-45% | 6-12 customers |
| Hardware | 10-15% (WhatsApp weak for this crowd) | 40-60% (in-person converts hard) | 40-50% | 3-7 customers |

Dawa + Hospitality are your highest ROI per message. Retail is volume. Hardware is high-value but slow — plant seeds now, close in Month 2.

## The commercial goals

At blended KES 15k per customer (launch pricing), first-month targets:

| Milestone | Customers | Gross | Take-home after M-Pesa/Paystack fees + petrol |
|---|---|---|---|
| Baseline (no reseller, weak follow-up) | 8-12 | KES 120k-180k | KES 90k-140k |
| **Target (this plan, executed)** | 20-25 | KES 300k-375k | KES 230k-290k |
| Stretch (reseller performs) | 30-40 | KES 450k-600k | KES 340k-460k |

Month 2 flips: launch pricing ends after first 10 per module (40 customers gross). Price returns to KES 30,000. Reseller pipeline mature. Existing-customer referrals kick in. **Realistic Month 2 target: 30-50 customers at KES 25,000 blended = KES 750k-1.25M gross.**

## The 12 things that must be true before Monday

Pre-flight checklist. Print it. Tick each.

- [ ] Live Paystack keys are in `/admin/settings` (not sandbox)
- [ ] Test buy: KES 100 test license via Paystack → auto-activates within 30s
- [ ] M-Pesa Till registered + tested
- [ ] Manual M-Pesa admin flow tested end-to-end
- [ ] Post-payment email arrives with license key + download link (test with your own email)
- [ ] Your WhatsApp Business number on the landing page footer
- [ ] Four voice-note openers recorded — one per module (Dawa / Retail / Hospitality / Hardware)
- [ ] Prospector queries prepared for all four modules
- [ ] Thermal printer + USB scanner + laptop packed
- [ ] KES 5,000 in petrol / matatu money for shop visits
- [ ] Weekend cleared
- [ ] One friend / family member briefed to receive incoming M-Pesa if you're on the road

## Common objections — per module cheat sheet

### Dawa (Pharmacy)
- **"Loyverse works"** → "Does it sign eTIMS automatically? Handle SHA claims? Warn expiry? From March 2026 KRA is auditing — KES 10,000/day fine for missing receipts."
- **"Too expensive"** → "You lose KES 15,000/month on expired stock. This pays for itself in the first month."
- **"I need to ask my pharmacist son"** → "Bring him. If it takes him more than 30 minutes to learn, I'll refund."

### Retail (Mini-marts, dukas, salons)
- **"I use Loyverse for free"** → "Does it reconcile M-Pesa with cash sales at close of shift? Because you're losing KES 800/day right now and don't know where."
- **"My son runs the till"** → "Perfect — bring him to the demo. He'll like it."
- **"I need to think"** → "Sure. I'll leave it installed on 30-day trial. Use it Monday morning."

### Hospitality (Restaurants, bars)
- **"We use paper KOT"** → "How often do you lose orders? Once a week? That's KES 2,000 gone. This eliminates it."
- **"POS in Kenya is unreliable"** → "That's exactly why I built this — works offline, syncs when internet returns."
- **"My chef won't use it"** → "The chef sees a printer output — no clicks required. Same as the paper he has now, but automatic."

### Hardware (Hardware stores)
- **"I don't need software mzee, I know my customers"** → "Show me your quote book. When Kioko last bought 50 bags of cement — what price did you charge him? [Owner flips through paper]. Software tells you in 2 seconds, forever."
- **"Too complicated"** → "45-minute setup. I do it. Your son runs it. Try it for 30 days free."
- **"My competition doesn't have it"** → "Exactly. When Kioko compares your quote (2 min from you) vs. their quote (10 min from them), who wins?"

## What NOT to do

- Do not build another feature this month (Atlas or Omnix)
- Do not try to sell all four modules to the same shop
- Do not offer more than 50% off — protect the price anchor
- Do not accept "I'll pay next week" more than once from the same lead
- Do not attend startup meetups (buyers aren't there)
- Do not perfect the landing page (customers rarely read past the hero)
- Do not spend >2 hours per install (30 min setup + 15 min training + 15 min buffer, hard cap)
- Do not mix module scripts — a Dawa opener to a restaurant loses both

## The single thing that matters

**Send 20 WhatsApp voice notes before end of day today, all Dawa.**

Not tomorrow. Not "after I refine the script." Today. 20 messages. Dawa vertical. Voice notes, not text.

Everything else in this plan compounds off that one action. If Monday ends with 0 messages sent, the plan didn't happen and no code change saves it.

If Monday ends with 20 sent, everything else — Week 2's retail expansion, Week 3's hospitality, Week 4's compounding — is downstream physics. The plan runs itself once the ball is rolling.

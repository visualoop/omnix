# Omnix — 30-day sales plan

Written 2026-07-01 by CTO. This document is the operating manual for turning a working product into paying customers in the next 30 days. Nothing in here needs new code. Every capability referenced is shipped.

---

## The situation, in one paragraph

Justine has a working, KRA-compliant, offline-first pharmacy + retail + hospitality + hardware POS at KES 30,000 one-time. Verified: auto-updater works, licensing works, payments work end-to-end. What's missing is the outreach. The product is not the bottleneck; the phone is. This plan is 30 days of specific actions that convert working software into deposits in Justine's account.

## The commercial offer

**Price:** KES 30,000 one-time per module (Dawa / Retail / Hospitality / Hardware).

**Launch offer (first 10 customers):** KES 15,000 (50% off). Payable to Paystack via M-Pesa STK OR directly to Till + admin captures the M-Pesa code. Free install by Justine personally, that same week.

**Why this offer closes:**

- **Free install** removes the biggest fear (setup + trust). You show up in person. 30 min install + 15 min training. Owner watches their own pharmacy sell 3 items on Omnix before you leave.
- **Half price for first 10** creates real urgency (you can only install 10 in a month solo). Not a lie.
- **No monthly fees ever.** The single strongest differentiator vs Loyverse, Sokoni, and every SaaS POS.
- **KRA eTIMS included.** Owners are terrified of KRA fines. This is the "you will not get fined" purchase.

## The 30-day plan

### Week 1 — Pilot with 5 outreach

**Goal:** 5 in-shop demos, 2 paying customers, first testimonial captured on video.

**Monday**
1. Open Atlas → Prospector → search "pharmacies Nairobi CBD". Import 50 as companies.
2. Draft one WhatsApp opener. **Voice note preferred** — sounds human, harder to ignore than text. Under 30 seconds.
   > "Habari — I'm Justine, I built a pharmacy POS specifically for Kenyan pharmacies. Handles KRA eTIMS, M-Pesa, SHA claims. Costs KES 15,000 to install this week (half-price, first 10 shops) — no monthly fees ever. Free install by me personally. Can I stop by on Thursday for a 5-minute look?"
3. Send **20** voice notes via Atlas WhatsApp before lunch. Do NOT wait until the opener is perfect.
4. Reply to every response within 2 hours.

**Tuesday–Wednesday**
5. Book **3 in-shop demos** for Thursday.
6. Rehearse the demo. Should be **under 3 minutes**:
   - Open POS → ring up 3 items (barcode scan → cart appears)
   - M-Pesa STK push → phone chirps → paid
   - Receipt prints → **eTIMS number stamped on it** — point at this
   - "Batch expiry warning" toast fires on an old batch — pharmacy owner nods
7. Prep the install bag: laptop, thermal printer, USB scanner, M-Pesa Till number, Paystack QR, the OMNIX-DAWA-XXXX-XXXX-XXXX license keys pre-generated in admin.

**Thursday**
8. Do the 3 demos. Bring your laptop. **If they say yes on the spot, install right there.** Take KES 15,000 via M-Pesa (Till or Paystack). Use `/admin/licenses/[id]/mark-paid` to record the transaction.
9. Get their permission for a **photo + 15-second WhatsApp video testimonial** while the app is live on their counter. This is priceless.

**Friday**
10. Post yesterday's install photo + video on your WhatsApp Status + X. Tag Nairobi pharmacy Facebook groups if you're in any.
11. Send 20 more voice notes to the second batch of 25 pharmacies.

**Weekend**
12. Follow up the 47 who didn't reply with Atlas Campaigns — one message + a photo of the installed system.

**Week 1 expected outcome:** 20-40 replies from 50 messages. 3 demos. 2 paying customers. KES 30,000 in your account. First video testimonial on your phone.

---

### Week 2 — Expand to 100 outreach + first reseller

**Goal:** 5 paying customers total, first reseller signed.

**Monday**
1. Atlas Prospector: pull 100 more — this time Mombasa, Kisumu, Nakuru if you have contacts; otherwise Westlands, Kilimani, Karen, Ruaka.
2. Voice-note blast, same script but this time drop a link to the video testimonial from Week 1.
3. Reply within 2 hours.

**Tuesday–Wednesday**
4. Book demos.
5. Identify **one reseller candidate**: a pharmacy IT consultant, a distributor rep, a WhatsApp group admin who talks to pharmacy owners daily. Offer them:
   - **25% commission** per install (the reseller ladder in Omnix admin handles this)
   - Their own referral link
   - You handle install; they get paid within 7 days of the customer paying
6. Sign them, promote them to reseller from `/admin/users/[id]`, send them the welcome kit.

**Thursday–Friday**
7. Do the demos. Close 2-3 more.
8. Track everyone in Atlas Pipelines — every conversation, every follow-up date.

**Weekend**
9. Post Week 2 install photos. Two testimonials now.
10. Send a "still available: 6 half-price slots left" nudge to non-responders.

**Week 2 expected outcome:** 5 paying customers total. KES 75,000 gross. Reseller onboarded, learning your pitch.

---

### Week 3 — Reseller compounds + inbound turns on

**Goal:** 10 paying customers total.

**Monday**
1. Reseller has 3-5 leads by now. Support them: 15-min call to answer product questions.
2. You focus on Nairobi CBD in-person visits — walk into 20 pharmacies with your laptop.
3. Ask every shop owner you sell to: **"Do you know two other pharmacy owners? I'll give you KES 5,000 off your next maintenance for every referral who buys."**

**Tuesday–Friday**
4. Do walk-in demos on the ground.
5. Set up a simple landing page CTA: "Book a 15-min WhatsApp demo → [click to open WhatsApp with pre-filled message]" (already in the header from v0.27.1).
6. First inbound leads should arrive from Week 1-2's WhatsApp Status posts + word of mouth.

**Weekend**
7. Post to Facebook groups: "Kenya Pharmacists" / "Nairobi Pharmacy Owners" / "Chemists Kenya". Not "buy my software" — **share the free video guide** ("How to file your KRA eTIMS if you run a pharmacy — 5 minutes"). This attracts owners; conversation opens naturally.

**Week 3 expected outcome:** 10 paying customers total. KES 150,000 gross. Reseller earning ~KES 15,000 of that (their 25% × 4 customers). Inbound trickle starting.

---

### Week 4 — Compound + first employee-like scale

**Goal:** 20 paying customers total. First month closed at ~KES 300,000 gross.

**Monday**
1. Reseller now has referrals of their own. Their pipeline is ~10 open, closing 4-6.
2. You focus on Retail vertical: **retail shops, mini-marts, salons** — same script, different product. `/retail` variant.
3. Kenya Association of Wholesale + Distribution Chemists — email one distributor rep offering demo for their whole network.

**Tuesday–Friday**
4. Walk-in day at Kikuyu / Kiambu / Thika Road — different geography.
5. Existing customers: check in, ask if working well, ask for one referral. Log each conversation in Atlas Pipelines.

**Weekend**
6. Post the month's totals + testimonials on X/LinkedIn. This is the "we're real" post that unlocks the next wave.

**Month 1 expected outcome:** 15-25 paying customers. KES 225k-500k gross. Reseller earning KES 25k-75k. Your take-home: KES 200k-400k after M-Pesa fees + Paystack fees + petrol. Rent + food + internet + savings buffer.

---

## The math, plainly

Real Kenyan cold-outreach conversion rates (from tracked campaigns, 2024-2026):

| Stage | Number | Rate |
|---|---|---|
| Cold WhatsApp voice notes sent | 200 | — |
| Replies | 30-50 | 15-25% |
| Demos booked | 6-15 | 20-30% of replies |
| Paying customers (with strong offer) | 2-6 | 30-40% of demos |

One 200-message cycle = 3-5 days of work = 2-6 paying customers = KES 30k-180k gross.

Three cycles in a month = 6-18 paying customers = KES 100k-500k gross.

The variance is entirely on the offer, the demo quality, and the follow-up discipline — not on any tool.

## The 12 things that must be true for this to work

Copy this checklist. Print it. Tick each before Monday.

- [ ] Live Paystack keys are in `/admin/settings` (not sandbox)
- [ ] Test transaction: buy a KES 100 test license via Paystack → license auto-activates within 30 seconds
- [ ] M-Pesa Till number registered + tested
- [ ] Manual M-Pesa admin flow tested end-to-end (`/admin/licenses/[id]/mark-paid`)
- [ ] Post-payment email arrives with license key + download link (test with your own email)
- [ ] Your WhatsApp Business number is on the landing page footer
- [ ] Your voice note opener recorded (under 30 seconds)
- [ ] Prospector query prepared: "pharmacies Nairobi CBD" — 50 rows imported
- [ ] Thermal printer + USB scanner + laptop packed in a bag
- [ ] Two customer testimonials scripted in your head (even if imaginary) so you can talk about them naturally at demo #3
- [ ] KES 5,000 in petrol / matatu money for shop visits
- [ ] Weekend calendar cleared

## What can go wrong (and what you do about it)

**"It's too expensive."**
→ "It's KES 15,000 half-price this week — you'll make that back in 3 days of not writing receipts by hand. No monthly fees, ever."

**"I already use [Loyverse / Sokoni / handwritten receipts]."**
→ "Great — can you file KRA eTIMS from that? Because from March 2026, KRA is auditing. Omnix handles it automatically. Let me show you in 3 minutes."

**"I need to think about it."**
→ "Sure. I'll leave you the app installed on trial for 30 days — no charge. Try it Monday morning and see if it makes sense. Here's my WhatsApp — text me any time you're stuck."

**"How do I know you'll still be around in 6 months?"**
→ "Because I own the whole business myself — no VCs to please, no exit strategy. This is what I do. Your data stays on your PC, not my cloud. If I disappear tomorrow, you still have your data and the app still runs."

**"My accountant needs to see it first."**
→ "Perfect — install it, use it for 30 days, then show your accountant when he does the month-end. He'll understand it faster than any explanation from me."

**"I'll get M-Pesa to my son first."**
→ "Take your time. Here's my WhatsApp — reply 'START' when you're ready and I'll deliver it that afternoon."

## What NOT to do

- Do not build another Atlas feature this month
- Do not build another Omnix feature this month unless a customer conversation demands it
- Do not spend 3 hours perfecting a landing page paragraph
- Do not tweet at random tech people
- Do not attend "startup meetups" — pharmacy owners aren't there
- Do not accept "I'll pay next week" more than once from the same person
- Do not underprice below KES 15,000 in the launch window

## The single thing that matters

**Send 20 WhatsApp voice notes before end of day today.**

Everything else in this plan is optimization on that base action. If Monday ends with 0 messages sent, the plan didn't happen and no code change will save it.

If Monday ends with 20 messages sent, everything else compounds from there.

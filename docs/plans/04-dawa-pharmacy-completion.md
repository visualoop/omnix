# 04 — Dawa Pharmacy Completion

**Goal:** finish the few remaining gaps so Dawa is genuinely production-ready, not "shipped".

## What's already done

See [00-current-state.md](./00-current-state.md) — Dawa has prescriptions, drug labels, refills, doctors, interactions, controlled log, patient profiles, expiry alerts, VAT exemption, SHA claims, loyalty.

## Gaps to fill

### 1. Pharmacist on duty 🟡
- The Pharmacy Practitioners Act requires a registered pharmacist on duty when controlled substances are dispensed
- Add `pharmacist_id` to prescriptions (vs `dispensed_by` which is the user that punched it in)
- Pharmacist dropdown selects from employees with role 'pharmacist'
- Their license number printed on labels + dispensary register

### 2. Daily controlled-substances register 🟡
- We log each dispense, but pharmacists need a daily-totals printable
- Page `/pharmacy/controlled-register` — date-ranged, with totals per drug, signatures

### 3. PPB (Pharmacy & Poisons Board) compliance fields 🟢
- Each pharmacy product should optionally have a `ppb_registration_number`
- Show on labels for consumer trust
- Field in product detail

### 4. Insurance pre-authorization 🟡
- Some insurers require pre-auth for high-value scripts
- Add `pre_auth_required INTEGER`, `pre_auth_code TEXT` to claims
- UI: when pre-auth required, gate "Submit" until code entered

### 5. SHA / NHIF biometric session 🟢
- The newer SHA claims require biometric verification at point of dispense
- Currently we just enter member number
- Defer for now — needs SHA SDK integration that's not public yet

### 6. Auto-suggest dose by patient weight 🟡
- For pediatrics: many drugs dosed mg/kg
- When patient is a child, prompt for weight, suggest dose
- Dose calculator widget on prescription form

### 7. Drug-allergy + drug-condition checks 🟡
- We have drug-drug interactions
- Need: when patient profile has allergy/condition tag, warn if any item in cart conflicts
- Examples: penicillin allergy → warn on amoxicillin; diabetic → warn on sugar-syrup formulations

### 8. Cold-chain monitoring 🟢
- Some drugs require 2-8°C storage
- We mark `cold_chain` on product but don't enforce or alert
- Add: temperature log entries, reminder to record morning/evening fridge temp

### 9. Stock by category — pharmacy-aware 🟢
- Schedule II / III drugs report
- Antibiotic usage report (for AMR surveillance)
- Generic vs branded sales mix

### 10. Bulk drug import (PSK directory) 🟡
- The Pharmaceutical Society of Kenya publishes a master drug list
- Import CSV with generic names, dosage forms, common strengths
- Speeds up adding drugs to inventory

### 11. Patient refill reminders 🟡 [DEFERRED — SMS feature dropped]
- We have refill records but SMS reminders are no longer planned
- May implement in-app reminders (next-visit display when patient walks in) instead

### 12. Print barcode labels for compounds 🟢
- For pharmacy-prepared compounds (not factory packed), print our own barcode label
- Already have label printing infrastructure, just needs a barcode rendering library

### 13. Veterinary pharmacy split 🟢
- Some pharmacies dispense for animals too
- Tag products as 'veterinary' / 'human' / 'both'
- Dispense flow asks species when veterinary

### 14. eTIMS for pharmacy (HS codes) 🟢
- Already have eTIMS, but pharmacy items need correct HS codes (3004.* category)
- Add a `hs_code` field on products with auto-suggest based on product type

## Build order

1. **Pharmacist on duty** + controlled register (1 batch)
2. **PPB registration field** + display (1 small batch)
3. **Drug allergy / condition warning** (extend interaction system) (1 batch)
4. **Pre-auth fields** for insurance (1 batch)
5. **PSK drug directory CSV import** (1 batch — big)
6. ~~**Refill SMS reminders** wiring~~ [DROPPED — SMS feature out of scope]

## Out of scope (defer to v2)

- SHA biometric integration (requires SDK we don't have)
- Cold-chain temperature logger (could be its own module)
- Veterinary mode (small market, defer)
- Compound recipe / BOM (advanced)

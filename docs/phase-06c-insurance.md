# Phase 6C — Insurance Claims (SHA/SHIF)

## Why This Matters
Pharmacies in Kenya process insurance claims daily through the Social Health Authority (SHA/SHIF, which replaced NHIF). This represents 30-40% of revenue for many pharmacies. Without this, the system is incomplete.

## Architecture

```
Patient presents → Verify SHA membership → 
Dispense medication → Generate claim → 
Submit to SHA portal → Track payment
```

**Internet required** for verification and submission. Offline: record claim details, submit later.

## Tasks

### 6C.1 Insurance Provider Configuration
Settings → Insurance:
- SHA/SHIF API credentials (from SHA portal)
- Private insurance companies (manual claim process)
- Copay rules per provider
- Claim submission schedule

### 6C.2 Insurance Providers Supported
- **SHA/SHIF** (government, primary) — API integration
- **Private insurers** (AAR, Jubilee, Britam, Madison, CIC, etc.) — manual claim generation with printable forms / digital submission where API available

### 6C.3 Patient/Member Verification
1. Patient presents insurance card or member number
2. System queries SHA API for:
   - Membership status (active/inactive)
   - Benefit balance remaining
   - Copay requirements
   - Covered items list
3. Display: "Member active — KES 5,000 balance remaining"

### 6C.4 Insurance Sale Flow
1. Select "Insurance" payment method at POS
2. Enter member number → verify
3. System separates items into:
   - Covered (insurance pays)
   - Not covered (patient pays)
4. Calculate copay (if applicable)
5. Patient pays copay (cash/M-Pesa)
6. Insurance portion recorded as claim

### 6C.5 Claim Generation
Each insurance sale creates a claim record:
```sql
insurance_claims (id, sale_id, provider, member_number, member_name,
                  claim_amount, copay_amount, status, 
                  submitted_at, response, paid_at, 
                  rejection_reason, batch_id)
```

### 6C.6 Claim Submission
- **SHA:** Submit via API (batch or individual)
- **Private:** Generate claim form (PDF) for manual submission
- Batch submission: group day's claims and submit together
- Track status: Pending → Submitted → Approved → Paid / Rejected

### 6C.7 Claims Management Screen
- List all claims with status filters
- Pending claims needing submission
- Rejected claims (with reason) — resubmit option
- Payment tracking (when insurer pays)
- Aging report: claims outstanding > 7 / 14 / 30 days
- Monthly claims summary per provider

### 6C.8 Offline Handling
- If no internet: record claim details locally
- Mark as "pending verification" (proceed with sale based on card)
- Submit verification + claim when online
- Pharmacy bears risk for unverified claims (standard practice)

### 6C.9 Insurance Reports
- Claims submitted per period
- Claims paid vs rejected
- Average payment turnaround
- Revenue breakdown: cash vs insurance
- Outstanding receivables from insurers

## Done When
- SHA member can be verified at POS
- Insurance sale splits covered/copay correctly
- Claim generated and submitted to SHA
- Private insurer claims generate printable forms
- Claims tracking shows status pipeline
- Rejection alerts notify pharmacy
- Insurance revenue reports work

# Phase 6B — KRA eTIMS Compliance (MANDATORY)

## Why This Is Non-Negotiable
Every business in Kenya is legally required to generate eTIMS-compliant tax invoices since 2024. A pharmacy cannot legally sell without this. If Omnix doesn't have eTIMS, no pharmacy will buy it.

## Architecture

Omnix uses **VSCU (Virtual Sales Control Unit)** — a software-based integration that signs invoices via KRA's API.

```
Sale completed → Invoice generated → 
Signed via eTIMS VSCU API → QR code added → 
Receipt printed with KRA-compliant details
```

**Internet required** for signing. Offline fallback: queue invoices and submit when connection returns (KRA allows batch submission within 48 hours).

## Tasks

### 6B.1 eTIMS Registration (One-Time Setup)
Settings → Tax → eTIMS Configuration:
- Business KRA PIN
- VSCU device serial (obtained from KRA portal)
- API credentials
- System validates connection
- Stores VSCU config encrypted

### 6B.2 Invoice Generation (Every Sale)
On sale completion, system automatically:
1. Generates invoice with required fields:
   - Seller TIN (KRA PIN)
   - Buyer TIN (if B2B) or "Cash Sale"
   - Item descriptions with HS codes
   - Tax breakdown (VAT 16%, Exempt, Zero-rated)
   - Sequential invoice number
   - Date and time
2. Sends to KRA VSCU endpoint for signing
3. Receives signed response with:
   - Internal Control Number (ICN)
   - Digital signature
   - QR code data
4. Stores signed invoice locally
5. Prints receipt with QR code

### 6B.3 Offline Queue
- If no internet: invoice saved as "pending submission"
- Background job retries every 5 minutes
- Visual indicator: "3 invoices pending KRA submission"
- Must submit within 48 hours (KRA requirement)
- Alert owner if queue is old

### 6B.4 Tax Categories
- Standard rated (16% VAT)
- Zero-rated (0%)
- Exempt
- Each product assigned a tax category
- Each product assigned an HS code (harmonized system)

### 6B.5 eTIMS Reports
- Daily submission summary
- Failed/pending submissions list
- Tax collected report (for filing)
- Monthly VAT return helper

### 6B.6 Receipt Format (KRA Compliant)
```
╔══════════════════════════════════╗
║     [Business Name]              ║
║     [Address]                    ║
║     KRA PIN: P00XXXXXXX         ║
║     eTIMS Serial: VSCU-XXXX     ║
╠══════════════════════════════════╣
║  INV: 000001    Date: 25/05/2026║
║──────────────────────────────────║
║  Item          Qty   Price  Tax  ║
║  Panadol 500mg  2    100   16%  ║
║  Amoxicillin    1    250   16%  ║
║──────────────────────────────────║
║  Subtotal:              350.00   ║
║  VAT (16%):              56.00   ║
║  TOTAL:                 406.00   ║
║──────────────────────────────────║
║  Payment: Cash                   ║
║  Internal Control No: XXXXXXXX   ║
║  [QR CODE]                       ║
║  Verify: etims.kra.go.ke        ║
╚══════════════════════════════════╝
```

## Done When
- Every sale generates a KRA-compliant invoice
- QR code prints on receipt
- Offline queue works and submits when online
- Tax reports generate correctly
- Setup wizard connects to KRA successfully

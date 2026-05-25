# Phase 6 — Payments Integration (Paystack + M-Pesa)

## Goals
- Integrate Paystack for M-Pesa STK push
- Automated payment confirmation
- Fallback to manual recording when offline
- Payment reconciliation

## Architecture

```
Customer pays M-Pesa → Paystack handles STK push → 
Paystack confirms → SokoOS marks sale as paid
```

**Internet required** for automated M-Pesa. Cash sales always work offline.

## Tasks

### 6.1 Paystack Account Linking
Settings → Payments → Paystack Integration:
- Owner enters Paystack API keys (public + secret)
- System validates keys
- Keys stored encrypted in local DB
- Connection status indicator in POS

### 6.2 Payment Flow (Online — Paystack M-Pesa)
1. Cashier selects "M-Pesa" payment method
2. Customer phone number entered (or pulled from customer record)
3. System calls Paystack charge API (`mobile_money` channel, provider `mpesa`)
4. Paystack triggers STK push to customer's phone
5. Customer enters PIN on their phone
6. System polls Paystack for confirmation (or receives webhook if server mode)
7. On success: sale marked paid, Paystack reference stored
8. On failure/timeout: offer manual fallback

### 6.3 Payment Flow (Offline Fallback)
1. Cashier selects "M-Pesa (Manual)"
2. Customer pays to business till number directly
3. Cashier enters M-Pesa transaction code (e.g., "SLK7A9B2C1")
4. Sale marked as paid with manual reference
5. Later reconciliation matches manual entries against Paystack dashboard

### 6.4 Payment Reconciliation
- Daily reconciliation screen
- Compare recorded M-Pesa transactions against actual receipts
- Flag mismatches
- Mark unmatched payments

### 6.5 Paystack Setup Guide (for pharmacy owner)
The system includes an in-app guide:
1. Create Paystack account at paystack.com
2. Complete KYC verification
3. Add M-Pesa as payment channel
4. Copy API keys into SokoOS settings
5. Test with a small transaction

### 6.6 Database Schema (Payments Extension)
```sql
payment_providers (id, name, provider_key, config_encrypted, 
                   active, connected_at)
payment_transactions (id, payment_id, provider, provider_ref,
                      amount, currency, status, 
                      customer_phone, initiated_at, confirmed_at,
                      error_message)
```

## Done When
- Paystack keys can be configured in settings
- STK push triggers on customer's phone
- Payment confirms automatically
- Offline manual M-Pesa recording works
- Cash payments still work without internet
- Transaction references stored for reconciliation

# Phase 4 — Pharmacy Module (Dawa)

## Goals
- Pharmacy-specific extensions on top of core inventory/POS
- Prescription management
- Controlled substance tracking
- Supplier and purchase order management
- Pharmacy compliance features

## Tasks

### 4.1 Database Schema (Pharmacy Extensions)
```sql
-- Pharmacy product extensions
pharmacy_products (product_id, generic_name, brand_name, dosage_form,
                   strength, manufacturer, requires_prescription,
                   is_controlled, schedule_class, storage_conditions)

-- Prescriptions
prescriptions (id, patient_name, patient_phone, doctor_name,
               doctor_license, hospital, diagnosis, notes,
               dispensed_by, sale_id, created_at)
prescription_items (id, prescription_id, product_id, dosage,
                    frequency, duration, quantity_prescribed,
                    quantity_dispensed, substitution_allowed)

-- Suppliers
suppliers (id, name, contact_person, phone, email, address,
           payment_terms, notes, active, created_at)
purchase_orders (id, supplier_id, po_number, status, total_amount,
                 ordered_by, ordered_at, received_at, notes)
po_items (id, po_id, product_id, quantity_ordered, quantity_received,
          buying_price, batch_number, expiry_date)

-- Controlled substances log
controlled_log (id, product_id, batch_id, action, quantity,
                patient_name, prescription_id, balance_after,
                user_id, created_at)
```

### 4.2 Prescription Workflow
1. Customer presents prescription
2. Cashier creates prescription record (doctor, patient, diagnosis)
3. Adds prescribed items with dosage/frequency
4. System checks stock availability
5. Dispensing creates sale + links to prescription
6. Prescription stored for compliance records

### 4.3 Controlled Substances
- Flag products as controlled (Schedule classes)
- Mandatory prescription for controlled items
- Controlled substances register (log every movement)
- Cannot sell without prescription record
- Cannot adjust stock without manager approval + reason

### 4.4 Supplier Management (Pharmacy Extensions)
Suppliers are managed in Core (Phase 2). Pharmacy adds:
- Link suppliers to product categories (medicine suppliers vs general)
- Mandatory batch number + expiry on all pharmaceutical stock receives
- Cold chain flag on POs (temperature-sensitive deliveries)
- Regulatory certificate tracking per supplier

### 4.5 Pharmacy-Specific UI
- **Drug interaction warnings** (basic — flag if same patient buys conflicting drugs)
- **Dosage labels** — print small labels with patient name, dosage, frequency
- **Expiry-first dispensing** — FIFO enforcement, warn if dispensing newer batch
- **Prescription history** — search by patient name/phone

### 4.6 Pharmacy Compliance
- Daily controlled substances register (printable)
- Prescription records retention
- Batch traceability (which customer got which batch)
- Expiry destruction log

## Done When
- Prescription workflow works end-to-end
- Controlled substances cannot be sold without prescription
- Controlled log tracks every movement
- Suppliers can be managed with POs
- Stock receiving from PO creates correct batches
- FIFO dispensing enforced
- Dosage labels print correctly

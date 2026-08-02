const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pos-sale-nZJpkHao.js","assets/theme-bX0OAJwv.js","assets/theme-B6xQuM5r.css","assets/input-DLXg0fEG.js","assets/desktop-J23ks67K.js","assets/desktop-BAGnqGkc.css"])))=>i.map(i=>d[i]);
import{_ as R}from"./desktop-J23ks67K.js";import{fO as o,g8 as b,cg as p,cv as S}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";async function L(e){return o(`
    SELECT * FROM prescriptions
    ${e?"WHERE patient_name LIKE ?1 OR patient_phone LIKE ?1":""}
    ORDER BY created_at DESC LIMIT 100
  `,e?[`%${e}%`]:[])}async function I(e){const t=await o("SELECT * FROM prescriptions WHERE id = ?1",[e]);if(t.length===0)return null;const n=await o("SELECT * FROM prescription_items WHERE prescription_id = ?1",[e]);return{prescription:t[0],items:n}}async function O(){return await p("UPDATE sequences SET value = value + 1 WHERE name = 'rx_number'"),(await o("SELECT value FROM sequences WHERE name = 'rx_number'"))[0].value}function C(e){return`RX-${String(e).padStart(5,"0")}`}async function D(e,t){const n=crypto.randomUUID(),r=await O();await p(`INSERT INTO prescriptions (
       id, rx_number, customer_id, patient_name, patient_phone, patient_age,
       doctor_id, doctor_name, doctor_license, hospital, diagnosis, notes,
       dispensed_by, refills_authorized
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,[n,r,e.customer_id||null,e.patient_name,e.patient_phone||null,e.patient_age||null,e.doctor_id||null,e.doctor_name||null,e.doctor_license||null,e.hospital||null,e.diagnosis||null,e.notes||null,t,Math.max(0,e.refills_authorized??0)]);for(const a of e.items)await p(`INSERT INTO prescription_items (id, prescription_id, product_id, product_name, dosage, frequency, duration, quantity_prescribed, substitution_allowed, instructions)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,[crypto.randomUUID(),n,a.product_id,a.product_name,a.dosage,a.frequency,a.duration,a.quantity_prescribed,a.substitution_allowed,a.instructions||null]);return n}async function q(e,t){await p("UPDATE prescriptions SET status = 'dispensed', sale_id = ?1 WHERE id = ?2",[t,e]),await p("UPDATE prescription_items SET quantity_dispensed = quantity_prescribed WHERE prescription_id = ?1",[e])}async function F(e){const t=await o("SELECT * FROM prescriptions WHERE id = ?1",[e]);if(t.length===0)return null;const n=t[0];if(n.status==="dispensed")return null;const r=await o("SELECT * FROM prescription_items WHERE prescription_id = ?1",[e]);if(r.length===0)return null;const a=r.map(i=>({id:crypto.randomUUID(),product_id:i.product_id,name:i.product_name,quantity:i.quantity_prescribed,unit_price:0,discount:0,tax_rate:0,total:0})),s=[...new Set(r.map(i=>i.product_id))],l=s.map(()=>"?").join(","),E=await o(`SELECT p.id,
            COALESCE(pp.selling_price, 0) AS selling_price,
            COALESCE(p.tax_rate, 0)      AS tax_rate
       FROM products p
       LEFT JOIN product_prices pp
         ON pp.product_id = p.id AND pp.price_list_id = 'default'
      WHERE p.id IN (${l})`,s),_=new Map(E.map(i=>[i.id,i]));for(const i of a){const d=_.get(i.product_id);d&&(i.unit_price=d.selling_price,i.tax_rate=d.tax_rate),i.total=i.unit_price*i.quantity-i.discount}const c=await o(`SELECT p.id AS product_id,
            p.name AS product_name,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry,
            b.batch_number
       FROM batches b
       JOIN stockable_products p ON p.id = b.product_id
      WHERE b.product_id IN (${l})
        AND b.quantity > 0
        AND b.branch_id = ?${s.length+1}
        AND b.expiry_date IS NOT NULL
        AND julianday(b.expiry_date) - julianday('now') <= 30
      ORDER BY b.expiry_date ASC`,[...s,b()]),{checkInteractions:u}=await R(async()=>{const{checkInteractions:i}=await import("./pos-sale-nZJpkHao.js").then(d=>d.dK);return{checkInteractions:i}},__vite__mapDeps([0,1,2,3,4,5])),h=await u(s);let g=[];if(n.customer_id){const{checkDrugAllergies:i}=await R(async()=>{const{checkDrugAllergies:d}=await import("./pos-sale-nZJpkHao.js").then(m=>m.b8);return{checkDrugAllergies:d}},__vite__mapDeps([0,1,2,3,4,5]));g=await i(n.customer_id,s)}const y=await o(`SELECT p.id AS product_id, p.name AS product_name
       FROM pharmacy_products pp
       JOIN products p ON p.id = pp.product_id
      WHERE pp.product_id IN (${l})
        AND pp.cold_chain = 1`,s),f=[];if(y.length>0){const i=await o(`SELECT u.name AS unit_name, l.reading_at, l.temperature_c
         FROM cold_chain_logs l
         JOIN cold_chain_units u ON u.id = l.unit_id
        WHERE l.in_range = 0
          AND julianday('now') - julianday(l.reading_at) <= 1
          AND u.active = 1 AND u.branch_id = ?1
        ORDER BY l.reading_at DESC`,[b()]),d=y.map(m=>m.product_name);for(const m of i)f.push({...m,affected_products:d})}return{items:a,prescriptionNumber:n.rx_number,patientName:n.patient_name,customerId:n.customer_id,expiringSoon:c,interactions:h,allergyAlerts:g,coldChainExcursions:f}}function M(e,t){if(!t)return e;const n=[];return t.generic_name&&t.brand_name?n.push(`${t.generic_name} (${t.brand_name})`):t.brand_name?n.push(t.brand_name):t.generic_name?n.push(t.generic_name):n.push(e),t.strength&&n.push(t.strength),t.dosage_form&&n.push(t.dosage_form),n.join(" ")}async function W(e){return(await o("SELECT * FROM pharmacy_products WHERE product_id = ?1",[e]))[0]||null}async function H(e){await p(`INSERT INTO pharmacy_products (product_id, generic_name, brand_name, dosage_form, strength, manufacturer, requires_prescription, is_controlled, schedule_class, storage_conditions, cold_chain)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT(product_id) DO UPDATE SET
       generic_name = excluded.generic_name,
       brand_name = excluded.brand_name,
       dosage_form = excluded.dosage_form,
       strength = excluded.strength,
       manufacturer = excluded.manufacturer,
       requires_prescription = excluded.requires_prescription,
       is_controlled = excluded.is_controlled,
       schedule_class = excluded.schedule_class,
       storage_conditions = excluded.storage_conditions,
       cold_chain = excluded.cold_chain`,[e.product_id,e.generic_name,e.brand_name,e.dosage_form,e.strength,e.manufacturer,e.requires_prescription,e.is_controlled,e.schedule_class,e.storage_conditions,e.cold_chain])}async function P(e=90){return o(`SELECT 
       p.id as product_id, 
       p.name as product_name,
       b.id as batch_id,
       COALESCE(b.batch_number, '—') as batch_number,
       b.quantity,
       b.expiry_date,
       CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_to_expiry,
       COALESCE(pp.is_controlled, 0) as is_controlled
     FROM batches b
     JOIN stockable_products p ON p.id = b.product_id
     LEFT JOIN pharmacy_products pp ON pp.product_id = p.id
     WHERE b.expiry_date IS NOT NULL 
       AND b.quantity > 0
       AND b.branch_id = ?2
       AND julianday(b.expiry_date) - julianday('now') <= ?1
     ORDER BY b.expiry_date ASC
     LIMIT 500`,[e,b()])}async function U(e){const t=S();if(!t)return[];const n=[t],r=e?"AND cl.product_id = ?2":"";return e&&n.push(e),o(`SELECT cl.id, cl.product_name, cl.action, cl.quantity, cl.patient_name, cl.balance_after, cl.created_at
     FROM controlled_log cl
     LEFT JOIN batches b ON b.id = cl.batch_id
     LEFT JOIN prescriptions rx ON rx.id = cl.prescription_id
     LEFT JOIN sales s ON s.id = rx.sale_id
     WHERE (b.branch_id = ?1 OR s.branch_id = ?1) ${r}
     ORDER BY cl.created_at DESC LIMIT 100`,n)}async function N(e){if(e.length===0)return new Map;const t=e.map((r,a)=>`?${a+1}`).join(","),n=await o(`SELECT product_id, requires_prescription, is_controlled, cold_chain,
            generic_name, brand_name, strength
       FROM pharmacy_products
      WHERE product_id IN (${t})`,e);return new Map(n.map(r=>[r.product_id,{requires_prescription:r.requires_prescription,is_controlled:r.is_controlled,cold_chain:r.cold_chain,generic_name:r.generic_name,brand_name:r.brand_name,strength:r.strength}]))}async function $(e,t,n,r,a){const s=[...new Set(n.map(c=>c.product_id))];if(s.length===0)return;const l=await N(s),E=n.filter(c=>l.get(c.product_id)?.is_controlled===1);if(E.length===0)return;let _=null;if(a){const c=await o(`SELECT patient_name, customer_id, doctor_name, rx_number
         FROM prescriptions WHERE id = ?1`,[a]);if(c[0]){let u=null;c[0].customer_id&&(u=(await o("SELECT national_id FROM customers WHERE id = ?1",[c[0].customer_id]).catch(()=>[]))[0]?.national_id??null),_={patient_name:c[0].patient_name,patient_id_number:u,prescribed_by:c[0].doctor_name,prescription_number:`RX-${c[0].rx_number}`}}}for(const c of E){const[u]=await o("SELECT COALESCE(SUM(quantity), 0) AS balance FROM batches WHERE product_id = ?1 AND branch_id = ?2",[c.product_id,b()]);await p(`INSERT INTO controlled_log (
         id, product_id, product_name, action, quantity,
         patient_name, patient_id_number, prescribed_by, prescription_number,
         prescription_id, balance_after, user_id, notes
       ) VALUES (?1, ?2, ?3, 'dispensed', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,[crypto.randomUUID(),c.product_id,c.product_name,c.quantity,_?.patient_name??"Walk-in",_?.patient_id_number??null,_?.prescribed_by??null,_?.prescription_number??null,a,u?.balance??0,r,`Auto from sale #${t}`])}}export{$ as autoPostControlledLog,D as createPrescription,q as dispensePrescription,M as formatPharmacyDisplay,C as formatRxNumber,U as getControlledLog,P as getExpiringItems,O as getNextRxNumber,N as getPharmacyFlags,W as getPharmacyProduct,I as getPrescription,L as getPrescriptions,F as preparePrescriptionForPosCheckout,H as upsertPharmacyProduct};

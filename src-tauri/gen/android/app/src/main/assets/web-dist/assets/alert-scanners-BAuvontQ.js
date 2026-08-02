import{fO as t,g8 as r}from"./pos-sale-nZJpkHao.js";import{e as i}from"./DesktopApp-Rj-KEhSo.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";import"./omnix-logo-8ESxnthN.js";import"./local-licenses-C6TbAU57.js";import"./entitlements-TKjDh5Q8.js";import"./units-DFwgHPNe.js";import"./pharmacy-BZw2z-Gh.js";import"./business-profile-0WoqpRY7.js";import"./recurring-invoicing-VsYbZWvC.js";import"./gl-D5tm0wQV.js";import"./banking-CopCsOdh.js";import"./etims-B0_Nb-w1.js";import"./salon-7MC909bV.js";const d=30,c=1;async function _(){const a=await t(`SELECT b.id AS batch_id, p.sku, p.name AS product_name, b.expiry_date,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_left
     FROM batches b
     JOIN stockable_products p ON p.id = b.product_id
     WHERE b.expiry_date IS NOT NULL
       AND b.quantity > 0
       AND b.branch_id = ?2
       AND julianday(b.expiry_date) - julianday('now') BETWEEN 0 AND ?1
     ORDER BY b.expiry_date ASC
     LIMIT 50`,[d,r()]);for(const e of a)await i({kind:"expiry",severity:e.days_left<7?"critical":"warning",title:`${e.product_name} expires in ${e.days_left} day${e.days_left===1?"":"s"}`,body:`Batch on shelf. Consider discount or write-off before ${new Date(e.expiry_date).toLocaleDateString()}.`,link:"/pharmacy/expiry",dedupeKey:`expiry:${e.batch_id}`,metadata:{batch_id:e.batch_id,sku:e.sku}})}async function l(){const a=await t(`SELECT p.id AS product_id, p.sku, p.name, COALESCE(p.reorder_level, 0) AS reorder_level,
            COALESCE(SUM(b.quantity), 0) AS qty
     FROM stockable_products p
     LEFT JOIN batches b ON b.product_id = p.id AND b.branch_id = ?2
     WHERE COALESCE(p.active, 1) = 1
     GROUP BY p.id
     HAVING qty <= 0
        OR (p.reorder_level IS NOT NULL AND p.reorder_level > 0 AND qty <= p.reorder_level * ?1)
     ORDER BY qty ASC
     LIMIT 50`,[c,r()]);for(const e of a)await i({kind:"low_stock",severity:e.qty<=0?"critical":"warning",title:e.qty<=0?`${e.name} — out of stock`:`${e.name} — running low (${e.qty} left)`,body:e.reorder_level>0?`Reorder level is ${e.reorder_level}. Consider creating a purchase order.`:"Stock has run out. Consider creating a purchase order.",link:"/inventory",dedupeKey:`low_stock:${e.product_id}`,metadata:{product_id:e.product_id,sku:e.sku,qty:e.qty,reorder_level:e.reorder_level}})}async function p(){const a=await t(`SELECT i.id, i.invoice_number, i.customer_name,
            (i.total_amount - i.paid_amount) AS total,
            CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue
     FROM invoices i
     WHERE i.branch_id = ?1 AND i.status IN ('sent', 'partial')
       AND i.due_date < date('now')
       AND (i.total_amount - i.paid_amount) > 0
     ORDER BY i.due_date ASC
     LIMIT 20`,[r()]);for(const e of a)await i({kind:"unpaid_invoice",severity:e.days_overdue>30?"critical":"warning",title:`Invoice ${e.invoice_number} is ${e.days_overdue} day${e.days_overdue===1?"":"s"} overdue`,body:`${e.customer_name} — outstanding ${e.total.toLocaleString()}. Consider a follow-up call.`,link:`/invoicing/invoice/${e.id}`,dedupeKey:`unpaid_invoice:${e.id}`,metadata:{invoice_id:e.id,amount:e.total}})}async function o(a){return((await t("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?1",[a]).catch(()=>[{n:0}]))[0]?.n??0)>0}async function u(){if(!await o("refill_reminders"))return;const a=await t(`SELECT rr.id, rr.patient_name, rr.drug_summary, rr.due_on
     FROM refill_reminders rr
     JOIN prescriptions p ON p.id = rr.prescription_id
     JOIN sales sale ON sale.id = p.sale_id
     WHERE rr.sent_at IS NULL AND sale.branch_id = ?1 AND date(due_on) <= date('now', '+3 days')
     ORDER BY due_on ASC
     LIMIT 30`,[r()]).catch(()=>[]);for(const e of a)await i({kind:"refill_due",severity:"info",title:`Refill due: ${e.drug_summary}`,body:`${e.patient_name} — due ${new Date(e.due_on).toLocaleDateString()}. Send a reminder?`,link:"/pharmacy/refills",dedupeKey:`refill_due:${e.id}`})}async function y(){if(!await o("pharmacy_licenses"))return;const a=await t(`SELECT id, license_type, license_number, expires_at,
            CAST(julianday(expires_at) - julianday('now') AS INTEGER) AS days_left
     FROM pharmacy_licenses
     WHERE status != 'renewed'
       AND julianday(expires_at) - julianday('now') <= 60
     ORDER BY expires_at ASC
     LIMIT 20`,[r()]).catch(()=>[]);for(const e of a){const n=e.days_left<0;await i({kind:"license_expiry",severity:n||e.days_left<=14?"critical":"warning",title:n?`${s(e.license_type)} EXPIRED`:`${s(e.license_type)} expires in ${e.days_left} day${e.days_left===1?"":"s"}`,body:`Licence ${e.license_number}. Renew before ${new Date(e.expires_at).toLocaleDateString()} to avoid a PPB compliance finding.`,link:"/settings/pharmacy-licenses",dedupeKey:`license_expiry:${e.id}:${n?"expired":"soon"}`,metadata:{license_id:e.id}})}}function s(a){return{premises:"Premises registration",pharmacist:"Pharmacist practising licence",ppb_annual:"PPB annual retention",superintendent:"Superintendent attachment",controlled_permit:"Controlled-substances permit",other:"Licence"}[a]??"Licence"}async function m(){if(!await o("cold_chain_analyses"))return;const a=await t(`SELECT a.id, a.root_cause, a.peak_temperature_c, a.excursion_start
     FROM cold_chain_analyses a
     JOIN cold_chain_units u ON u.id = a.unit_id
     WHERE a.reviewed_at IS NULL AND u.branch_id = ?1
     ORDER BY excursion_start DESC
     LIMIT 20`).catch(()=>[]);for(const e of a)await i({kind:"cold_chain",severity:"critical",title:`Cold-chain excursion — peak ${e.peak_temperature_c.toFixed(1)}°C`,body:`Likely cause: ${e.root_cause.replace(/_/g," ")}. Review + confirm affected stock before dispensing.`,link:"/pharmacy/cold-chain",dedupeKey:`cold_chain:${e.id}`,metadata:{analysis_id:e.id}})}async function f(){if(!await o("equipment_units"))return;const a=await t(`SELECT u.id, u.serial_number, p.name AS product_name, c.name AS customer_name,
            u.warranty_expiry,
            CAST(julianday(u.warranty_expiry) - julianday('now') AS INTEGER) AS days_left
     FROM equipment_units u
     JOIN products p ON p.id = u.product_id
     LEFT JOIN customers c ON c.id = u.customer_id
     WHERE u.branch_id = ?1 AND u.warranty_expiry IS NOT NULL
       AND u.status IN ('sold','in_service','rented')
       AND julianday(u.warranty_expiry) - julianday('now') <= 30
     ORDER BY u.warranty_expiry ASC
     LIMIT 30`,[r()]).catch(()=>[]);for(const e of a){const n=e.days_left<0;await i({kind:"warranty_expiry",severity:n||e.days_left<=7?"warning":"info",title:n?`Warranty expired — ${e.product_name} (SN ${e.serial_number})`:`Warranty expires in ${e.days_left} day${e.days_left===1?"":"s"} — ${e.product_name}`,body:`Serial ${e.serial_number}${e.customer_name?` · ${e.customer_name}`:""}. Cover ends ${new Date(e.warranty_expiry).toLocaleDateString()}.`,link:"/hardware/fleet",dedupeKey:`warranty_expiry:${e.id}:${n?"expired":"soon"}`,metadata:{unit_id:e.id}})}}async function w(){if(!await o("salon_appointments"))return;const a=await t(`SELECT a.id, a.appt_number, c.name AS client_name, s.display_name AS staff_name, a.starts_at
     FROM salon_appointments a
     LEFT JOIN customers c ON c.id = a.client_id
     LEFT JOIN salon_staff s ON s.id = a.staff_id
     WHERE a.branch_id = ?1 AND a.status IN ('booked','confirmed')
       AND a.starts_at >= datetime('now') AND a.starts_at <= datetime('now', '+1 day')
     ORDER BY a.starts_at ASC LIMIT 50`,[r()]).catch(()=>[]);for(const e of a)await i({kind:"appointment_reminder",severity:"info",title:`Upcoming: ${e.client_name??"Walk-in"} at ${new Date(e.starts_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`,body:`${e.appt_number}${e.staff_name?` · ${e.staff_name}`:""} · ${new Date(e.starts_at).toLocaleDateString()}`,link:"/salon",dedupeKey:`appt_reminder:${e.id}`,metadata:{appointment_id:e.id}})}async function T(){await Promise.allSettled([_(),l(),p(),u(),y(),m(),f(),w()])}export{T as runAllScanners};

import{fO as n,g8 as _,cg as l}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";async function N(d=3){const p=await n(`SELECT p.id, p.rx_number, p.patient_name, p.patient_phone,
            p.refills_authorized, p.refills_used, p.created_at,
            (SELECT MIN(CAST(REPLACE(pi.duration, ' days', '') AS INTEGER))
               FROM prescription_items pi WHERE pi.prescription_id = p.id) AS duration_days
       FROM prescriptions p
      WHERE p.status = 'dispensed'
        AND p.sale_id IN (SELECT id FROM sales WHERE branch_id = ?1)
        AND p.refills_used < p.refills_authorized
        AND p.patient_phone IS NOT NULL`,[_()]);let r=0,t=0;for(const e of p){if(!e.duration_days||e.duration_days<=0){t++;continue}const c=new Date(e.created_at),a=new Date(c.getTime()+e.duration_days*864e5),s=Math.floor((a.getTime()-Date.now())/864e5);if(s<0||s>d){t++;continue}const[o]=await n(`SELECT COUNT(*) AS count FROM refill_reminders
        WHERE prescription_id = ?1
          AND julianday('now') - julianday(queued_at) < 7`,[e.id]).catch(()=>[{count:0}]);if(o?.count&&o.count>0){t++;continue}const i=await n("SELECT product_name FROM prescription_items WHERE prescription_id = ?1 LIMIT 3",[e.id]),u=i[0]?i.length>1?`${i[0].product_name} + ${i.length-1} more`:i[0].product_name:"your prescription";await l(`INSERT INTO refill_reminders
         (id, prescription_id, rx_number, patient_name, patient_phone, drug_summary, refills_remaining, due_on)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT DO NOTHING`,[crypto.randomUUID(),e.id,e.rx_number,e.patient_name,e.patient_phone,u,e.refills_authorized-e.refills_used,a.toISOString().slice(0,10)]).catch(()=>{}),r++}return{queued:r,skipped:t}}async function S(){return n("SELECT * FROM refill_reminders WHERE sent_at IS NULL ORDER BY due_on ASC").catch(()=>[])}export{S as listPendingReminders,N as queueRefillReminders};

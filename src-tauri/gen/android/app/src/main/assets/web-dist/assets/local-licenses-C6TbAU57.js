const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pos-sale-nZJpkHao.js","assets/theme-bX0OAJwv.js","assets/theme-B6xQuM5r.css","assets/input-DLXg0fEG.js","assets/desktop-J23ks67K.js","assets/desktop-BAGnqGkc.css"])))=>i.map(i=>d[i]);
import{_ as y}from"./desktop-J23ks67K.js";import{fO as l,cg as c,ck as u}from"./pos-sale-nZJpkHao.js";import{V as E}from"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";const v="https://omnix.co.ke/api/licensing/sync",f="https://omnix.co.ke/api/licensing/activate";async function d(){return l("SELECT * FROM local_licenses ORDER BY activated_at DESC")}async function _(){return(await l("SELECT value FROM settings WHERE key = 'local_licenses.active_key'"))[0]?.value||null}async function m(n){await c(`INSERT INTO settings (key, value, category)
     VALUES ('local_licenses.active_key', ?1, 'licensing')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,[n]);const e=(await l(`SELECT variant, modules, max_machines, max_branches, tier, status,
            trial_ends_at, maintenance_until, auth_token
     FROM local_licenses WHERE license_key = ?1 LIMIT 1`,[n]))[0];if(!e)return;try{const{getMachineInfo:t}=await y(async()=>{const{getMachineInfo:o}=await import("./pos-sale-nZJpkHao.js").then(w=>w.e8);return{getMachineInfo:o}},__vite__mapDeps([0,1,2,3,4,5])),r=await t(),a=e.modules??JSON.stringify([e.variant]);await c(`INSERT OR REPLACE INTO license
        (id, license_key, license_kid, customer_name, customer_email, issued_at,
         maintenance_expires_at, license_type, features_json, modules_json, max_devices,
         activation_token, server_validated, last_server_check_at,
         machine_fingerprint, activated_at, last_verified_at)
       VALUES ('active', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'), datetime('now'))`,[n,n,"","",new Date().toISOString(),e.maintenance_until??e.trial_ends_at??new Date(Date.now()+720*60*60*1e3).toISOString(),e.tier==="trial"?"trial":"perpetual",JSON.stringify([]),a,e.max_machines||1,e.auth_token??null,1,new Date().toISOString(),r.fingerprint])}catch(t){console.warn("[setActiveLicenseKey] singleton sync failed:",t)}const i=e.variant==="pro"||e.variant==="dawa"?"dawa":e.variant==="retail"?"retail":e.variant==="hardware"?"hardware":e.variant==="hospitality"?"hospitality":"dawa";await c(`INSERT INTO settings (key, value, category)
     VALUES ('app.active_module', ?1, 'app')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,[i])}async function O(){const n=await _();return n?(await l("SELECT * FROM local_licenses WHERE license_key = ?1 LIMIT 1",[n]))[0]??null:(await d())[0]??null}async function S(n,s){const i=(await d()).map(a=>a.license_key);if(i.length===0)return[];const t=await u(v,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:n,machineId:s,keys:i})});if(!t.ok)throw new Error(`Sync failed: ${t.status} ${t.statusText}`);const r=await t.json();if(!r.ok)throw new Error("Sync returned ok=false");for(const a of r.results){const o=a.message??null;a.status==="verified"&&a.license?await c(`UPDATE local_licenses SET
            license_id = ?1,
            variant = ?2,
            tier = ?3,
            status = ?4,
            modules = ?5,
            max_machines = ?6,
            max_branches = ?7,
            trial_ends_at = ?8,
            maintenance_until = ?9,
            sync_status = 'verified',
            sync_message = NULL,
            last_synced_at = datetime('now'),
            last_verified_at = datetime('now')
          WHERE license_key = ?10`,[a.license.id,a.license.variant,a.license.tier,a.license.status,JSON.stringify(a.license.modules),a.license.maxMachines,a.license.maxBranches,a.license.trialEndsAt,a.license.maintenanceUntil,a.key]):await c(`UPDATE local_licenses SET
            sync_status = ?1,
            sync_message = ?2,
            last_synced_at = datetime('now')
          WHERE license_key = ?3`,[a.status,o,a.key])}return r.results}async function x(n){const s={...n,variant:n.variant??E},e=await u(f,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(s)}),i=await e.json();if(!e.ok||!i.ok)return{ok:!1,code:i.code,error:i.error??`HTTP ${e.status}`};const t=i.entitlements;return await c(`INSERT INTO local_licenses (
        license_key, variant, tier, status, modules,
        max_machines, max_branches, auth_token,
        trial_ends_at, maintenance_until,
        sync_status, last_synced_at, last_verified_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'verified', datetime('now'), datetime('now'))
      ON CONFLICT(license_key) DO UPDATE SET
        variant = excluded.variant,
        tier = excluded.tier,
        status = excluded.status,
        modules = excluded.modules,
        max_machines = excluded.max_machines,
        max_branches = excluded.max_branches,
        auth_token = excluded.auth_token,
        trial_ends_at = excluded.trial_ends_at,
        maintenance_until = excluded.maintenance_until,
        sync_status = 'verified',
        last_synced_at = datetime('now'),
        last_verified_at = datetime('now')`,[t.licenseKey,t.variant,t.status==="trial"?"trial":t.variant==="pro"?"business":"starter",t.status,JSON.stringify(t.modules),t.maxDevices,t.maxBranches,i.authToken??null,t.trialEndsAt,t.maintenanceUntil]),await _()||await m(t.licenseKey),{ok:!0,license:(await l("SELECT * FROM local_licenses WHERE license_key = ?1",[t.licenseKey]))[0]}}async function g(n){if(await c("DELETE FROM local_licenses WHERE license_key = ?1",[n]),await _()===n){const e=await d();await m(e[0]?.license_key??"")}}function L(n){const s={pro:"Pro (all trades)",dawa:"Dawa",retail:"Retail",hospitality:"Hospitality",hardware:"Hardware"};return[...new Set(n)].sort().map(i=>s[i]).join(" + ")}export{x as activateLicense,L as describeOwnedVariants,O as getActiveLicense,_ as getActiveLicenseKey,d as listLocalLicenses,g as removeLocalLicense,m as setActiveLicenseKey,S as syncLicenses};

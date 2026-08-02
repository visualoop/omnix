import{fO as n,cg as e}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";const s="maintenance.last_run",c=1200*60*1e3,i=90;async function u(t){try{return(await n("SELECT value FROM settings WHERE key = ?1",[t]))[0]?.value??null}catch{return null}}async function d(t,a){await e(`INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = ?2`,[t,a]).catch(()=>{})}async function o(t=7){await e(`INSERT INTO sales_daily (day, sales_count, gross, discount, tax, items_count, updated_at)
     SELECT
       date(s.created_at)                                   AS day,
       COUNT(DISTINCT s.id)                                 AS sales_count,
       COALESCE(SUM(s.total), 0)                            AS gross,
       COALESCE(SUM(s.discount_amount), 0)                  AS discount,
       COALESCE(SUM(s.tax_amount), 0)                       AS tax,
       COALESCE((SELECT COUNT(*) FROM sale_items si
                 JOIN sales s2 ON s2.id = si.sale_id
                 WHERE date(s2.created_at) = date(s.created_at)
                   AND s2.status = 'completed'), 0)         AS items_count,
       datetime('now')                                      AS updated_at
     FROM sales s
     WHERE s.status = 'completed'
       AND s.created_at >= datetime('now', ?1)
     GROUP BY date(s.created_at)
     ON CONFLICT(day) DO UPDATE SET
       sales_count = excluded.sales_count,
       gross       = excluded.gross,
       discount    = excluded.discount,
       tax         = excluded.tax,
       items_count = excluded.items_count,
       updated_at  = excluded.updated_at`,[`-${t} days`]).catch(()=>{})}async function l(){await e("DELETE FROM ai_calls WHERE created_at < datetime('now', ?1)",[`-${i} days`]).catch(()=>{})}async function E(){await e("PRAGMA optimize;").catch(()=>{}),await e("PRAGMA incremental_vacuum(1000);").catch(()=>{})}async function O(){const t=await u(s);if(t){const a=Date.now()-new Date(t).getTime();if(Number.isFinite(a)&&a<c)return}await o(7),await l(),await E(),await d(s,new Date().toISOString())}export{E as optimizeDb,l as pruneChurn,o as rollUpSales,O as runMaintenanceIfDue};

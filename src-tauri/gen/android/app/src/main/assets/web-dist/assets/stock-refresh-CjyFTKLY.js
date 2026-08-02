import{cv as i,fO as p}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";async function m(o){if(o.length===0)return new Map;const r=i();if(!r)return new Map(o.map(t=>[t,0]));const c=o.map((t,e)=>`?${e+1}`).join(","),a=await p(`SELECT b.product_id, COALESCE(SUM(b.quantity), 0) AS stock_qty
     FROM batches b
     JOIN stockable_products p ON p.id = b.product_id
     WHERE b.product_id IN (${c}) AND b.branch_id = ?${o.length+1}
     GROUP BY b.product_id`,[...o,r]),n=new Map;for(const t of o)n.set(t,0);for(const t of a)n.set(t.product_id,t.stock_qty);return n}export{m as getStockMap};

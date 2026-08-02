import{fO as n}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";function t(c){if(c==null)return"";const r=String(c);return r.includes(",")||r.includes('"')||r.includes(`
`)||r.includes("\r")?`"${r.replace(/"/g,'""')}"`:r}function p(c){const i=[["name","sku","barcode","category","unit","buying_price","selling_price","tax_rate","reorder_level","stock_qty","active"].join(",")];for(const e of c)i.push([t(e.name),t(e.sku),t(e.barcode),t(e.category),t(e.unit),t(e.buying_price),t(e.selling_price),t(e.tax_rate),t(e.reorder_level),t(e.stock_qty),t(e.active)].join(","));return i.join(`
`)}async function l(){const c=await n(`SELECT
       p.name,
       p.sku,
       p.barcode,
       c.name AS category,
       p.unit,
       COALESCE(pp.buying_price, 0) AS buying_price,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE(p.tax_rate, 0) AS tax_rate,
       COALESCE(p.reorder_level, 0) AS reorder_level,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
       p.active
     FROM stockable_products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE p.active = 1
     ORDER BY p.name`),r=p(c),i=`omnix-products-${new Date().toISOString().slice(0,10)}.csv`,e=new Blob([`\uFEFF${r}`],{type:"text/csv;charset=utf-8;"}),o=document.createElement("a");return o.href=URL.createObjectURL(e),o.download=i,document.body.appendChild(o),o.click(),setTimeout(()=>{URL.revokeObjectURL(o.href),o.remove()},100),{rowCount:c.length}}export{l as exportProductsCsv};

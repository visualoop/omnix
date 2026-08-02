import{fO as r,cv as E}from"./pos-sale-nZJpkHao.js";import"./theme-bX0OAJwv.js";import"./input-DLXg0fEG.js";import"./desktop-J23ks67K.js";function s(t){const a=E(),n=[a?"branch_id = ?1":"1 = 0"],e=a?[a]:[];return t?.startDate&&(e.push(t.startDate),n.push(`transaction_date >= ?${e.length}`)),t?.endDate&&(e.push(t.endDate),n.push(`transaction_date <= ?${e.length}`)),t?.accountId&&(e.push(t.accountId),n.push(`account_id = ?${e.length}`)),{where:`WHERE ${n.join(" AND ")}`,params:e}}async function _(t){const a=s(t);return r(`SELECT transaction_date AS day,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount
                         WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN -amount ELSE 0 END), 0) AS net
     FROM bank_transactions ${a.where}
     GROUP BY transaction_date ORDER BY transaction_date`,a.params)}async function S(t){const a=s(t);return r(`SELECT CASE
       WHEN related_sale_id IS NOT NULL THEN 'POS Sales'
       WHEN related_invoice_payment_id IS NOT NULL THEN 'Invoice Payments'
       WHEN related_customer_payment_id IS NOT NULL THEN 'Customer Payments'
       WHEN related_supplier_payment_id IS NOT NULL THEN 'Supplier Payments'
       WHEN related_expense_id IS NOT NULL THEN 'Expenses'
       WHEN transaction_type LIKE 'transfer%' THEN 'Inter-account Transfers'
       WHEN transaction_type = 'fee' THEN 'Bank Fees'
       WHEN transaction_type = 'interest' THEN 'Interest'
       ELSE 'Manual / Other' END AS source,
       COALESCE(SUM(CASE WHEN transaction_type IN ('deposit','transfer_in','interest') THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN transaction_type IN ('withdrawal','transfer_out','fee') THEN amount ELSE 0 END), 0) AS cash_out,
       COUNT(*) AS count
     FROM bank_transactions ${a.where}
     GROUP BY source ORDER BY (cash_in + cash_out) DESC`,a.params)}export{S as getCashflowBySource,_ as getCashflowDaily};

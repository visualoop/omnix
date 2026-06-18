import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Banknote, ArrowLeft, Plus, Upload, Loader2, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Trash2, Check, AlertCircle, Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  getBankAccount, listTransactions, recordTransaction, recordTransfer,
  deleteTransaction, unreconcile, getReconciliationSummary,
  listBankAccounts, createStatementImport, parseStatementCsv,
  listStatementImports, getStatementImport, matchStatementLine, createTransactionFromLine,
  type BankAccount, type BankTransactionWithAccount, type ReconciliationSummary,
  type BankTxType, type StatementImport, type StatementLine,
} from "@/services/banking";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";


export function BankAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransactionWithAccount[]>([]);
  const [recon, setRecon] = useState<ReconciliationSummary | null>(null);
  const [imports, setImports] = useState<StatementImport[]>([]);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [viewingImport, setViewingImport] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const [acc, txs, sum, imps] = await Promise.all([
      getBankAccount(id),
      listTransactions({ accountId: id, limit: 200 }),
      getReconciliationSummary(id),
      listStatementImports(id),
    ]);
    setAccount(acc);
    setTransactions(txs);
    setRecon(sum);
    setImports(imps);
  };
  useEffect(() => { load(); }, [id]);

  if (!account) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const removeTransaction = async (txId: string) => {
    if (!(await confirm({
      title: "Delete this transaction?",
      description: "Balance will be recomputed. Cannot be undone.",
      variant: "destructive",
    }))) return;
    await deleteTransaction(txId);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/banking")} className="mb-2 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Banking
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" /> {account.name}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {account.account_type === "bank" && account.bank_name ? `${account.bank_name} · ${account.account_number || ""}` :
               account.account_type === "mpesa_till" ? `M-Pesa Till ${account.account_number || ""}` :
               account.account_type === "mpesa_paybill" ? `M-Pesa Paybill ${account.account_number || ""}` :
               account.account_type}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Statement
            </Button>
            <Button variant="outline" onClick={() => setShowTransfer(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Transfer
            </Button>
            <Button onClick={() => setShowAddTx(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Transaction
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Current Balance" value={KES(account.current_balance)} highlight />
        <Stat label="Reconciled" value={recon ? KES(recon.reconciled_balance) : "—"} color="text-emerald-600" />
        <Stat label="Unreconciled In" value={recon ? KES(recon.unreconciled_in) : "—"} color="text-blue-600" />
        <Stat
          label="Unreconciled Out"
          value={recon ? KES(recon.unreconciled_out) : "—"}
          color="text-amber-600"
          hint={recon?.unreconciled_count ? `${recon.unreconciled_count} txn${recon.unreconciled_count !== 1 ? "s" : ""}` : undefined}
        />
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="imports">Statement Imports {imports.length > 0 && `(${imports.length})`}</TabsTrigger>
        </TabsList>

        <TabsPanel value="transactions" className="mt-3">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">In</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Out</th>
                  <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Recon</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} className="p-0">
                    <EmptyState
                      icon={Banknote}
                      title="No transactions"
                      description="Add a transaction or import a bank statement to get started."
                      cta={{ label: "Add Transaction", onClick: () => setShowAddTx(true), icon: Plus }}
                    />
                  </td></tr>
                ) : (
                  transactions.map((t) => {
                    const isIn = ["deposit", "transfer_in", "interest"].includes(t.transaction_type);
                    return (
                      <tr key={t.id} className="border-b border-border/60 hover:bg-accent/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(t.transaction_date).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            {isIn ? <ArrowDownLeft className="h-3 w-3 text-emerald-600" /> : <ArrowUpRight className="h-3 w-3 text-red-600" />}
                            <span>{t.description}</span>
                          </div>
                          {t.counterparty_name && (
                            <div className="text-[10px] text-muted-foreground ml-4.5">{t.counterparty_name}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{t.reference || "—"}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                          {isIn ? <span className="text-emerald-600">{t.amount.toFixed(2)}</span> : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                          {!isIn ? <span className="text-red-600">{t.amount.toFixed(2)}</span> : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {t.reconciled ? (
                            <button
                              onClick={async () => { await unreconcile(t.id); load(); }}
                              title="Click to un-reconcile"
                              className="inline-flex items-center"
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            </button>
                          ) : (
                            <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 inline-block" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!t.related_sale_id && !t.related_expense_id && !t.related_customer_payment_id &&
                           !t.related_supplier_payment_id && !t.related_invoice_payment_id && (
                            <Button variant="ghost" size="icon-xs" onClick={() => removeTransaction(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsPanel>

        <TabsPanel value="imports" className="mt-3">
          {imports.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Upload}
                  title="No statement imports"
                  description="Upload a bank statement CSV to auto-match transactions and reconcile."
                  cta={{ label: "Import Statement", onClick: () => setShowImport(true), icon: Upload }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                    <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Imported</th>
                    <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Lines</th>
                    <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Matched</th>
                    <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Unmatched</th>
                    <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Statement End</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                      onClick={() => setViewingImport(imp.id)}
                    >
                      <td className="px-3 py-2 text-xs">
                        {new Date(imp.period_start).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                        {" → "}
                        {new Date(imp.period_end).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(imp.created_at).toLocaleDateString("en-KE")}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{imp.line_count}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-600">{imp.matched_count}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        {imp.unmatched_count > 0 ? (
                          <span className="text-amber-600">{imp.unmatched_count}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                        {KES(imp.statement_ending_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsPanel>
      </Tabs>

      <NewTransactionDialog
        open={showAddTx}
        onClose={() => setShowAddTx(false)}
        onSaved={() => { setShowAddTx(false); load(); }}
        accountId={id!}
        userId={userId}
      />
      <TransferDialog
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSaved={() => { setShowTransfer(false); load(); }}
        currentAccount={account}
        userId={userId}
      />
      <ImportStatementDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setShowImport(false); load(); }}
        accountId={id!}
        userId={userId}
      />
      <StatementImportSheet
        importId={viewingImport}
        accountId={id!}
        userId={userId}
        onClose={() => setViewingImport(null)}
        onChange={load}
      />
    </div>
  );
}

function Stat({ label, value, color, highlight, hint }: { label: string; value: string; color?: string; highlight?: boolean; hint?: string }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold font-mono mt-1 ${color || ""}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function NewTransactionDialog({ open, onClose, onSaved, accountId, userId }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accountId: string;
  userId?: string;
}) {
  const [form, setForm] = useState({
    transaction_type: "deposit" as BankTxType,
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "",
    counterparty_name: "",
    payment_method: "cash",
    reference: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        transaction_type: "deposit",
        amount: 0,
        transaction_date: new Date().toISOString().slice(0, 10),
        description: "",
        counterparty_name: "",
        payment_method: "cash",
        reference: "",
      });
    }
  }, [open]);

  const save = async () => {
    if (!userId) return;
    if (!form.description) { toast.error("Description required"); return; }
    if (form.amount <= 0) { toast.error("Amount must be > 0"); return; }
    setSubmitting(true);
    try {
      await recordTransaction({
        account_id: accountId,
        user_id: userId,
        ...form,
      });
      toast.success("Transaction recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Type</label>
              <select
                value={form.transaction_type}
                onChange={(e) => setForm({ ...form, transaction_type: e.target.value as BankTxType })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="deposit">Deposit (money in)</option>
                <option value="withdrawal">Withdrawal (money out)</option>
                <option value="fee">Bank Fee / Charge</option>
                <option value="interest">Interest Earned</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Amount *</label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Description *</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., M-Pesa from John" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Counterparty</label>
              <Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="cheque">Cheque</option>
                <option value="wire">Wire Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reference</label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="M-Pesa code, cheque #..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ open, onClose, onSaved, currentAccount, userId }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentAccount: BankAccount;
  userId?: string;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      listBankAccounts(false).then(setAccounts);
      setAmount(0);
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setReference("");
      setToAccountId("");
    }
  }, [open]);

  const save = async () => {
    if (!userId) return;
    if (!toAccountId) { toast.error("Select destination account"); return; }
    if (amount <= 0) { toast.error("Amount must be > 0"); return; }
    if (amount > currentAccount.current_balance) {
      if (!(await confirm({
        title: "Amount exceeds balance",
        description: `Source account has only ${KES(currentAccount.current_balance)}. Continue anyway?`,
        variant: "warning",
      }))) return;
    }
    setSubmitting(true);
    try {
      await recordTransfer({
        from_account_id: currentAccount.id,
        to_account_id: toAccountId,
        amount,
        transaction_date: date,
        description: description || `Transfer from ${currentAccount.name}`,
        reference: reference || undefined,
        user_id: userId,
      });
      toast.success("Transfer recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inter-Account Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs bg-muted/30 rounded p-2">
            From: <b>{currentAccount.name}</b> · Balance {KES(currentAccount.current_balance)}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">To Account</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
            >
              <option value="">Select destination...</option>
              {accounts.filter((a) => a.id !== currentAccount.id).map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {KES(a.current_balance)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Amount</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reference</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, slip number..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportStatementDialog({ open, onClose, onImported, accountId, userId }: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  accountId: string;
  userId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedLines, setParsedLines] = useState<ReturnType<typeof parseStatementCsv>["lines"]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [startBalance, setStartBalance] = useState(0);
  const [endBalance, setEndBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setParsedLines([]);
      setFileName("");
      setDetectedFormat("");
    }
  }, [open]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseStatementCsv(text);
    setParsedLines(parsed.lines);
    setDetectedFormat(parsed.detected_format);
    if (parsed.lines.length > 0) {
      const dates = parsed.lines.map((l) => l.line_date).sort();
      setPeriodStart(dates[0]);
      setPeriodEnd(dates[dates.length - 1]);
      // Use last line's balance as ending balance if available
      const lastWithBalance = [...parsed.lines].reverse().find((l) => l.balance !== undefined);
      if (lastWithBalance?.balance !== undefined) setEndBalance(lastWithBalance.balance);
    } else {
      toast.error("Could not parse any transactions from this file");
    }
  };

  const importFile = async () => {
    if (!userId) return;
    if (parsedLines.length === 0) return;
    setSubmitting(true);
    try {
      const result = await createStatementImport({
        account_id: accountId,
        period_start: periodStart,
        period_end: periodEnd,
        starting_balance: startBalance,
        ending_balance: endBalance,
        file_name: fileName,
        user_id: userId,
        lines: parsedLines,
      });
      toast.success(`Imported ${parsedLines.length} lines · ${result.matched} auto-matched`);
      onImported();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {parsedLines.length === 0 ? (
            <>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) await handleFile(file);
                }}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports KCB, Equity, Co-op, M-Pesa statement, and generic CSV formats
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
                <p><b>Auto-matching:</b> System will compare each statement line against your existing unreconciled transactions for the period and link them by reference number, amount, and date proximity.</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-muted/30 rounded p-2">
                <div className="text-xs">
                  <span className="font-medium">{fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {parsedLines.length} transactions detected
                    {detectedFormat !== "generic" && ` · format: ${detectedFormat.toUpperCase()}`}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setParsedLines([])}>
                  Choose different file
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Period Start</label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Period End</label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Starting Balance</label>
                  <Input type="number" value={startBalance} onChange={(e) => setStartBalance(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Ending Balance</label>
                  <Input type="number" value={endBalance} onChange={(e) => setEndBalance(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="border border-border rounded-md max-h-60 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Description</th>
                      <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">In</th>
                      <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLines.slice(0, 20).map((l, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-2 py-1">{l.line_date}</td>
                        <td className="px-2 py-1 truncate max-w-xs">{l.line_description}</td>
                        <td className="px-2 py-1 text-right font-mono text-emerald-600">{l.credit > 0 ? l.credit.toFixed(2) : "—"}</td>
                        <td className="px-2 py-1 text-right font-mono text-red-600">{l.debit > 0 ? l.debit.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                    {parsedLines.length > 20 && (
                      <tr><td colSpan={4} className="px-2 py-1.5 text-center text-muted-foreground text-[10px]">
                        ...and {parsedLines.length - 20} more
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={importFile} disabled={submitting || parsedLines.length === 0}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Import {parsedLines.length} lines
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatementImportSheet({ importId, accountId, userId, onClose, onChange }: {
  importId: string | null;
  accountId: string;
  userId?: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<{ import: StatementImport; lines: StatementLine[] } | null>(null);
  const [unmatchedTxs, setUnmatchedTxs] = useState<BankTransactionWithAccount[]>([]);

  const load = async () => {
    if (!importId) return;
    const result = await getStatementImport(importId);
    setData(result);
    if (result) {
      const txs = await listTransactions({
        accountId,
        startDate: result.import.period_start,
        endDate: result.import.period_end,
        reconciled: false,
      });
      setUnmatchedTxs(txs);
    }
  };
  useEffect(() => { load(); }, [importId]);

  if (!importId || !data) return null;

  const matchLine = async (lineId: string, txId: string) => {
    if (!userId) return;
    await matchStatementLine(lineId, txId, userId);
    toast.success("Matched");
    load();
    onChange();
  };

  const createFromLine = async (line: StatementLine) => {
    if (!userId) return;
    await createTransactionFromLine({
      line_id: line.id,
      account_id: accountId,
      description: line.line_description,
      counterparty_name: line.line_description.split(" - ")[0]?.trim(),
      user_id: userId,
    });
    toast.success("Transaction created");
    load();
    onChange();
  };

  const matchedLines = data.lines.filter((l) => l.is_matched);
  const unmatchedLines = data.lines.filter((l) => !l.is_matched);

  return (
    <Sheet open={!!importId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[800px] sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>Statement Import — {data.import.period_start} to {data.import.period_end}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Total Lines" value={String(data.import.line_count)} />
            <Stat label="Matched" value={String(data.import.matched_count)} color="text-emerald-600" />
            <Stat label="Unmatched" value={String(data.import.unmatched_count)} color={data.import.unmatched_count > 0 ? "text-amber-600" : ""} />
            <Stat label="End Balance" value={KES(data.import.statement_ending_balance)} />
          </div>

          {unmatchedLines.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Unmatched Lines ({unmatchedLines.length})
              </h3>
              <div className="space-y-2">
                {unmatchedLines.map((line) => (
                  <Card key={line.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{line.line_date}</span>
                            {line.line_reference && (
                              <span className="font-mono text-muted-foreground">{line.line_reference}</span>
                            )}
                          </div>
                          <div className="text-sm mt-0.5">{line.line_description}</div>
                          <div className="flex gap-3 mt-1 text-xs font-mono">
                            {line.credit > 0 && <span className="text-emerald-600">+{line.credit.toFixed(2)}</span>}
                            {line.debit > 0 && <span className="text-red-600">-{line.debit.toFixed(2)}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Match suggestions */}
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Match to existing transaction:</p>
                        <div className="flex flex-wrap gap-1">
                          {unmatchedTxs.filter((tx) => {
                            const lineAmount = line.credit > 0 ? line.credit : line.debit;
                            return Math.abs(tx.amount - lineAmount) < 0.01;
                          }).slice(0, 3).map((tx) => (
                            <Button key={tx.id} variant="outline" size="sm" onClick={() => matchLine(line.id, tx.id)}>
                              <LinkIcon className="h-3 w-3 mr-1" />
                              {tx.description.slice(0, 30)} · {tx.amount.toFixed(2)}
                            </Button>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => createFromLine(line)}>
                            <Plus className="h-3 w-3 mr-1" /> Create new
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {matchedLines.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Matched ({matchedLines.length})
              </h3>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Description</th>
                      <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedLines.map((line) => (
                      <tr key={line.id} className="border-b border-border/60">
                        <td className="px-2 py-1.5 text-muted-foreground">{line.line_date}</td>
                        <td className="px-2 py-1.5">{line.line_description}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {line.credit > 0 ? line.credit.toFixed(2) : `-${line.debit.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  CircleNotch as Loader2,
  CreditCard as CreditCard,
  DeviceMobile as Smartphone,
  Money as Banknote,
  Pencil as Edit3,
  Plus,
  Star,
  Wallet,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import {
  listBankAccounts, upsertBankAccount, setDefaultAccount,
  listTransactions, getReconciliationSummary,
  type BankAccount, type BankAccountType, type BankTransactionWithAccount,
  type ReconciliationSummary,
} from "@/services/banking";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";


const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  bank: "Bank",
  mpesa_till: "M-Pesa Till",
  mpesa_paybill: "M-Pesa Paybill",
  cash_box: "Cash",
  credit_card: "Credit Card",
  mobile_money: "Mobile Money",
};

const ACCOUNT_TYPE_ICON: Record<BankAccountType, typeof Banknote> = {
  bank: Banknote,
  mpesa_till: Smartphone,
  mpesa_paybill: Smartphone,
  cash_box: Wallet,
  credit_card: CreditCard,
  mobile_money: Smartphone,
};

export function BankingPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransactionWithAccount[]>([]);
  const [recon, setRecon] = useState<Map<string, ReconciliationSummary>>(new Map());
  const [tab, setTab] = useState<"overview" | "transactions" | "cashflow">("overview");
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const accs = await listBankAccounts(false);
      setAccounts(accs);

      // Recent transactions across all accounts
      const txs = await listTransactions({ limit: 100 });
      setTransactions(txs);

      // Recon summary per account
      const summaries = await Promise.all(accs.map((a) => getReconciliationSummary(a.id)));
      const m = new Map<string, ReconciliationSummary>();
      summaries.forEach((s) => { if (s) m.set(s.account_id, s); });
      setRecon(m);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Finance"
        title="Banking"
        description="Bank accounts, M-Pesa tills, cash. Track movements and reconcile against statements."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New account
          </Button>
        }
      />

      <Card className="bg-gradient-to-br from-primary/5 to-primary/0">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cash on Hand</p>
          <p className="text-3xl font-semibold font-mono mt-1">{KES(totalBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
        </TabsList>

        <TabsPanel value="overview" className="mt-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-md bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Banknote}
                  title="No accounts yet"
                  description="Add your bank accounts, M-Pesa tills, and cash boxes to track every shilling."
                  cta={{ label: "Add Account", onClick: () => setCreating(true), icon: Plus }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {accounts.map((a) => {
                const Icon = ACCOUNT_TYPE_ICON[a.account_type] || Banknote;
                const summary = recon.get(a.id);
                return (
                  <Card
                    key={a.id}
                    className="hover:bg-accent/30 cursor-pointer"
                    onClick={() => navigate(`/banking/${a.id}`)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              {a.name}
                              {a.is_default === 1 && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {ACCOUNT_TYPE_LABELS[a.account_type]}
                              {a.account_number ? ` · ${a.account_number}` : ""}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); setEditing(a); }}>
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-2xl font-semibold font-mono tabular-nums">
                        {KES(a.current_balance)}
                      </div>
                      {summary && summary.unreconciled_count > 0 && (
                        <div className="text-[10px] text-amber-600">
                          {summary.unreconciled_count} unreconciled txn{summary.unreconciled_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="transactions" className="mt-3">
          <TransactionsTable transactions={transactions} loading={loading} />
        </TabsPanel>

        <TabsPanel value="cashflow" className="mt-3">
          <CashflowView />
        </TabsPanel>
      </Tabs>

      <AccountForm
        open={creating || !!editing}
        account={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function TransactionsTable({ transactions, loading }: {
  transactions: BankTransactionWithAccount[];
  loading: boolean;
}) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Account</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</th>
            <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Money In</th>
            <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Money Out</th>
            <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border/60">
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-3 py-2"><div className="h-3 bg-muted/30 rounded animate-pulse" /></td>
                ))}
              </tr>
            ))
          ) : transactions.length === 0 ? (
            <tr><td colSpan={7} className="p-0">
              <EmptyState
                icon={Banknote}
                title="No transactions yet"
                description="Money in/out will appear here as you record sales, expenses, and bank movements."
              />
            </td></tr>
          ) : (
            transactions.map((t) => {
              const isIn = ["deposit", "transfer_in", "interest"].includes(t.transaction_type);
              return (
                <tr key={t.id} className="border-b border-border/60 hover:bg-accent/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(t.transaction_date).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-3 py-2 text-xs">{t.account_name}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.description}
                    {t.counterparty_name && (
                      <div className="text-[10px] text-muted-foreground">{t.counterparty_name}</div>
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
                      <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full bg-muted block mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function AccountForm({ open, account, onClose, onSaved }: {
  open: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<BankAccount>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (account) setForm(account);
      else setForm({
        name: "",
        account_type: "bank",
        currency: "KES",
        opening_balance: 0,
        is_active: 1,
        opening_date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [account, open]);

  const save = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    setSubmitting(true);
    try {
      await upsertBankAccount({
        ...form,
        name: form.name,
        account_type: form.account_type || "bank",
      });
      toast.success(account ? "Updated" : "Created");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  const setAsDefault = async () => {
    if (!account) return;
    await setDefaultAccount(account.id);
    toast.success("Set as default");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>{account ? account.name : "New Account"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <Field label="Account Name *">
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g., "KCB Main", "Till 123456"' autoFocus />
          </Field>

          <Field label="Account Type">
            <Select value={form.account_type || "bank"} onValueChange={(v) => setForm({ ...form, account_type: String(v) as BankAccountType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="bank">Bank Account</SelectItem>
              <SelectItem value="mpesa_till">M-Pesa Till</SelectItem>
              <SelectItem value="mpesa_paybill">M-Pesa Paybill</SelectItem>
              <SelectItem value="mobile_money">Other Mobile Money</SelectItem>
              <SelectItem value="cash_box">Cash Box</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
            </SelectContent></Select>
          </Field>

          {(form.account_type === "bank") && (
            <>
              <Field label="Bank Name">
                <Input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g., KCB, Equity, Co-op" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Account Number">
                  <Input value={form.account_number || ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="font-mono" />
                </Field>
                <Field label="Branch">
                  <Input value={form.branch || ""} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {(form.account_type === "mpesa_till" || form.account_type === "mpesa_paybill") && (
            <Field label={form.account_type === "mpesa_till" ? "Till Number" : "Paybill Number"}>
              <Input value={form.account_number || ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="font-mono" placeholder="e.g., 123456" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Opening Balance">
              <Input
                type="number"
                value={form.opening_balance ?? 0}
                onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                disabled={!!account}
              />
              {account && <p className="text-[10px] text-muted-foreground">Cannot edit after creation</p>}
            </Field>
            <Field label="Opening Date">
              <Input
                type="date"
                value={form.opening_date || ""}
                onChange={(e) => setForm({ ...form, opening_date: e.target.value })}
                disabled={!!account}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>

          {account && (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-mono font-semibold">{KES(account.current_balance)}</span>
              </div>
              {!account.is_default && (
                <Button variant="outline" size="sm" className="w-full" onClick={setAsDefault}>
                  <Star className="h-3.5 w-3.5 mr-1.5" /> Set as Default
                </Button>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}


function CashflowView() {
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [daily, setDaily] = useState<Array<{ day: string; cash_in: number; cash_out: number; net: number }>>([]);
  const [bySource, setBySource] = useState<Array<{ source: string; cash_in: number; cash_out: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      import("@/services/cashflow").then((m) => m.getCashflowDaily({ startDate: period.start, endDate: period.end })),
      import("@/services/cashflow").then((m) => m.getCashflowBySource({ startDate: period.start, endDate: period.end })),
    ]).then(([d, s]) => {
      setDaily(d);
      setBySource(s);
    }).finally(() => setLoading(false));
  }, [period.start, period.end]);

  const totalIn = daily.reduce((s, d) => s + d.cash_in, 0);
  const totalOut = daily.reduce((s, d) => s + d.cash_out, 0);
  const net = totalIn - totalOut;
  const maxBar = Math.max(...daily.map((d) => Math.max(d.cash_in, d.cash_out)), 1);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground">Period:</span>
        <input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs" />
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total In</p>
            <p className="text-xl font-semibold font-mono mt-1 text-emerald-600">{KES(totalIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Out</p>
            <p className="text-xl font-semibold font-mono mt-1 text-red-600">{KES(totalOut)}</p>
          </CardContent>
        </Card>
        <Card className={net >= 0 ? "border-emerald-600/30" : "border-red-600/30"}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net</p>
            <p className={`text-xl font-semibold font-mono mt-1 ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {net >= 0 ? "+" : ""}{KES(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Daily Movement</h3>
            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" />)}
              </div>
            ) : daily.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-xs">No transactions in this period</div>
            ) : (
              <div className="space-y-1">
                {daily.slice(-15).map((d) => (
                  <div key={d.day} className="flex items-center gap-2 text-xs">
                    <div className="w-16 text-[10px] text-muted-foreground tabular-nums">
                      {new Date(d.day).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}
                    </div>
                    <div className="flex-1 flex gap-px h-3.5">
                      <div className="bg-emerald-500/70 rounded-l" style={{ width: `${(d.cash_in / maxBar) * 50}%` }} title={`In: ${KES(d.cash_in)}`} />
                      <div className="bg-red-500/70 rounded-r" style={{ width: `${(d.cash_out / maxBar) * 50}%` }} title={`Out: ${KES(d.cash_out)}`} />
                    </div>
                    <div className={`w-20 text-right text-[10px] font-mono ${d.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {d.net >= 0 ? "+" : ""}{d.net.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">By Source</h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-6 bg-muted/30 rounded animate-pulse" />)}
              </div>
            ) : bySource.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-xs">No transactions in this period</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Source</th>
                    <th className="text-right py-1 text-[10px] uppercase tracking-wider text-muted-foreground">In</th>
                    <th className="text-right py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Out</th>
                    <th className="text-right py-1 text-[10px] uppercase tracking-wider text-muted-foreground">#</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((s) => (
                    <tr key={s.source} className="border-b border-border/60">
                      <td className="py-1.5">{s.source}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono text-emerald-600">{s.cash_in > 0 ? KES(s.cash_in) : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono text-red-600">{s.cash_out > 0 ? KES(s.cash_out) : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

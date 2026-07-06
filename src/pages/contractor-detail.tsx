/**
 * ContractorDetailPage — /hardware/accounts/:customerId
 *
 * Everything the store manager needs on one screen:
 *   - Credit + balance + available header
 *   - Ledger table (charges + payments interleaved, newest first)
 *   - Recent quotes (last 10)
 *   - Recent deliveries (last 10)
 *   - Actions: Record payment, Post adjustment, Edit limits, Toggle hold
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "@/components/ui/back-button";
import { CurrencyDollar, PencilSimple, Warning, FileText, Truck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { query } from "@/lib/db";
import { getAccount, listLedgerEntries, setAccountHold, type LedgerEntry } from "@/services/hardware";
import { money as KES } from "@/lib/money";
import { ContractorAccountDialog } from "@/components/hardware/contractor-account-dialog";
import { RecordPaymentDialog } from "@/components/hardware/record-payment-dialog";
import { AdjustmentDialog } from "@/components/hardware/adjustment-dialog";

interface Customer { id: string; name: string; phone: string | null; email: string | null; address: string | null; }
interface AccountHeader { credit_limit: number; balance: number; terms_days: number; on_hold: number; }
interface QuoteRef { id: string; quotation_number: string; status: string; total: number; created_at: string; }
interface DeliveryRef { id: string; note_number: string; status: string; created_at: string; }

const LEDGER_STYLE: Record<string, string> = {
  charge: "text-rose-600",
  payment: "text-emerald-600",
  adjustment: "text-amber-600",
};

export function ContractorDetailPage() {
  const { customerId = "" } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [account, setAccount] = useState<AccountHeader | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [quotes, setQuotes] = useState<QuoteRef[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRef[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const [c] = await query<Customer>(
        `SELECT id, name, phone, email, address FROM customers WHERE id = ?1`,
        [customerId],
      );
      setCustomer(c ?? null);
      const acc = await getAccount(customerId);
      setAccount(acc);
      const led = await listLedgerEntries(customerId);
      setLedger(led);
      const q = await query<QuoteRef>(
        `SELECT id, quotation_number, status, total, created_at
         FROM quotations WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT 10`,
        [customerId],
      );
      setQuotes(q);
      const d = await query<DeliveryRef>(
        `SELECT id, note_number, status, created_at
         FROM delivery_notes WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT 10`,
        [customerId],
      );
      setDeliveries(d);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const toggleHold = async () => {
    if (!account || !customerId) return;
    try {
      await setAccountHold(customerId, account.on_hold === 0);
      toast.success(account.on_hold ? "Hold released" : "Account put on hold");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading contractor…</div>;
  if (!customer) return <div className="p-6 text-sm text-muted-foreground">Contractor not found.</div>;

  const balance = account?.balance ?? 0;
  const limit = account?.credit_limit ?? 0;
  const available = Math.max(0, limit - balance);
  const utilization = limit > 0 ? (balance / limit) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <BackButton fallback="/hardware?tab=accounts" label="Back to accounts" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
            <CurrencyDollar className="h-3.5 w-3.5 mr-1.5" /> Record payment
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdjustmentOpen(true)}>
            Adjustment
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <PencilSimple className="h-3.5 w-3.5 mr-1.5" /> Edit limits
          </Button>
          <Button size="sm" variant={account?.on_hold ? "default" : "outline"} onClick={toggleHold}>
            {account?.on_hold ? "Release hold" : "Put on hold"}
          </Button>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <div className="text-xs text-muted-foreground mt-1 space-x-3">
              {customer.phone ? <span>{customer.phone}</span> : null}
              {customer.email ? <span>· {customer.email}</span> : null}
              {customer.address ? <span>· {customer.address}</span> : null}
            </div>
          </div>
          {account?.on_hold ? (
            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30">
              <Warning className="h-3 w-3 mr-1" /> On hold
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Credit limit" value={KES(limit)} />
          <Kpi label="Balance" value={KES(balance)} tone={balance > limit ? "danger" : "default"} />
          <Kpi label="Available" value={KES(available)} tone={available === 0 ? "warning" : "default"} />
          <Kpi label="Utilization" value={`${utilization.toFixed(0)}%`} tone={utilization > 80 ? "warning" : "default"} />
        </div>
      </div>

      {/* Ledger */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Ledger</h2>
        {ledger.length === 0 ? (
          <div className="border border-dashed border-border rounded-md px-3 py-6 text-center text-sm text-muted-foreground italic">
            No ledger entries yet.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Reference</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-right px-3 py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{e.created_at.slice(0, 10)}</td>
                    <td className={cn("px-3 py-2 text-xs capitalize font-medium", LEDGER_STYLE[e.entry_type])}>{e.entry_type}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.reference ?? "—"}</td>
                    <td className={cn("px-3 py-2 text-right font-mono tabular-nums", LEDGER_STYLE[e.entry_type])}>
                      {e.entry_type === "payment" ? "−" : ""}{KES(Math.abs(e.amount))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(e.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent quotes + deliveries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4" /> Recent quotes</h3>
            </div>
            {quotes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No quotes yet.</div>
            ) : (
              <ul className="space-y-1.5">
                {quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between text-[13px] hover:bg-accent/40 -mx-1 px-1 rounded cursor-pointer" onClick={() => navigate(`/hardware/quotations/${q.id}`)}>
                    <span className="font-mono">{q.quotation_number}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] capitalize">{q.status}</Badge>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">{KES(q.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5"><Truck className="h-4 w-4" /> Recent deliveries</h3>
            </div>
            {deliveries.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No deliveries yet.</div>
            ) : (
              <ul className="space-y-1.5">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-[13px]">
                    <span className="font-mono">{d.note_number}</span>
                    <Badge variant="outline" className="text-[9px] capitalize">{d.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ContractorAccountDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); load(); }}
        customerId={customerId}
      />
      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => { setPaymentOpen(false); load(); }}
        customerId={customerId}
        customerName={customer.name}
        outstandingBalance={balance}
      />
      <AdjustmentDialog
        open={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        onSaved={() => { setAdjustmentOpen(false); load(); }}
        customerId={customerId}
        customerName={customer.name}
      />
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "danger" }) {
  const cls =
    tone === "danger" ? "border-rose-500/40 bg-rose-500/5" :
    tone === "warning" ? "border-amber-500/40 bg-amber-500/5" :
    "border-border bg-background";
  return (
    <div className={cn("rounded-lg border p-3", cls)}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-semibold font-mono tabular-nums mt-1">{value}</div>
    </div>
  );
}

/**
 * Hardware module pages (plan 10). Flat, data-dense, theme-token UI per the
 * Omnix design system. Gated by the `hardware` entitlement + hardware.* perms.
 */
import { useEffect, useState } from "react";
import {
  Wrench, FileText, Truck, Users, Percent, BarChart3, Plus, Loader2,
  CheckCircle2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listQuotations, agedReceivables, markDispatched, markDelivered,
  type Quotation, type AgingBuckets,
} from "@/services/hardware";
import { query } from "@/lib/db";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "@/stores/cart";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Hardware primary-action button colour (matches the orange dashboard/POS accent). */
const BRAND_BTN = "bg-orange-700 hover:bg-orange-800 text-white";

function PageHead({ icon: Icon, title, subtitle, action }: { icon: typeof Wrench; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-5 w-5 text-orange-600" /> {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  converted: "bg-emerald-600 text-white",
  expired: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dispatched: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delivered: "bg-emerald-600 text-white",
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function HardwareDashboardPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [aging, setAging] = useState<AgingBuckets | null>(null);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listQuotations(),
      agedReceivables(),
      query<{ n: number }>(`SELECT COUNT(*) AS n FROM delivery_notes WHERE status IN ('pending','dispatched')`),
    ]).then(([q, a, d]) => {
      setQuotes(q); setAging(a); setPendingDeliveries(d[0]?.n ?? 0);
    }).finally(() => setLoading(false));
  }, []);

  const openQuotes = quotes.filter((q) => !["converted", "cancelled", "expired"].includes(q.status)).length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHead icon={Wrench} title="Hardware Dashboard" subtitle="Quotations, receivables, deliveries at a glance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Open quotations" value={String(openQuotes)} />
        <Kpi label="Receivables" value={KES(aging?.total ?? 0)} />
        <Kpi label="Overdue 90+" value={KES(aging?.d90_plus ?? 0)} tone={aging && aging.d90_plus > 0 ? "danger" : "default"} />
        <Kpi label="Deliveries pending" value={String(pendingDeliveries)} />
      </div>

      {aging && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-3">Aged receivables</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[["Current", aging.current], ["1–30", aging.d1_30], ["31–60", aging.d31_60], ["61–90", aging.d61_90], ["90+", aging.d90_plus]].map(([label, v]) => (
                <div key={label as string} className="rounded-md border border-border p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="font-mono tabular-nums text-sm mt-1">{KES(v as number)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-semibold mt-1 font-mono tabular-nums", tone === "danger" && "text-red-600")}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export function HardwareQuotationsPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const loadSnapshot = useCartStore((s) => s.loadSnapshot);

  const load = () => { setLoading(true); listQuotations().then(setQuotes).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const sendToPos = async (q: Quotation) => {
    setBusy(q.id);
    try {
      const { prepareQuoteForPosCheckout } = await import("@/services/hardware");
      const payload = await prepareQuoteForPosCheckout(q.id);
      const label = payload.quote.customer_name
        ? `${payload.quote.quote_number} — ${payload.quote.customer_name}`
        : payload.quote.quote_number;
      loadSnapshot(payload.items, payload.quote.discount, payload.quote.customer_id, {
        source: { type: "hardware_quote", id: payload.quote.id, label },
      });
      toast.success(`Quote ${payload.quote.quote_number} loaded in POS`);
      navigate("/pos");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHead
        icon={FileText}
        title="Quotations"
        subtitle="Create quotes for contractors; convert accepted quotes to sales."
        action={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => toast.info("Use POS → Quote, or the contractor account page to build a quotation.")}><Plus className="h-3.5 w-3.5 mr-1.5" /> New quote</Button>}
      />
      {loading ? <CenterSpin /> : quotes.length === 0 ? (
        <EmptyHint text="No quotations yet." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Quote #</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Valid until</th>
                <th className="text-right px-3 py-2 w-44">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const canSend = q.status === "draft" || q.status === "sent" || q.status === "accepted";
                return (
                  <tr key={q.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 font-mono">{q.quote_number}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[q.status])}>{q.status}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(q.total)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{q.valid_until ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {canSend ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === q.id}
                          onClick={() => sendToPos(q)}
                          className="cursor-pointer"
                        >
                          {busy === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send to POS"}
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{q.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Delivery notes ──────────────────────────────────────────────────────────

interface DeliveryNote { id: string; note_number: string; status: string; delivery_address: string | null; created_at: string; }

export function HardwareDeliveryNotesPage() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    query<DeliveryNote>(`SELECT id, note_number, status, delivery_address, created_at FROM delivery_notes ORDER BY created_at DESC LIMIT 200`)
      .then(setNotes).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const advance = async (n: DeliveryNote) => {
    try {
      if (n.status === "pending") await markDispatched(n.id);
      else if (n.status === "dispatched") await markDelivered(n.id);
      load();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div>
      <PageHead icon={Truck} title="Delivery Notes" subtitle="Track dispatch and delivery of materials." />
      {loading ? <CenterSpin /> : notes.length === 0 ? (
        <EmptyHint text="No delivery notes yet." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Note #</th>
                <th className="text-left px-3 py-2">Address</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-mono">{n.note_number}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[240px]">{n.delivery_address ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[n.status])}>{n.status}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {n.status === "pending" && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => advance(n)}><Truck className="h-3 w-3 mr-1" /> Dispatch</Button>}
                    {n.status === "dispatched" && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => advance(n)}><CheckCircle2 className="h-3 w-3 mr-1" /> Delivered</Button>}
                    {n.status === "delivered" && <span className="text-[11px] text-emerald-600">Delivered</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Contractor accounts ─────────────────────────────────────────────────────

interface AccountRow { customer_id: string; name: string; credit_limit: number; balance: number; on_hold: number; }

export function HardwareAccountsPage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<AccountRow>(
      `SELECT ca.customer_id, c.name, ca.credit_limit, ca.balance, ca.on_hold
       FROM customer_accounts ca JOIN customers c ON c.id = ca.customer_id
       ORDER BY ca.balance DESC`,
    ).then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHead icon={Users} title="Contractor Accounts" subtitle="Credit limits, outstanding balances, and holds." />
      {loading ? <CenterSpin /> : rows.length === 0 ? (
        <EmptyHint text="No contractor accounts yet. Set a credit limit on a customer to create one." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Credit limit</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-right px-3 py-2">Available</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer_id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.credit_limit)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.balance)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(Math.max(0, r.credit_limit - r.balance))}</td>
                  <td className="px-3 py-2">{r.on_hold ? <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600">On hold</Badge> : <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Commissions ─────────────────────────────────────────────────────────────

interface CommissionRow { employee: string; total: number; count: number; }

export function HardwareCommissionsPage() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    query<CommissionRow>(
      `SELECT e.full_name AS employee, COALESCE(SUM(ca.amount),0) AS total, COUNT(*) AS count
       FROM commission_accruals ca JOIN employees e ON e.id = ca.employee_id
       GROUP BY ca.employee_id ORDER BY total DESC`,
    ).then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHead icon={Percent} title="Commissions" subtitle="Salesperson commission accruals." />
      {loading ? <CenterSpin /> : rows.length === 0 ? (
        <EmptyHint text="No commissions accrued yet." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Salesperson</th>
                <th className="text-right px-3 py-2">Sales</th>
                <th className="text-right px-3 py-2">Commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.employee}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function HardwareReportsPage() {
  const [aging, setAging] = useState<AgingBuckets | null>(null);
  const [quoteStats, setQuoteStats] = useState<{ total: number; converted: number }>({ total: 0, converted: 0 });

  useEffect(() => {
    agedReceivables().then(setAging);
    query<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM quotations GROUP BY status`).then((rows) => {
      const total = rows.reduce((s, r) => s + r.n, 0);
      const converted = rows.find((r) => r.status === "converted")?.n ?? 0;
      setQuoteStats({ total, converted });
    });
  }, []);

  const conversionRate = quoteStats.total > 0 ? Math.round((quoteStats.converted / quoteStats.total) * 100) : 0;

  return (
    <div>
      <PageHead icon={BarChart3} title="Hardware Reports" subtitle="Receivables aging and quotation conversion." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Quotes" value={String(quoteStats.total)} />
        <Kpi label="Converted" value={String(quoteStats.converted)} />
        <Kpi label="Conversion rate" value={`${conversionRate}%`} />
        <Kpi label="Receivables" value={KES(aging?.total ?? 0)} />
      </div>
      {aging && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Aged receivables</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[["Current", aging.current], ["1–30", aging.d1_30], ["31–60", aging.d31_60], ["61–90", aging.d61_90], ["90+", aging.d90_plus]].map(([label, v]) => (
                <div key={label as string} className="rounded-md border border-border p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="font-mono tabular-nums text-sm mt-1">{KES(v as number)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function CenterSpin() {
  return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}
function EmptyHint({ text }: { text: string }) {
  return <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

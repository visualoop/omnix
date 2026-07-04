import { useEffect, useState } from "react";
import {
  CheckCircle as CheckCircle2,
  Clock,
  FileText,
  Percent,
  Plus,
  Truck,
  Users,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listQuotations, agedReceivables, markDelivered,
  listCommissionRules, type CommissionRule,
  type Quotation, type AgingBuckets,
} from "@/services/hardware";
import { query } from "@/lib/db";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";
import { money as KES } from "@/lib/money";
import { ContractorAccountDialog } from "@/components/hardware/contractor-account-dialog";
import { CommissionRuleDialog } from "@/components/hardware/commission-rule-dialog";
import { DeliveryNoteDialog } from "@/components/hardware/delivery-note-dialog";
import { DispatchDialog } from "@/components/hardware/dispatch-dialog";
import { AgingBucketSheet } from "@/components/hardware/aging-bucket-sheet";
import {
  moduleAccent, ModuleMasthead, ModuleStat, ModuleTable, ModuleTHead,
  ModuleEmpty, ModuleSpinner,
} from "@/components/shared/module-kit";

const ACCENT = moduleAccent("hardware");
/** Hardware primary-action button colour. */
const BRAND_BTN = `${ACCENT.solid} ${ACCENT.solidHover}`;

import { HARDWARE_STATUS_STYLE as STATUS_STYLE } from "@/lib/hardware-status";

// ─── Dashboard ───────────────────────────────────────────────────────────────

type BucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export function HardwareDashboardPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [aging, setAging] = useState<AgingBuckets | null>(null);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openBucket, setOpenBucket] = useState<BucketKey | null>(null);

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

  if (loading) return <ModuleSpinner />;

  return (
    <div>
      <ModuleMasthead accent={ACCENT} title="Hardware Dashboard" subtitle="Quotations, receivables, and deliveries at a glance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ModuleStat accent={ACCENT} label="Open quotations" value={openQuotes} icon={FileText} />
        <ModuleStat accent={ACCENT} label="Receivables" value={KES(aging?.total ?? 0)} tone="accent" />
        <ModuleStat accent={ACCENT} label="Overdue 90+" value={KES(aging?.d90_plus ?? 0)} tone={aging && aging.d90_plus > 0 ? "danger" : "default"} />
        <ModuleStat accent={ACCENT} label="Deliveries pending" value={pendingDeliveries} icon={Truck} />
      </div>

      {aging && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-3">Aged receivables</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {([
                ["Current", aging.current, "current" as BucketKey],
                ["1–30", aging.d1_30, "d1_30" as BucketKey],
                ["31–60", aging.d31_60, "d31_60" as BucketKey],
                ["61–90", aging.d61_90, "d61_90" as BucketKey],
                ["90+", aging.d90_plus, "d90_plus" as BucketKey],
              ] as const).map(([label, v, k]) => (
                <button
                  key={label}
                  onClick={() => setOpenBucket(k)}
                  className="rounded-md border border-border p-2.5 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="font-mono tabular-nums text-sm mt-1">{KES(v)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <AgingBucketSheet open={openBucket !== null} onClose={() => setOpenBucket(null)} bucket={openBucket} />
    </div>
  );
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export function HardwareQuotationsPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
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
        ? `${payload.quote.quotation_number} — ${payload.quote.customer_name}`
        : payload.quote.quotation_number;
      loadSnapshot(payload.items, payload.quote.discount, payload.quote.customer_id, {
        source: { type: "hardware_quote", id: payload.quote.id, label },
      });
      toast.success(`Quote ${payload.quote.quotation_number} loaded in POS`);
      navigate("/pos/sale");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <ModuleMasthead
        accent={ACCENT}
        eyebrow="Hardware · Quotations"
        title="Quotations"
        subtitle="Quote contractors, then convert accepted quotes straight to a sale."
        actions={<Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => navigate("/pos/sale?mode=quote")}><Plus className="h-3.5 w-3.5 mr-1.5" /> New quote</Button>}
      />
      {loading ? <ModuleSpinner /> : quotes.length === 0 ? (
        <ModuleEmpty icon={FileText} title="No quotations yet" hint="Build a quote from the POS or a contractor account." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quote # or customer…"
              className="h-8 text-xs max-w-[240px]"
            />
            <div className="flex flex-wrap items-center gap-1">
              <StatusChip label="All" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
              {(["draft", "sent", "accepted", "converted", "expired", "cancelled"] as const).map((s) => (
                <StatusChip key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </div>
            <div className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
              {quotes.filter((q) => (!statusFilter || q.status === statusFilter) && (!search || q.quotation_number.toLowerCase().includes(search.toLowerCase()) || (q.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false))).length} of {quotes.length}
            </div>
          </div>
        <ModuleTable>
          <ModuleTHead>
            <tr>
              <th className="text-left px-3 py-2">Quote #</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Valid until</th>
              <th className="text-right px-3 py-2 w-44">Action</th>
            </tr>
          </ModuleTHead>
          <tbody>
            {quotes
              .filter((q) => (!statusFilter || q.status === statusFilter) && (!search || q.quotation_number.toLowerCase().includes(search.toLowerCase()) || (q.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false)))
              .map((q) => {
              const canSend = q.status === "draft" || q.status === "sent" || q.status === "accepted";
              return (
                <tr key={q.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-mono">{q.quotation_number}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[q.status])}>{q.status}</Badge></td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(q.total)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{q.valid_until ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canSend ? (
                      <Button size="sm" variant="outline" disabled={busy === q.id} onClick={() => sendToPos(q)} className="cursor-pointer">
                        {busy === q.id ? "Loading…" : "Send to POS"}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{q.status}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ModuleTable>
        </>
      )}
    </div>
  );
}

/** Shared filter chip used across hardware lists. */
function StatusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
        active
          ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ─── Delivery notes ──────────────────────────────────────────────────────────

interface DeliveryNote { id: string; note_number: string; status: string; delivery_address: string | null; created_at: string; }

export function HardwareDeliveryNotesPage() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<DeliveryNote | null>(null);
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user, "hardware.delivery_notes.manage");

  const load = () => {
    setLoading(true);
    query<DeliveryNote>(`SELECT id, note_number, status, delivery_address, created_at FROM delivery_notes ORDER BY created_at DESC LIMIT 200`)
      .then(setNotes).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const advanceToDelivered = async (n: DeliveryNote) => {
    try { await markDelivered(n.id); load(); }
    catch (e) { toast.error(String(e)); }
  };

  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Hardware · Logistics" title="Delivery Notes" subtitle="Track dispatch and delivery of materials to site." actions={canManage ? (
        <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New note
        </Button>
      ) : undefined} />
      <DeliveryNoteDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={() => { setNewOpen(false); load(); }} />
      {dispatchTarget ? (
        <DispatchDialog
          open={!!dispatchTarget}
          onClose={() => setDispatchTarget(null)}
          onSaved={() => { setDispatchTarget(null); load(); }}
          noteId={dispatchTarget.id}
          noteNumber={dispatchTarget.note_number}
        />
      ) : null}
      {loading ? <ModuleSpinner /> : notes.length === 0 ? (
        <ModuleEmpty icon={Truck} title="No delivery notes yet" hint="Delivery notes are created when an order is dispatched." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note # or address…"
              className="h-8 text-xs max-w-[240px]"
            />
            <div className="flex flex-wrap items-center gap-1">
              <StatusChip label="All" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
              {(["pending", "dispatched", "delivered", "cancelled"] as const).map((s) => (
                <StatusChip key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </div>
          </div>
        <ModuleTable>
          <ModuleTHead>
            <tr>
              <th className="text-left px-3 py-2">Note #</th>
              <th className="text-left px-3 py-2">Address</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </ModuleTHead>
          <tbody>
            {notes
              .filter((n) => (!statusFilter || n.status === statusFilter) && (!search || n.note_number.toLowerCase().includes(search.toLowerCase()) || (n.delivery_address?.toLowerCase().includes(search.toLowerCase()) ?? false)))
              .map((n) => (
              <tr key={n.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                <td className="px-3 py-2 font-mono">{n.note_number}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[240px]">{n.delivery_address ?? "—"}</td>
                <td className="px-3 py-2"><Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[n.status])}>{n.status}</Badge></td>
                <td className="px-3 py-2 text-right">
                  {canManage && n.status === "pending" && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setDispatchTarget(n)}><Truck className="h-3 w-3 mr-1" /> Dispatch</Button>}
                  {canManage && n.status === "dispatched" && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => advanceToDelivered(n)}><CheckCircle2 className="h-3 w-3 mr-1" /> Delivered</Button>}
                  {n.status === "delivered" && <span className="text-[11px] text-emerald-600">Delivered</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
        </>
      )}
    </div>
  );
}

// ─── Contractor accounts ─────────────────────────────────────────────────────

interface AccountRow { customer_id: string; name: string; credit_limit: number; balance: number; on_hold: number; }

export function HardwareAccountsPage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    query<AccountRow>(
      `SELECT ca.customer_id, c.name, ca.credit_limit, ca.balance, ca.on_hold
       FROM customer_accounts ca JOIN customers c ON c.id = ca.customer_id
       ORDER BY ca.balance DESC`,
    ).then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Hardware · Accounts" title="Contractor Accounts" subtitle="Credit limits, outstanding balances, and holds." actions={
        <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => { setEditingCustomerId(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New account
        </Button>
      } />
      <ContractorAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(); }}
        customerId={editingCustomerId ?? undefined}
      />
      {loading ? <ModuleSpinner /> : rows.length === 0 ? (
        <ModuleEmpty icon={Users} title="No contractor accounts yet" hint="Set a credit limit on a customer to open an account." />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contractor…"
              className="h-8 text-xs max-w-[240px]"
            />
            <div className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
              {rows.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase())).length} of {rows.length}
            </div>
          </div>
        <ModuleTable>
          <ModuleTHead>
            <tr>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-right px-3 py-2">Credit limit</th>
              <th className="text-right px-3 py-2">Balance</th>
              <th className="text-right px-3 py-2">Available</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </ModuleTHead>
          <tbody>
            {rows
              .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
              .map((r) => (
              <tr key={r.customer_id} className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/hardware/accounts/${r.customer_id}`)}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.credit_limit)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.balance)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(Math.max(0, r.credit_limit - r.balance))}</td>
                <td className="px-3 py-2">{r.on_hold ? <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600">On hold</Badge> : <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </ModuleTable>
        </>
      )}
    </div>
  );
}

// ─── Commissions ─────────────────────────────────────────────────────────────

interface CommissionRow { employee: string; total: number; count: number; }

export function HardwareCommissionsPage() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"accruals" | "rules">("accruals");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      query<CommissionRow>(
        `SELECT e.full_name AS employee, COALESCE(SUM(ca.amount),0) AS total, COUNT(*) AS count
         FROM commission_accruals ca JOIN employees e ON e.id = ca.employee_id
         GROUP BY ca.employee_id ORDER BY total DESC`,
      ),
      listCommissionRules(),
    ]).then(([r, ru]) => { setRows(r); setRules(ru); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Hardware · Sales" title="Commissions" subtitle="Rules + accruals for salespeople." actions={tab === "rules" ? (
        <Button size="sm" className={cn("cursor-pointer", BRAND_BTN)} onClick={() => { setEditingRule(null); setRuleDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New rule
        </Button>
      ) : undefined} />

      <div className="flex items-center gap-1 mb-3 border-b border-border">
        <button
          onClick={() => setTab("accruals")}
          className={cn("px-3 py-1.5 text-sm border-b-2 transition-colors -mb-px", tab === "accruals" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          Accruals
        </button>
        <button
          onClick={() => setTab("rules")}
          className={cn("px-3 py-1.5 text-sm border-b-2 transition-colors -mb-px", tab === "rules" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          Rules ({rules.length})
        </button>
      </div>

      {loading ? <ModuleSpinner /> : tab === "rules" ? (
        rules.length === 0 ? (
          <ModuleEmpty icon={Percent} title="No commission rules yet" hint="Add a rule so commissions accrue when salespeople close sales." />
        ) : (
          <ModuleTable>
            <ModuleTHead>
              <tr>
                <th className="text-left px-3 py-2">Salesperson</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">Percent</th>
                <th className="text-right px-3 py-2 w-20">Action</th>
              </tr>
            </ModuleTHead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category_name ?? "All"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.percent}%</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => { setEditingRule(r); setRuleDialogOpen(true); }} className="text-[11px] text-primary hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ModuleTable>
        )
      ) : rows.length === 0 ? (
        <ModuleEmpty
          icon={Percent}
          title={rules.length === 0 ? "No commission rules defined yet" : "No commissions accrued yet"}
          hint={rules.length === 0
            ? "Add a rule first — commissions will accrue automatically as salespeople close sales."
            : "Commission will show up here as salespeople close sales linked to their rule."}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search salesperson…" className="h-8 text-xs max-w-[240px]" />
          </div>
          <ModuleTable>
            <ModuleTHead>
              <tr>
                <th className="text-left px-3 py-2">Salesperson</th>
                <th className="text-right px-3 py-2">Sales</th>
                <th className="text-right px-3 py-2">Commission</th>
              </tr>
            </ModuleTHead>
            <tbody>
              {rows.filter((r) => !search || r.employee.toLowerCase().includes(search.toLowerCase())).map((r) => (
                <tr key={r.employee} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.employee}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </ModuleTable>
        </>
      )}

      <CommissionRuleDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        onSaved={() => { setRuleDialogOpen(false); load(); }}
        editing={editingRule}
      />
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────────

interface AnalyticsData {
  avgDaysToConvert: number;
  topContractors: Array<{ name: string; total: number }>;
  topCategories: Array<{ category: string; total: number }>;
  onTimeDeliveryPct: number;
}

export function HardwareReportsPage() {
  const [aging, setAging] = useState<AgingBuckets | null>(null);
  const [quoteStats, setQuoteStats] = useState<{ total: number; converted: number }>({ total: 0, converted: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [reportBucket, setReportBucket] = useState<BucketKey | null>(null);

  useEffect(() => {
    agedReceivables().then(setAging);
    query<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM quotations GROUP BY status`).then((rows) => {
      const total = rows.reduce((s, r) => s + r.n, 0);
      const converted = rows.find((r) => r.status === "converted")?.n ?? 0;
      setQuoteStats({ total, converted });
    });
    // Analytical queries
    Promise.all([
      query<{ avg_days: number }>(
        `SELECT AVG(CAST((julianday(s.created_at) - julianday(q.created_at)) AS REAL)) AS avg_days
         FROM quotations q JOIN sales s ON s.id = q.converted_sale_id
         WHERE q.status = 'converted'`,
      ),
      query<{ name: string; total: number }>(
        `SELECT c.name, SUM(s.total) AS total FROM sales s
         JOIN customers c ON c.id = s.customer_id
         WHERE s.status = 'completed' AND s.created_at >= datetime('now', '-90 days')
         GROUP BY s.customer_id ORDER BY total DESC LIMIT 5`,
      ),
      query<{ category: string; total: number }>(
        `SELECT COALESCE(cat.name, 'Uncategorized') AS category, SUM(si.total) AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE s.status = 'completed' AND s.created_at >= datetime('now', '-90 days')
         GROUP BY category ORDER BY total DESC LIMIT 5`,
      ),
      query<{ total: number; on_time: number }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN delivered_at IS NOT NULL AND dispatched_at IS NOT NULL
                    AND CAST((julianday(delivered_at) - julianday(dispatched_at)) AS REAL) <= 3
                    THEN 1 ELSE 0 END) AS on_time
         FROM delivery_notes WHERE status = 'delivered'`,
      ),
    ]).then(([avg, contractors, categories, delivery]) => {
      const total = delivery[0]?.total ?? 0;
      const onTime = delivery[0]?.on_time ?? 0;
      setAnalytics({
        avgDaysToConvert: avg[0]?.avg_days ?? 0,
        topContractors: contractors,
        topCategories: categories,
        onTimeDeliveryPct: total > 0 ? Math.round((onTime / total) * 100) : 0,
      });
    }).catch(() => setAnalytics(null));
  }, []);

  const conversionRate = quoteStats.total > 0 ? Math.round((quoteStats.converted / quoteStats.total) * 100) : 0;

  return (
    <div>
      <ModuleMasthead accent={ACCENT} eyebrow="Hardware · Reports" title="Hardware Reports" subtitle="Receivables aging and quotation conversion." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <ModuleStat accent={ACCENT} label="Quotes" value={quoteStats.total} />
        <ModuleStat accent={ACCENT} label="Converted" value={quoteStats.converted} />
        <ModuleStat accent={ACCENT} label="Conversion rate" value={`${conversionRate}%`} tone="accent" />
        <ModuleStat accent={ACCENT} label="Receivables" value={KES(aging?.total ?? 0)} />
      </div>
      {analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2">Top contractors · last 90d</div>
              {analytics.topContractors.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No sales in the last 90 days.</div>
              ) : (
                <ul className="space-y-1">
                  {analytics.topContractors.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-[13px]">
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono tabular-nums text-xs">{KES(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2">Top categories · last 90d</div>
              {analytics.topCategories.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No sales in the last 90 days.</div>
              ) : (
                <ul className="space-y-1">
                  {analytics.topCategories.map((c) => (
                    <li key={c.category} className="flex items-center justify-between text-[13px]">
                      <span className="truncate">{c.category}</span>
                      <span className="font-mono tabular-nums text-xs">{KES(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-1">Avg quote → sale time</div>
              <div className="font-mono tabular-nums text-2xl">{analytics.avgDaysToConvert.toFixed(1)} days</div>
              <div className="text-[10px] text-muted-foreground mt-1">Converted quotes only</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-1">On-time delivery %</div>
              <div className={cn("font-mono tabular-nums text-2xl", analytics.onTimeDeliveryPct < 75 ? "text-rose-600" : "text-emerald-600")}>{analytics.onTimeDeliveryPct}%</div>
              <div className="text-[10px] text-muted-foreground mt-1">Delivered within 3 days of dispatch</div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {aging && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Aged receivables</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {([
                ["Current", aging.current, "current" as BucketKey],
                ["1–30", aging.d1_30, "d1_30" as BucketKey],
                ["31–60", aging.d31_60, "d31_60" as BucketKey],
                ["61–90", aging.d61_90, "d61_90" as BucketKey],
                ["90+", aging.d90_plus, "d90_plus" as BucketKey],
              ] as const).map(([label, v, k]) => (
                <button
                  key={label}
                  onClick={() => setReportBucket(k)}
                  className="rounded-md border border-border p-2.5 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="font-mono tabular-nums text-sm mt-1">{KES(v)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <AgingBucketSheet open={reportBucket !== null} onClose={() => setReportBucket(null)} bucket={reportBucket} />
    </div>
  );
}

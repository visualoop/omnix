import { useEffect, useState } from "react";
import { Heart, Banknote, Smartphone, CreditCard, Users, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getTipsSummary, getTipsByEmployee,
  type TipBreakdown, type TipByEmployee,
} from "@/services/tips";
import { useActiveBranch } from "@/stores/active-branch";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function TipsReportPage() {
  const branchId = useActiveBranch((s) => s.active?.id);
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [summary, setSummary] = useState<TipBreakdown | null>(null);
  const [byEmployee, setByEmployee] = useState<TipByEmployee[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [assignToStaff, setAssignToStaff] = useState(false);
  const [defaultPercents, setDefaultPercents] = useState("5,10,15,20");
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('tips.enabled', 'tips.assign_to_staff', 'tips.default_percentages')`,
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    setEnabled(map["tips.enabled"] === "1");
    setAssignToStaff(map["tips.assign_to_staff"] === "1");
    if (map["tips.default_percentages"]) setDefaultPercents(map["tips.default_percentages"]);
  };

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTipsSummary({ ...period, branchId }),
      getTipsByEmployee({ ...period, branchId }),
    ]).then(([s, e]) => {
      setSummary(s); setByEmployee(e);
    }).finally(() => setLoading(false));
  }, [period, branchId]);

  const updateSetting = async (key: string, value: string) => {
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'pos')
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')`,
      [key, value],
    );
  };

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    await updateSetting("tips.enabled", v ? "1" : "0");
    toast.success(v ? "Tips enabled" : "Tips disabled");
  };

  const toggleAssignToStaff = async (v: boolean) => {
    setAssignToStaff(v);
    await updateSetting("tips.assign_to_staff", v ? "1" : "0");
  };

  const savePercents = async () => {
    await updateSetting("tips.default_percentages", defaultPercents);
    toast.success("Saved");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" /> Tips & Gratuities
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tracked separately from revenue — tips belong to staff, not the business.
        </p>
      </div>

      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold text-sm">Settings</h2>
          <label className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Enable Tips at POS</div>
              <div className="text-xs text-muted-foreground">Cashiers can add a tip to any sale</div>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
          </label>
          {enabled && (
            <>
              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Assign tips to staff</div>
                  <div className="text-xs text-muted-foreground">Cashiers select which employee earned the tip</div>
                </div>
                <Switch checked={assignToStaff} onCheckedChange={toggleAssignToStaff} />
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs flex-1">
                  <div className="font-medium">Default tip percentages</div>
                  <div className="text-muted-foreground">Comma-separated, e.g., 5,10,15,20</div>
                </label>
                <Input
                  value={defaultPercents}
                  onChange={(e) => setDefaultPercents(e.target.value)}
                  onBlur={savePercents}
                  className="w-40 font-mono"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className="h-8 w-36" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className="h-8 w-36" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Total Tips" value={summary ? KES(summary.total_tips) : "—"} icon={Heart} highlight loading={loading} />
        <Stat label="Tipped Sales" value={summary ? String(summary.tip_count) : "—"} icon={Users} loading={loading} />
        <Stat label="Avg Tip" value={summary ? KES(summary.avg_tip) : "—"} icon={Heart} loading={loading} />
        <Stat label="Cash Tips" value={summary ? KES(summary.cash_tips) : "—"} icon={Banknote} loading={loading} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MethodCard label="Cash Tips" value={summary?.cash_tips || 0} total={summary?.total_tips || 0} icon={Banknote} color="text-stone-700" />
        <MethodCard label="M-Pesa Tips" value={summary?.mpesa_tips || 0} total={summary?.total_tips || 0} icon={Smartphone} color="text-emerald-600" />
        <MethodCard label="Card Tips" value={summary?.card_tips || 0} total={summary?.total_tips || 0} icon={CreditCard} color="text-blue-600" />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-sm mb-3">By Staff Member</h2>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Tip Count</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Avg</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={5} rows={3} />
                ) : byEmployee.length === 0 ? (
                  <tr><td colSpan={5} className="p-0">
                    <EmptyState
                      icon={Heart}
                      title="No tips yet"
                      description={enabled ? "Once tips are added at POS, they appear here." : "Enable tips at POS to start tracking."}
                    />
                  </td></tr>
                ) : (
                  byEmployee.map((e) => (
                    <tr key={e.employee_id || "pool"} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs font-medium">{e.employee_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.job_title || "—"}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{e.tip_count}</td>
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums font-semibold text-rose-600">{KES(e.total_tips)}</td>
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-muted-foreground">{KES(e.avg_tip)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, highlight, loading }: any) {
  return (
    <Card className={highlight ? "border-rose-200 bg-rose-50/30" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={`h-3 w-3 ${highlight ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
        </div>
        {loading ? (
          <div className="h-7 bg-muted/30 rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-xl font-semibold font-mono mt-1 ${highlight ? "text-rose-700" : ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MethodCard({ label, value, total, icon: Icon, color }: any) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-3 w-3 ${color}`} />
        </div>
        <div className={`text-base font-semibold font-mono ${color}`}>{KES(value)}</div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[9px] text-muted-foreground">{pct.toFixed(0)}% of total</div>
      </CardContent>
    </Card>
  );
}

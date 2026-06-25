import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Building as Building2,
  Check,
  CircleNotch as Loader2,
  MapPin as MapPin,
  Pencil as Edit3,
  Phone,
  Plus,
  Star,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listBranches, upsertBranch, setDefaultBranch, deactivateBranch,
  type Branch, type BranchWithStats,
} from "@/services/branches";
import { Can } from "@/components/require-role";
import { toast } from "sonner";
import { money } from "@/lib/money";

export function BranchesPage() {
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBranches(await listBranches(showAll)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [showAll]);

  const totalToday = branches.reduce((s, b) => s + b.sales_today, 0);
  const totalCount = branches.reduce((s, b) => s + b.sales_today_count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Branches"
        description="Your shop locations. Every sale, expense, and stock entry is tagged with the branch where it happened."
        actions={
          <Can permission="settings.business">
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New branch
            </Button>
          </Can>
        }
      />

      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Active branches" value={String(branches.filter((b) => b.active === 1).length)} />
        <Stat label="Sales today" value={money(totalToday)} />
        <Stat label="Transactions today" value={String(totalCount)} />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="rounded" />
        Show inactive
      </label>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0,1,2].map((i) => <Card key={i} className="h-[160px] animate-pulse bg-muted/20" />)}
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your first branch to start tracking sales by location."
          cta={{ label: "Add Branch", onClick: () => setCreating(true), icon: Plus }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {branches.map((b) => (
            <Card key={b.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => navigate(`/settings/branches/${b.id}`)}>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                      {b.is_default === 1 && (
                        <Badge variant="secondary" className="text-[9px]">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Default
                        </Badge>
                      )}
                      {b.active === 0 && <Badge variant="destructive" className="text-[9px]">Inactive</Badge>}
                    </div>
                    <h3 className="text-sm font-semibold mt-0.5 truncate">{b.name}</h3>
                  </div>
                  <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); setEditing(b); }}>
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                {(b.address || b.phone) && (
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {b.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.address}</div>}
                    {b.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.phone}</div>}
                  </div>
                )}
                <div className="flex justify-between items-end pt-2 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</div>
                    <div className="font-semibold text-sm font-mono">KES {b.sales_today.toFixed(0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Txns</div>
                    <div className="font-semibold text-sm font-mono">{b.sales_today_count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Users</div>
                    <div className="font-semibold text-sm font-mono">{b.user_count}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BranchForm
        open={creating || !!editing}
        branch={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold font-mono mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function BranchForm({ open, branch, onClose, onSaved }: {
  open: boolean; branch: Branch | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Branch>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (branch) setForm(branch);
    else setForm({ active: 1, timezone: "Africa/Nairobi" });
  }, [branch, open]);

  const save = async () => {
    if (!form.code || !form.name) {
      toast.error("Code and name required");
      return;
    }
    setSubmitting(true);
    try {
      await upsertBranch({ ...form, code: form.code, name: form.name });
      toast.success(branch ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const makeDefault = async () => {
    if (!branch) return;
    await setDefaultBranch(branch.id);
    toast.success(`${branch.name} is now the default`);
    onSaved();
  };

  const deactivate = async () => {
    if (!branch || !(await confirm({ title: `Deactivate "${branch.name}"?` }))) return;
    try {
      await deactivateBranch(branch.id);
      toast.success("Deactivated");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>{branch ? branch.name : "New Branch"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Code *" hint="Short code on receipts">
              <Input
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="MAIN"
                className="font-mono"
              />
            </Field>
            <Field label="Name *" className="col-span-2">
              <Input
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Main Branch"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Open">
              <Input type="time" value={form.open_time || ""} onChange={(e) => setForm({ ...form, open_time: e.target.value })} />
            </Field>
            <Field label="Close">
              <Input type="time" value={form.close_time || ""} onChange={(e) => setForm({ ...form, close_time: e.target.value })} />
            </Field>
          </div>
          <Field label="KRA PIN" hint="Override main TIN if branch has its own">
            <Input value={form.kra_pin || ""} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full min-h-[60px] rounded-md border border-input bg-background p-2 text-[13px]"
            />
          </Field>

          {branch && branch.is_default !== 1 && branch.active === 1 && (
            <Button variant="outline" size="sm" onClick={makeDefault} className="w-full">
              <Star className="h-3.5 w-3.5 mr-1.5" /> Make default
            </Button>
          )}
          {branch && branch.active === 1 && branch.is_default !== 1 && (
            <Button variant="ghost" size="sm" onClick={deactivate} className="w-full text-red-600">
              <X className="h-3.5 w-3.5 mr-1.5" /> Deactivate
            </Button>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, className, children }: {
  label: string; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className || ""}`}>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

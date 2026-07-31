import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Briefcase,
  Building as Building2,
  ChartBar,
  Check,
  CircleNotch as Loader2,
  MagnifyingGlass,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { ResponsiveActions } from "@/components/responsive/responsive-actions";
import { ResponsivePage } from "@/components/responsive/responsive-page";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deactivateBranch,
  getBranch,
  listAssignedBranchPerformance,
  listBranches,
  setDefaultBranch,
  upsertBranch,
  type Branch,
  type BranchWithStats,
} from "@/services/branches";
import { Can } from "@/components/require-role";
import { toast } from "sonner";
import { money } from "@/lib/money";
import { useActiveBranch } from "@/stores/active-branch";
import { useAuthStore } from "@/stores/auth";

export function BranchesPage() {
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const active = useActiveBranch((state) => state.active);
  const available = useActiveBranch((state) => state.available);
  const branchContextLoaded = useActiveBranch((state) => state.loaded);
  const switchTo = useActiveBranch((state) => state.switchTo);
  const user = useAuthStore((state) => state.user);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = user && user.role !== "owner"
        ? await listAssignedBranchPerformance(user.id, showAll)
        : await listBranches(showAll);
      setBranches(rows);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [showAll, user?.id, user?.role]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    let current = true;
    void getBranch(editId).then((branch) => {
      if (!current) return;
      if (branch) setEditing(branch);
      else toast.error("Branch not found");
    });
    return () => {
      current = false;
    };
  }, [searchParams]);

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      [branch.code, branch.name, branch.address, branch.phone]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [branches, search]);

  const totalToday = branches.reduce((sum, branch) => sum + branch.sales_today, 0);
  const totalCount = branches.reduce((sum, branch) => sum + branch.sales_today_count, 0);

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    if (searchParams.has("edit")) {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  };

  const workInBranch = async (branch: BranchWithStats) => {
    const assigned = available.find((candidate) => candidate.id === branch.id);
    if (!assigned) {
      toast.error("This branch is not assigned to your account");
      return;
    }
    try {
      await switchTo(assigned);
      toast.success(`Now working in ${assigned.name}`);
      navigate("/");
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <ResponsivePage width="full" className="!p-0 space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Configuration"
        title="Branches"
        description="Choose where you work, review location performance, or update branch details. Operational context never changes from an analytics action."
        actions={
          <Can permission="settings.business">
            <Button className="min-h-11 sm:min-h-0" onClick={() => setCreating(true)}>
              <Plus /> New branch
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 border-l-2 border-primary bg-foreground/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Active operational context</p>
          <p className="mt-1 truncate text-sm font-semibold">
            {active
              ? `${active.code} · ${active.name}`
              : branchContextLoaded
                ? "No branch assigned"
                : "Loading branch context…"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Sales, stock, and cash activity use this branch.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Active branches" value={String(branches.filter((branch) => branch.active === 1).length)} />
        <Stat label="Sales today" value={money(totalToday)} />
        <Stat label="Transactions today" value={String(totalCount)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Search branches</span>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search branches…" className="pl-9" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs sm:min-h-0">
          <Checkbox checked={showAll} onCheckedChange={(value) => setShowAll(Boolean(value))} />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading branches">
          {[0, 1, 2].map((item) => <Card key={item} className="h-[180px] animate-pulse bg-muted/20 motion-reduce:animate-none" />)}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={Building2}
          title="Branches could not be loaded"
          description="Check the local database connection, then try again."
          cta={{ label: "Retry", onClick: () => void load() }}
        />
      ) : branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your first branch to start tracking sales by location."
          cta={{ label: "Add branch", onClick: () => setCreating(true), icon: Plus }}
        />
      ) : filteredBranches.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlass}
          title="No matching branches"
          description="Try a branch name, code, address, or phone number."
          cta={{ label: "Clear search", onClick: () => setSearch("") }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredBranches.map((branch) => {
            const isActive = active?.id === branch.id;
            const isAssigned = available.some((candidate) => candidate.id === branch.id);
            return (
              <Card key={branch.id} className={isActive ? "border-primary/50" : undefined}>
                <CardContent className="flex h-full flex-col space-y-2.5 p-3 sm:p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{branch.code}</span>
                        {isActive ? <Badge>Active context</Badge> : null}
                        {branch.is_default === 1 ? <Badge variant="secondary"><Star /> Default</Badge> : null}
                        {branch.active === 0 ? <Badge variant="destructive">Inactive</Badge> : null}
                      </div>
                      <h2 className="mt-1 truncate text-sm font-semibold">{branch.name}</h2>
                    </div>
                  </div>

                  {branch.address || branch.phone ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {branch.address ? <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span>{branch.address}</span></div> : null}
                      {branch.phone ? <div className="flex items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{branch.phone}</div> : null}
                    </div>
                  ) : null}

                  <dl className="grid grid-cols-3 gap-2 border-t border-border pt-2">
                    <BranchMetric label="Today" value={money(branch.sales_today)} />
                    <BranchMetric label="Txns" value={String(branch.sales_today_count)} />
                    <BranchMetric label="Users" value={String(branch.user_count)} />
                  </dl>

                  <ResponsiveActions className="mt-auto border-t border-border/60 pt-2 sm:grid sm:w-full sm:grid-cols-3 sm:gap-1">
                    <Button
                      variant={isActive ? "secondary" : "default"}
                      size="sm"
                      className="sm:px-2"
                      disabled={isActive || branch.active === 0 || !isAssigned}
                      onClick={() => void workInBranch(branch)}
                      aria-describedby={!isAssigned ? `branch-${branch.id}-assignment-reason` : undefined}
                    >
                      {isActive ? <Check /> : <Briefcase />}
                      {isActive ? "Working" : "Work"}
                    </Button>
                    {!isAssigned ? (
                      <p id={`branch-${branch.id}-assignment-reason`} className="sr-only">
                        Your account is not assigned to this branch.
                      </p>
                    ) : null}
                    <Button className="sm:px-2" variant="outline" size="sm" onClick={() => navigate(`/settings/branches/${branch.id}`)}>
                      <ChartBar /> View
                    </Button>
                    <Button className="sm:px-2" variant="ghost" size="sm" onClick={() => setEditing(branch)}>
                      <Pencil /> Edit
                    </Button>
                  </ResponsiveActions>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BranchForm
        open={creating || Boolean(editing)}
        branch={editing}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          void load();
        }}
      />
    </ResponsivePage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xl font-semibold">{value}</p></CardContent></Card>;
}

function BranchMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="truncate font-mono text-sm font-semibold">{value}</dd></div>;
}

function BranchForm({ open, branch, onClose, onSaved }: { open: boolean; branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Branch>>({});
  const [submitting, setSubmitting] = useState(false);
  const activeBranchId = useActiveBranch((state) => state.active?.id);
  const updateBranch = useActiveBranch((state) => state.updateBranch);

  useEffect(() => {
    setForm(branch ?? { active: 1, timezone: "Africa/Nairobi" });
  }, [branch, open]);

  const save = async () => {
    if (!form.code || !form.name) return void toast.error("Code and name required");
    setSubmitting(true);
    try {
      await upsertBranch({ ...form, code: form.code, name: form.name });
      if (branch) {
        const updatedBranch: Branch = {
          id: branch.id,
          code: form.code,
          name: form.name,
          address: form.address ?? branch.address,
          phone: form.phone ?? branch.phone,
          email: form.email ?? branch.email,
          manager_id: form.manager_id ?? branch.manager_id,
          is_default: form.is_default ?? branch.is_default,
          active: form.active ?? branch.active,
          timezone: form.timezone ?? branch.timezone,
          kra_pin: form.kra_pin ?? branch.kra_pin,
          etims_device_id: form.etims_device_id ?? branch.etims_device_id,
          open_time: form.open_time ?? branch.open_time,
          close_time: form.close_time ?? branch.close_time,
          notes: form.notes ?? branch.notes,
          created_at: branch.created_at,
        };
        updateBranch(updatedBranch);
      }
      toast.success(branch ? "Branch details updated" : "Branch created");
      onSaved();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const makeDefault = async () => {
    if (!branch) return;
    try {
      await setDefaultBranch(branch.id);
      toast.success(`${branch.name} is now the default`);
      onSaved();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const deactivate = async () => {
    if (!branch) return;
    if (branch.id === activeBranchId) {
      toast.error("Switch to another branch before deactivating this one");
      return;
    }
    if (!(await confirm({ title: `Deactivate "${branch.name}"?` }))) return;
    try {
      await deactivateBranch(branch.id);
      toast.success("Branch deactivated");
      onSaved();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const isActiveBranch = branch?.id === activeBranchId;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        className="!inset-y-0 !top-0 w-full max-w-none rounded-none motion-reduce:transition-none sm:w-[460px] sm:max-w-[min(460px,100vw)] sm:rounded-l-lg"
      >
        <SheetHeader>
          <SheetTitle>{branch ? `Edit ${branch.name}` : "New branch"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-auto py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Code *" hint="Short code on receipts">
              <Input
                value={form.code || ""}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="MAIN"
                className="font-mono"
              />
            </Field>
            <Field label="Name *" className="sm:col-span-2">
              <Input
                value={form.name || ""}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Main Branch"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Open">
              <Input type="time" value={form.open_time || ""} onChange={(event) => setForm({ ...form, open_time: event.target.value })} />
            </Field>
            <Field label="Close">
              <Input type="time" value={form.close_time || ""} onChange={(event) => setForm({ ...form, close_time: event.target.value })} />
            </Field>
          </div>
          <Field label="KRA PIN" hint="Override main TIN if branch has its own">
            <Input value={form.kra_pin || ""} onChange={(event) => setForm({ ...form, kra_pin: event.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          {branch && branch.is_default !== 1 && branch.active === 1 ? (
            <Button variant="outline" onClick={makeDefault} className="min-h-11 w-full">
              <Star /> Make default
            </Button>
          ) : null}
          {branch && branch.active === 1 && branch.is_default !== 1 ? (
            <Button
              variant="ghost"
              onClick={deactivate}
              disabled={isActiveBranch}
              title={isActiveBranch ? "Switch to another branch before deactivating this one" : undefined}
              className="min-h-11 w-full text-red-600"
            >
              <X /> {isActiveBranch ? "Working here — cannot deactivate" : "Deactivate"}
            </Button>
          ) : null}
        </div>
        <SheetFooter className="-mx-5 flex-col-reverse pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={save} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Check />} Save details
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${className || ""}`}>
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BackButton } from "@/components/ui/back-button";
import { EntityHero } from "@/components/ui/entity-hero";
import { LazyTabs } from "@/components/ui/lazy-tabs";
import { Button } from "@/components/ui/button";
import { ResponsiveActions } from "@/components/responsive/responsive-actions";
import { ResponsivePage } from "@/components/responsive/responsive-page";
import { getBranch, type Branch } from "@/services/branches";
import { Briefcase, Check, Pencil } from "@phosphor-icons/react";
import { query } from "@/lib/db";
import { money } from "@/lib/money";
import { useActiveBranch } from "@/stores/active-branch";
import { toast } from "sonner";

interface BranchStats {
  user_count: number;
  sales_today: number;
  sales_today_count: number;
  sales_30d: number;
}

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const active = useActiveBranch((state) => state.active);
  const available = useActiveBranch((state) => state.available);
  const switchTo = useActiveBranch((state) => state.switchTo);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getBranch(id),
      query<BranchStats>(
        `SELECT
           (SELECT COUNT(*) FROM user_branches ub
              INNER JOIN users u ON u.id = ub.user_id
              WHERE ub.branch_id = ?1 AND u.active = 1) as user_count,
           COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed'), 0)
             - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) = date('now')), 0) as sales_today,
           (SELECT COUNT(*) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed') as sales_today_count,
           COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days') AND status = 'completed'), 0)
             - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days')), 0) as sales_30d`,
        [id],
      ),
    ])
      .then(([loadedBranch, loadedStats]) => {
        if (!mounted) return;
        setBranch(loadedBranch);
        setStats(loadedStats[0] ?? { user_count: 0, sales_today: 0, sales_today_count: 0, sales_30d: 0 });
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id, reloadToken]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground sm:p-6">Loading branch…</div>;
  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3 p-4 sm:p-6">
        <BackButton fallback="/settings/branches" />
        <p className="text-sm font-medium">Branch details could not be loaded.</p>
        <p className="text-xs text-muted-foreground">Check the local database connection, then try again.</p>
        <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>Retry</Button>
      </div>
    );
  }
  if (!branch) {
    return (
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <BackButton fallback="/settings/branches" />
        <p className="text-sm text-muted-foreground">Branch not found.</p>
      </div>
    );
  }

  const isActiveContext = active?.id === branch.id;
  const assignedBranch = available.find((candidate) => candidate.id === branch.id);
  const workHere = async () => {
    if (!assignedBranch) {
      toast.error("This branch is not assigned to your account");
      return;
    }
    try {
      await switchTo(assignedBranch);
      toast.success(`Now working in ${assignedBranch.name}`);
      navigate("/");
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <ResponsivePage className="!p-0">
      <BackButton fallback="/settings/branches" label="Back to branches" />
      <div className="mt-3 flex w-full max-w-[1280px] flex-col gap-5">
        <Breadcrumbs
          items={[
            { label: "Settings", to: "/settings" },
            { label: "Branches", to: "/settings/branches" },
            { label: branch.name },
          ]}
        />
        <EntityHero
          eyebrow="Branch performance"
          title={branch.name}
          subtitle={
            <span>
              {[branch.code, branch.address].filter(Boolean).join(" · ")}
              {isActiveContext ? <strong className="ml-2 font-medium text-primary">Active operational context</strong> : null}
            </span>
          }
          badges={[
            { label: branch.active ? "Active" : "Closed", variant: branch.active ? "default" : "destructive" },
            ...(branch.is_default ? [{ label: "Default", variant: "outline" as const }] : []),
            ...(isActiveContext ? [{ label: "Working here", variant: "secondary" as const }] : []),
          ]}
          actions={
            <ResponsiveActions>
              <Button
                size="sm"
                disabled={isActiveContext || !assignedBranch || branch.active === 0}
                onClick={() => void workHere()}
                aria-describedby={!assignedBranch ? "branch-assignment-reason" : undefined}
              >
                {isActiveContext ? <Check /> : <Briefcase />}
                {isActiveContext ? "Working here" : "Work in this branch"}
              </Button>
              {!assignedBranch ? (
                <p id="branch-assignment-reason" className="sr-only">
                  Your account is not assigned to this branch.
                </p>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => navigate(`/settings/branches?edit=${branch.id}`)}>
                <Pencil /> Edit details
              </Button>
            </ResponsiveActions>
          }
          stats={[
            { label: "Sales today", value: money(stats?.sales_today ?? 0) },
            { label: "Receipts today", value: stats?.sales_today_count ?? 0 },
            { label: "Sales (30d)", value: money(stats?.sales_30d ?? 0) },
            { label: "Staff", value: stats?.user_count ?? 0 },
          ]}
        />
        <p className="border-l-2 border-foreground/20 pl-3 text-xs leading-relaxed text-muted-foreground">
          Performance views are read-only. Use <strong className="font-medium text-foreground">Work in this branch</strong> to change operational context, or <strong className="font-medium text-foreground">Edit details</strong> to change configuration.
        </p>
        <LazyTabs
          tabs={[
            { id: "overview", label: "Overview", render: () => <OverviewTab branch={branch} /> },
            { id: "hours", label: "Hours", render: () => <HoursTab branch={branch} /> },
            { id: "compliance", label: "Compliance", render: () => <ComplianceTab branch={branch} /> },
          ]}
        />
      </div>
    </ResponsivePage>
  );
}

function OverviewTab({ branch }: { branch: Branch }) {
  return (
    <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Code" value={branch.code} />
      <Field label="Phone" value={branch.phone} />
      <Field label="Email" value={branch.email} />
      <Field label="Timezone" value={branch.timezone} />
      <Field label="Address" value={branch.address} className="md:col-span-2" />
      <Field label="Notes" value={branch.notes} className="md:col-span-2" />
    </dl>
  );
}

function HoursTab({ branch }: { branch: Branch }) {
  return (
    <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Open" value={branch.open_time} />
      <Field label="Close" value={branch.close_time} />
    </dl>
  );
}

function ComplianceTab({ branch }: { branch: Branch }) {
  return (
    <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="KRA PIN" value={branch.kra_pin} />
      <Field label="eTIMS device" value={branch.etims_device_id} />
    </dl>
  );
}

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">
        {value || <span className="text-muted-foreground/60">—</span>}
      </dd>
    </div>
  );
}

/**
 * ServiceJobSheet — the workshop job card.
 *
 * Shows the job against its unit + warranty status, lets the tech edit the
 * diagnosis, add parts (consumed from stock) and labour lines, drive the
 * status, print a job card, and invoice a completed non-warranty job.
 */
import { useEffect, useState, useCallback } from "react";
import {
  CircleNotch as Loader2, MagnifyingGlass as Search, Trash as Trash2,
  ShieldCheck, Wrench, FileText, Plus, CheckCircle, Receipt,
} from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { money as KES } from "@/lib/money";
import { getProducts, type Product } from "@/services/inventory";
import { warrantyState } from "@/services/equipment";
import {
  getServiceJob, updateJobFields, updateJobStatus, completeJob,
  addPart, removePart, addLabour, removeLabour, invoiceJob,
  type ServiceJobDetail, type ServiceStatus,
} from "@/services/service";
import { renderServiceJobCard } from "@/services/service-pdf";
import { useAuthStore } from "@/stores/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const STATUS_STYLE: Record<ServiceStatus, string> = {
  open: "bg-slate-500/10 text-slate-600",
  in_progress: "bg-blue-500/10 text-blue-600",
  awaiting_parts: "bg-amber-500/10 text-amber-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-red-500/10 text-red-600",
  invoiced: "bg-violet-500/10 text-violet-600",
};

export function ServiceJobSheet({ jobId, onClose, onChanged }: {
  jobId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<ServiceJobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [busy, setBusy] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const load = useCallback(() => {
    if (!jobId) return;
    setLoading(true);
    getServiceJob(jobId)
      .then((d) => { setDetail(d); setDiagnosis(d?.job.diagnosis ?? ""); })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => { if (jobId) load(); else setDetail(null); }, [jobId, load]);

  const refresh = () => { load(); onChanged?.(); };

  if (!jobId) return null;
  const job = detail?.job;
  const wState = job ? warrantyState(job.warranty_expiry) : "none";
  const isWarranty = !!job?.is_warranty;
  const editable = job && !["completed", "cancelled", "invoiced"].includes(job.status);

  const saveDiagnosis = async () => {
    if (!job || diagnosis === (job.diagnosis ?? "")) return;
    try { await updateJobFields(job.id, { diagnosis }); refresh(); }
    catch (e) { toast.error(String(e)); }
  };

  const setStatus = async (to: ServiceStatus) => {
    if (!job) return;
    setBusy(true);
    try { await updateJobStatus(job.id, to); refresh(); }
    catch (e) { toast.error(String(e)); }
    finally { setBusy(false); }
  };

  const doComplete = async () => {
    if (!job) return;
    setBusy(true);
    try { await completeJob(job.id); toast.success("Job completed"); refresh(); }
    catch (e) { toast.error(String(e)); }
    finally { setBusy(false); }
  };

  const doInvoice = async () => {
    if (!job || !user) return;
    setBusy(true);
    try {
      const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const invId = await invoiceJob(job.id, { dueDate: due, userId: user.id });
      toast.success("Invoice raised", { action: { label: "View", onClick: () => navigate(`/invoicing/invoice/${invId}`) } });
      refresh();
    } catch (e) { toast.error(String(e)); }
    finally { setBusy(false); }
  };

  const printCard = async () => {
    if (!detail) return;
    try { await renderServiceJobCard(detail); }
    catch (e) { toast.error(String(e)); }
  };

  const total = (job?.parts_total ?? 0) + (job?.labour_total ?? 0);

  return (
    <Sheet open={!!jobId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <span className="font-mono">{job?.job_number ?? "…"}</span>
          </SheetTitle>
        </SheetHeader>

        {loading || !job ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-auto px-1 py-3 space-y-4 text-[13px]">
            {/* Status + warranty */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[job.status])}>{job.status.replace("_", " ")}</Badge>
              <Badge variant="outline" className={cn("text-[10px]", isWarranty ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                <ShieldCheck className="h-3 w-3 mr-1" />{isWarranty ? "Warranty — no charge" : wState === "expired" ? "Warranty expired" : "Chargeable"}
              </Badge>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-0.5">
              <div className="font-medium">{job.product_name}</div>
              <div className="font-mono text-[12px] text-muted-foreground">SN {job.serial_number}</div>
              {job.customer_name ? <div className="text-[11px] text-muted-foreground">{job.customer_name}</div> : null}
              {job.technician_name ? <div className="text-[11px] text-muted-foreground">Tech: {job.technician_name}</div> : null}
            </div>

            {job.reported_fault ? (
              <Section title="Reported fault"><p className="text-muted-foreground whitespace-pre-wrap">{job.reported_fault}</p></Section>
            ) : null}

            <Section title="Diagnosis">
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                onBlur={saveDiagnosis}
                placeholder="Findings + work done…"
                rows={3}
                disabled={!editable}
              />
            </Section>

            {/* Parts */}
            <Section title="Parts" right={<span className="font-mono tabular-nums">{KES(job.parts_total)}</span>}>
              {detail.parts.length === 0 ? <p className="text-[12px] text-muted-foreground">No parts yet.</p> : (
                <div className="space-y-1">
                  {detail.parts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5">
                      <span className="truncate">{p.product_name} <span className="text-muted-foreground">×{p.quantity}</span></span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-[12px]">{KES(p.line_total)}</span>
                        {editable && (
                          <Button variant="ghost" size="icon-xs" onClick={async () => { try { await removePart(p.id); refresh(); } catch (e) { toast.error(String(e)); } }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {editable && <PartAdder jobId={job.id} onAdded={refresh} />}
            </Section>

            {/* Labour */}
            <Section title="Labour" right={<span className="font-mono tabular-nums">{KES(job.labour_total)}</span>}>
              {detail.labour.length === 0 ? <p className="text-[12px] text-muted-foreground">No labour yet.</p> : (
                <div className="space-y-1">
                  {detail.labour.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5">
                      <span className="truncate">{l.description} <span className="text-muted-foreground">({l.hours}h @ {KES(l.rate)})</span></span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-[12px]">{KES(l.line_total)}</span>
                        {editable && (
                          <Button variant="ghost" size="icon-xs" onClick={async () => { try { await removeLabour(l.id); refresh(); } catch (e) { toast.error(String(e)); } }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {editable && <LabourAdder jobId={job.id} onAdded={refresh} />}
            </Section>

            {/* Total */}
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{isWarranty ? "Total (warranty — not charged)" : "Total"}</span>
              <span className="font-mono text-[15px] tabular-nums font-medium">{isWarranty ? KES(0) : KES(total)}</span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={printCard}><FileText className="size-4" /> Job card</Button>
              {job.status === "open" && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("in_progress")}>Start work</Button>}
              {(job.status === "in_progress" || job.status === "awaiting_parts") && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus(job.status === "awaiting_parts" ? "in_progress" : "awaiting_parts")}>
                  {job.status === "awaiting_parts" ? "Resume" : "Await parts"}
                </Button>
              )}
              {["open", "in_progress", "awaiting_parts"].includes(job.status) && (
                <Button size="sm" disabled={busy} onClick={doComplete}><CheckCircle className="size-4" /> Complete</Button>
              )}
              {job.status === "completed" && !isWarranty && !job.invoice_id && (
                <Button size="sm" disabled={busy} onClick={doInvoice}><Receipt className="size-4" /> Invoice</Button>
              )}
              {job.invoice_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/invoicing/invoice/${job.invoice_id}`)}><Receipt className="size-4" /> View invoice</Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function PartAdder({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    let cancelled = false;
    getProducts(search).then((ps) => { if (!cancelled) setResults(ps.slice(0, 8)); });
    return () => { cancelled = true; };
  }, [search]);

  const add = async (p: Product) => {
    setAdding(true);
    try { await addPart(jobId, { product_id: p.id, quantity: 1 }); setSearch(""); setResults([]); onAdded(); }
    catch (e) { toast.error(String(e)); }
    finally { setAdding(false); }
  };

  return (
    <div className="relative mt-1.5">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add a part — search inventory…" className="h-8 text-xs pl-8" disabled={adding} />
      {results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-auto rounded-md border border-border bg-popover shadow-md">
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-accent">
              <span className="truncate">{p.name}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">Stock: {p.stock_qty}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LabourAdder({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const [desc, setDesc] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!desc.trim()) { toast.error("Describe the labour."); return; }
    setAdding(true);
    try {
      await addLabour(jobId, { description: desc.trim(), hours: parseFloat(hours) || 0, rate: parseFloat(rate) || 0 });
      setDesc(""); setHours(""); setRate(""); onAdded();
    } catch (e) { toast.error(String(e)); }
    finally { setAdding(false); }
  };

  return (
    <div className="flex items-end gap-2 mt-1.5">
      <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Labour description" className="h-8 text-xs flex-1" />
      <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hrs" className="h-8 text-xs w-14 text-right tabular-nums" />
      <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate" className="h-8 text-xs w-20 text-right tabular-nums" />
      <Button variant="outline" size="sm" className="h-8" onClick={add} disabled={adding}><Plus className="size-3.5" /></Button>
    </div>
  );
}

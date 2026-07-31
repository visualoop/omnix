import { useEffect, useMemo, useState } from "react";
import { CircleNotch as Loader2, Pencil as Edit3, Plus, Tag, Trash as Trash2 } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { confirm } from "@/components/ui/confirm-dialog";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { hasPermission } from "@/lib/permissions";
import { listBrands, upsertBrand, deactivateBrand, type Brand, type BrandWithStats } from "@/services/retail";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function BrandsPage() {
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, "retail.brands.manage");

  const load = async () => { setLoading(true); try { setBrands(await listBrands(false)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => brands.filter((brand) => !search || [brand.name, brand.country_of_origin].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [brands, search]);
  const brandList = useClientPagination(filtered, 12, search);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between"><div><BackButton fallback="/retail" /><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Tag className="h-5 w-5 text-primary" /> Brands</h1><p className="mt-1 max-w-prose text-sm text-muted-foreground">Organize products by brand, origin, and catalogue coverage.</p></div>{canManage && <Button className="min-h-11" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> New brand</Button>}</div>
      <OperationalContext compact />
      <Input aria-label="Search brands" className="h-11 max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand or country…" />

      {loading ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map((item) => <div key={item} className="h-28 animate-pulse rounded-md bg-muted/30" />)}</div> : filtered.length === 0 ? <Card><CardContent><EmptyState icon={Tag} title={search ? "No matching brands" : "No brands yet"} description={search ? "Try a different brand or country." : "Add a brand to organize products and report on catalogue performance."} cta={!search && canManage ? { label: "Add brand", onClick: () => setCreating(true), icon: Plus } : undefined} /></CardContent></Card> : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Brand cards">{brandList.pageRows.map((brand) => <Card key={brand.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{brand.name}</p><p className="mt-1 text-xs text-muted-foreground">{brand.country_of_origin || "Origin not recorded"}</p></div>{canManage && <Button variant="ghost" className="min-h-11 min-w-11" onClick={() => setEditing(brand)} aria-label={`Edit ${brand.name}`}><Edit3 className="h-4 w-4" /></Button>}</div><div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground"><span className="font-mono text-foreground">{brand.product_count}</span> product{brand.product_count === 1 ? "" : "s"}</div></CardContent></Card>)}</div>
        <PaginationBar list={brandList.pagination} />
      </>}

      <BrandForm open={creating || !!editing} brand={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void load(); }} />
    </div>
  );
}

function BrandForm({ open, brand, onClose, onSaved }: { open: boolean; brand: Brand | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Brand>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setForm(brand || { name: "", active: 1 }); }, [brand, open]);
  const save = async () => { if (!form.name) { toast.error("Name required"); return; } setSubmitting(true); try { await upsertBrand({ ...form, name: form.name }); toast.success(brand ? "Updated" : "Created"); onSaved(); } catch (error) { toast.error(String(error)); } finally { setSubmitting(false); } };
  const remove = async () => { if (!brand || !(await confirm({ title: `Deactivate \"${brand.name}\"?`, description: "Linked products retain their brand reference, but it no longer appears in pickers.", variant: "destructive" }))) return; await deactivateBrand(brand.id); toast.success("Deactivated"); onSaved(); };
  return <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[400px]"><SheetHeader><SheetTitle>{brand ? brand.name : "New brand"}</SheetTitle></SheetHeader><div className="flex-1 space-y-4 overflow-auto"><Field label="Brand name"><Input aria-label="Brand name" value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></Field><Field label="Country of origin"><Input aria-label="Country of origin" value={form.country_of_origin || ""} onChange={(event) => setForm({ ...form, country_of_origin: event.target.value })} placeholder="e.g. Kenya, Uganda, Tanzania" /></Field><Field label="Description"><Textarea aria-label="Description" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional" /></Field>{brand && <Button variant="ghost" className="min-h-11 w-full text-red-600" onClick={() => void remove()}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Deactivate brand</Button>}</div><SheetFooter className="gap-2"><Button variant="outline" className="min-h-11" onClick={onClose} disabled={submitting}>Cancel</Button><Button className="min-h-11" onClick={() => void save()} disabled={submitting}>{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save</Button></SheetFooter></SheetContent></Sheet>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">{label}</p>{children}</div>; }

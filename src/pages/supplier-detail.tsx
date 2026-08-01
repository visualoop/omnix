/** Supplier detail page — /suppliers/:id */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  FileText,
  MagnifyingGlass as Search,
  Package,
  Pencil,
  Plus,
} from "@phosphor-icons/react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BackButton } from "@/components/ui/back-button";
import { EntityHero } from "@/components/ui/entity-hero";
import { LazyTabs } from "@/components/ui/lazy-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import {
  getSupplier,
  listPurchaseOrders,
  type PurchaseOrder,
  type Supplier,
} from "@/services/erp";
import { query } from "@/lib/db";
import { money } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useCountry } from "@/stores/country";

const DETAIL_PAGE_SIZE = 10;

interface SuppliedProduct {
  id: string;
  name: string;
  sku: string | null;
  total_qty: number;
  total_cost: number;
  last_received: string;
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<SuppliedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const countryCode = useCountry((state) => state.code);
  const canCreatePO = hasPermission(user, "purchase_orders.create");
  const canEdit = hasPermission(user, "suppliers.edit");

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      getSupplier(id),
      listPurchaseOrders({ supplier_id: id }),
      query<SuppliedProduct>(
        `SELECT p.id, p.name, p.sku,
                COALESCE(SUM(b.quantity), 0) as total_qty,
                COALESCE(SUM(b.quantity * b.buying_price), 0) as total_cost,
                MAX(b.received_at) as last_received
         FROM batches b
         JOIN stockable_products p ON p.id = b.product_id
         WHERE b.supplier_id = ?1
         GROUP BY p.id, p.name, p.sku
         ORDER BY total_cost DESC
         LIMIT 200`,
        [id],
      ),
    ])
      .then(([supplierRow, purchaseOrders, suppliedProducts]) => {
        if (!mounted) return;
        setSupplier(supplierRow);
        setPos(purchaseOrders);
        setProducts(suppliedProducts);
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading supplier…</div>;
  if (!supplier) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/suppliers" />
        <p className="text-sm text-muted-foreground">Supplier not found.</p>
      </div>
    );
  }

  const totalSpend = pos.reduce((sum, purchaseOrder) => sum + purchaseOrder.total, 0);
  const totalReceived = pos.filter((purchaseOrder) => purchaseOrder.status === "received").length;
  const phoneLabel = countryCode
    ? `Phone (${useCountry.getState().profile()?.phoneCountryCode ?? countryCode})`
    : "Phone";

  return (
    <div className="p-4 sm:p-6">
      <BackButton fallback="/suppliers" label="Back to suppliers" />
      <div className="mx-auto mt-3 flex w-full max-w-[1280px] flex-col gap-5">
        <Breadcrumbs items={[{ label: "Suppliers", to: "/suppliers" }, { label: supplier.name }]} />
        <MobileRouteContext />
        <EntityHero
          eyebrow="Supplier"
          title={supplier.name}
          subtitle={[supplier.contact_person, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "No contact details"}
          badges={supplier.payment_terms ? [{ label: supplier.payment_terms, variant: "outline" as const }] : []}
          actions={
            <>
              {canCreatePO && (
                <Button className="min-h-11 lg:min-h-0" size="sm" variant="outline" onClick={() => navigate(`/purchase-orders/new?supplier=${supplier.id}`)}>
                  <Plus className="size-3.5" /> New PO
                </Button>
              )}
              {canEdit && (
                <Button className="min-h-11 lg:min-h-0" size="sm" variant="outline" onClick={() => navigate("/suppliers")}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
            </>
          }
          stats={[
            { label: "Purchase orders", value: pos.length },
            { label: "Total spend", value: money(totalSpend) },
            {
              label: "Owed",
              value: money(supplier.balance_owed ?? 0),
              tone: (supplier.balance_owed ?? 0) > 0 ? "warning" : "muted",
            },
            { label: "Received POs", value: totalReceived },
          ]}
        />
        <div className="overflow-x-auto pb-1">
          <LazyTabs
            tabs={[
              { id: "overview", label: "Overview", render: () => <OverviewTab supplier={supplier} phoneLabel={phoneLabel} /> },
              { id: "pos", label: "Purchase orders", count: pos.length, render: () => <PoListTab pos={pos} canCreate={canCreatePO} supplierId={supplier.id} /> },
              { id: "products", label: "Products supplied", count: products.length, render: () => <ProductsTab products={products} canCreate={canCreatePO} supplierId={supplier.id} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ supplier, phoneLabel }: { supplier: Supplier; phoneLabel: string }) {
  return (
    <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Contact" value={supplier.contact_person} />
      <Field label={phoneLabel} value={supplier.phone} />
      <Field label="Email" value={supplier.email} />
      <Field label="Payment terms" value={supplier.payment_terms} />
      <Field label="Address" value={supplier.address} className="md:col-span-2" />
      <Field label="Notes" value={supplier.notes} className="md:col-span-2" />
    </dl>
  );
}

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  );
}

function PoListTab({ pos, canCreate, supplierId }: { pos: PurchaseOrder[]; canCreate: boolean; supplierId: string }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? pos.filter((purchaseOrder) => [purchaseOrder.po_number, purchaseOrder.status].some((value) => value?.toLowerCase().includes(term))) : pos;
  }, [pos, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / DETAIL_PAGE_SIZE));
  const rows = filtered.slice((page - 1) * DETAIL_PAGE_SIZE, page * DETAIL_PAGE_SIZE);

  useEffect(() => setPage(1), [search]);

  return (
    <DetailListShell
      search={search}
      onSearch={setSearch}
      placeholder="Search PO number or status…"
      page={page}
      pageCount={pageCount}
      total={filtered.length}
      onPage={setPage}
    >
      {rows.length === 0 ? (
        <ProceduralEmpty
          icon={FileText}
          title={pos.length === 0 ? "No purchase orders yet" : "No purchase orders match this search"}
          description={pos.length === 0 ? "Raise the first purchase order for this supplier." : "Clear the search to see every order."}
          action={pos.length === 0 && canCreate ? { label: "Create first PO", onClick: () => navigate(`/purchase-orders/new?supplier=${supplierId}`) } : { label: "Clear search", onClick: () => setSearch("") }}
        />
      ) : (
        <>
          <div data-mobile-list="supplier-purchase-orders" className="space-y-2 lg:hidden">
            {rows.map((purchaseOrder) => (
              <button key={purchaseOrder.id} type="button" onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}`)} className="min-h-11 w-full rounded-lg border border-border p-4 text-left active:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-mono text-sm font-medium">{purchaseOrder.po_number}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{format(new Date(purchaseOrder.order_date), "d MMM yyyy")} · {purchaseOrder.status}</p></div>
                  <strong className="font-mono text-sm tabular-nums">{money(purchaseOrder.total)}</strong>
                </div>
              </button>
            ))}
          </div>
          <ul data-desktop-table="supplier-purchase-orders" className="hidden flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10 lg:flex">
            {rows.map((purchaseOrder) => (
              <li key={purchaseOrder.id} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]" onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}`)}>
                <div className="flex items-center gap-3"><FileText className="size-4 text-muted-foreground" /><div className="flex flex-col"><span className="text-[13px] font-medium">{purchaseOrder.po_number}</span><span className="text-[11px] capitalize text-muted-foreground">{format(new Date(purchaseOrder.order_date), "d MMM yyyy")} · {purchaseOrder.status}</span></div></div>
                <span className="font-mono text-[13px] tabular-nums">{money(purchaseOrder.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailListShell>
  );
}

function ProductsTab({ products, canCreate, supplierId }: { products: SuppliedProduct[]; canCreate: boolean; supplierId: string }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? products.filter((product) => [product.name, product.sku].some((value) => value?.toLowerCase().includes(term))) : products;
  }, [products, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / DETAIL_PAGE_SIZE));
  const rows = filtered.slice((page - 1) * DETAIL_PAGE_SIZE, page * DETAIL_PAGE_SIZE);

  useEffect(() => setPage(1), [search]);

  return (
    <DetailListShell search={search} onSearch={setSearch} placeholder="Search product or SKU…" page={page} pageCount={pageCount} total={filtered.length} onPage={setPage}>
      {rows.length === 0 ? (
        <ProceduralEmpty
          icon={Package}
          title={products.length === 0 ? "No products received yet" : "No products match this search"}
          description={products.length === 0 ? "Receive a purchase order to build this supplier history." : "Clear the search to see every supplied product."}
          action={products.length === 0 && canCreate ? { label: "Create first PO", onClick: () => navigate(`/purchase-orders/new?supplier=${supplierId}`) } : { label: "Clear search", onClick: () => setSearch("") }}
        />
      ) : (
        <>
          <div data-mobile-list="supplier-products" className="space-y-2 lg:hidden">
            {rows.map((product) => (
              <article key={product.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.sku ?? "No SKU"} · last {format(new Date(product.last_received), "d MMM yyyy")}</p></div><strong className="font-mono text-sm tabular-nums">{money(product.total_cost)}</strong></div>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground"><span className="font-mono text-foreground">{product.total_qty}</span> units received</p>
              </article>
            ))}
          </div>
          <ul data-desktop-table="supplier-products" className="hidden flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10 lg:flex">
            {rows.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-4 px-4 py-3"><div className="flex flex-col"><span className="text-[13px] font-medium">{product.name}</span><span className="text-[11px] text-muted-foreground">{product.sku ?? "—"} · last {format(new Date(product.last_received), "d MMM yyyy")}</span></div><div className="flex items-center gap-4"><span className="font-mono text-[12px] tabular-nums text-muted-foreground">{product.total_qty}</span><span className="font-mono text-[13px] tabular-nums">{money(product.total_cost)}</span></div></li>
            ))}
          </ul>
        </>
      )}
    </DetailListShell>
  );
}

function DetailListShell({ search, onSearch, placeholder, page, pageCount, total, onPage, children }: { search: string; onSearch: (value: string) => void; placeholder: string; page: number; pageCount: number; total: number; onPage: (page: number) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} className="h-11 pl-9 lg:h-9" /></div>
      {children}
      {total > 0 && <LocalPager page={page} pageCount={pageCount} total={total} onPage={onPage} />}
    </div>
  );
}

function LocalPager({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{total} record{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-1"><Button variant="ghost" className="min-h-11 lg:min-h-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button><span className="px-2 font-mono">{page} / {pageCount}</span><Button variant="ghost" className="min-h-11 lg:min-h-0" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</Button></div>
    </div>
  );
}

function ProceduralEmpty({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description: string; action: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center"><Icon className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">{title}</p><p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p><Button variant="outline" className="mt-4 min-h-11" onClick={action.onClick}>{action.label}</Button></div>
  );
}

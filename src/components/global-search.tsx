/**
 * Global cross-entity search (Task 57) — Ctrl+Shift+F.
 * Renders as a modal with instant results across products/customers/suppliers/sales/invoices.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlass, Package, User, Truck, Receipt, FileText } from "@phosphor-icons/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { globalSearch, type SearchHit } from "@/services/platform-extensions";

const ICON: Record<SearchHit["entity_kind"], typeof Package> = {
  product: Package,
  customer: User,
  supplier: Truck,
  sale: Receipt,
  invoice: FileText,
};

const ROUTE: Record<SearchHit["entity_kind"], (id: string) => string> = {
  product: (id) => `/inventory/products/${id}`,
  customer: (id) => `/customers/${id}`,
  supplier: (id) => `/suppliers/${id}`,
  sale: (id) => `/sales/${id}`,
  invoice: (id) => `/invoicing/invoice/${id}`,
};

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Ctrl+Shift+F opens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    setBusy(true);
    const t = setTimeout(() => {
      globalSearch(q).then((r) => {
        setHits(r);
        setBusy(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const handlePick = (h: SearchHit) => {
    navigate(ROUTE[h.entity_kind](h.entity_id));
    setOpen(false);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <MagnifyingGlass className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, customers, sales, invoices…"
            className="border-0 shadow-none focus-visible:ring-0 h-8 px-0"
            autoFocus
          />
          <span className="text-[10.5px] text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5">Ctrl+Shift+F</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {busy && q.trim() ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {q.trim() ? "No results" : "Type to search across every entity"}
            </div>
          ) : (
            hits.map((h) => {
              const Icon = ICON[h.entity_kind];
              return (
                <button
                  key={`${h.entity_kind}:${h.entity_id}`}
                  onClick={() => handlePick(h)}
                  className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/50 last:border-b-0 flex items-center gap-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{h.title}</div>
                    {h.subtitle && <div className="text-[11.5px] text-muted-foreground truncate">{h.subtitle}</div>}
                  </div>
                  <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground shrink-0">
                    {h.entity_kind}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

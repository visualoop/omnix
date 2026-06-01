import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Pill, BarChart3, Settings,
  Search as SearchIcon, Receipt, Truck, Users, FileCheck, Shield,
  RotateCcw, ClipboardCheck, Banknote, FileSpreadsheet, Plus,
  ArrowRight, Loader2, User, Box, FileText,
  Tag, CalendarClock, CalendarPlus, AlertTriangle, TrendingUp,
} from "lucide-react";
import { query } from "@/lib/db";
import { useActiveModule } from "@/stores/active-module";
import { filterByActiveModule, getFeatureModule } from "@/lib/module-features";
import { isModuleEntitled } from "@/stores/entitlements";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PageItem {
  type: "page";
  name: string;
  to: string;
  icon: typeof LayoutDashboard;
  hint?: string;
  keywords?: string;
}

interface ActionItem {
  type: "action";
  name: string;
  to: string;
  icon: typeof Plus;
  hint: string;
}

interface ResultItem {
  type: "result";
  group: string;
  name: string;
  subtitle: string;
  to: string;
  icon: typeof Box;
}

const pages: PageItem[] = [
  { type: "page", name: "Dashboard", to: "/", icon: LayoutDashboard, keywords: "home overview" },
  { type: "page", name: "POS", to: "/pos", icon: ShoppingCart, keywords: "till checkout sale", hint: "F2" },
  { type: "page", name: "Sales History", to: "/sales", icon: Receipt, keywords: "transactions receipts" },
  { type: "page", name: "Returns", to: "/returns", icon: RotateCcw, keywords: "refund" },
  { type: "page", name: "Inventory", to: "/inventory", icon: Package, keywords: "products stock" },
  { type: "page", name: "Purchases", to: "/purchase-orders", icon: Truck, keywords: "PO suppliers ordering" },
  { type: "page", name: "Stock Take", to: "/stock-take", icon: ClipboardCheck, keywords: "audit count physical" },
  { type: "page", name: "Suppliers", to: "/suppliers", icon: Truck, keywords: "vendors" },
  { type: "page", name: "Customers", to: "/customers", icon: Users, keywords: "patients" },
  { type: "page", name: "Pharmacy", to: "/pharmacy", icon: Pill, keywords: "prescriptions Rx dawa" },
  { type: "page", name: "Controlled Register", to: "/pharmacy/controlled-register", icon: Pill, keywords: "narcotic controlled drugs ppb" },
  { type: "page", name: "Cold Chain", to: "/pharmacy/cold-chain", icon: Pill, keywords: "fridge temperature vaccine" },
  { type: "page", name: "AMR Report", to: "/pharmacy/amr", icon: Pill, keywords: "antibiotic resistance surveillance" },
  { type: "page", name: "Reports", to: "/reports", icon: BarChart3, keywords: "analytics" },
  { type: "page", name: "Z-Report", to: "/reports/zreport", icon: FileSpreadsheet, keywords: "end of day shift summary" },
  { type: "page", name: "Cash Register", to: "/cash-register", icon: Banknote, keywords: "till float drawer" },
  { type: "page", name: "Expenses", to: "/expenses", icon: Receipt, keywords: "spend bills" },
  { type: "page", name: "Profit & Loss", to: "/pnl", icon: BarChart3, keywords: "P&L income statement" },
  { type: "page", name: "eTIMS", to: "/etims", icon: FileCheck, keywords: "kra invoices tax" },
  { type: "page", name: "Insurance Claims", to: "/claims", icon: Shield, keywords: "nhif sha" },
  { type: "page", name: "Modules", to: "/settings/modules", icon: Box, keywords: "extensions" },
  { type: "page", name: "Settings", to: "/settings", icon: Settings, keywords: "config" },
  { type: "page", name: "Users", to: "/users", icon: Users, keywords: "staff accounts" },
  { type: "page", name: "Backup", to: "/settings/backup", icon: FileText, keywords: "restore export" },
  { type: "page", name: "Audit Log", to: "/audit", icon: FileText, keywords: "security history" },
  // Retail-only items
  { type: "page", name: "Brands", to: "/retail/brands", icon: Tag, keywords: "manufacturer" },
  { type: "page", name: "Laybys", to: "/retail/laybys", icon: CalendarClock, keywords: "installments deposit" },
  { type: "page", name: "Special Orders", to: "/retail/special-orders", icon: CalendarPlus, keywords: "preorder request" },
  { type: "page", name: "Shrinkage", to: "/retail/shrinkage", icon: AlertTriangle, keywords: "damage theft loss" },
  { type: "page", name: "Retail Insights", to: "/retail/dashboard", icon: TrendingUp, keywords: "brand category performance" },
  { type: "page", name: "License", to: "/settings/license", icon: Shield, keywords: "activate key" },
];

const actions: ActionItem[] = [
  { type: "action", name: "New Sale", to: "/pos", icon: Plus, hint: "Open POS to start a sale" },
  { type: "action", name: "Add Product", to: "/inventory", icon: Plus, hint: "Add to inventory" },
  { type: "action", name: "Add Customer", to: "/customers", icon: Plus, hint: "Create customer record" },
  { type: "action", name: "Add Supplier", to: "/suppliers", icon: Plus, hint: "Create supplier record" },
  { type: "action", name: "New Purchase Order", to: "/purchase-orders/new", icon: Plus, hint: "Order from supplier" },
  { type: "action", name: "New Return", to: "/returns/new", icon: RotateCcw, hint: "Process customer return" },
  { type: "action", name: "Print Z-Report", to: "/reports/zreport", icon: FileSpreadsheet, hint: "End-of-day summary" },
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const activeModule = useActiveModule((s) => s.active);

  // Load recents
  useEffect(() => {
    if (open) {
      try {
        const r = JSON.parse(localStorage.getItem("omnix-cmd-recent") || "[]");
        setRecentItems(Array.isArray(r) ? r.slice(0, 5) : []);
      } catch { setRecentItems([]); }
      setSearch("");
    }
  }, [open]);

  // Hotkey
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Live entity search (debounced)
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const term = `%${search.trim()}%`;
        const [products, customers, suppliers, sales, prescriptions] = await Promise.all([
          query<{ id: string; name: string; sku: string }>(
            `SELECT id, name, sku FROM products WHERE active = 1 AND (name LIKE ?1 OR sku LIKE ?1) LIMIT 6`,
            [term],
          ),
          query<{ id: string; name: string; phone: string | null }>(
            `SELECT id, name, phone FROM customers WHERE active = 1 AND (name LIKE ?1 OR phone LIKE ?1) LIMIT 5`,
            [term],
          ),
          query<{ id: string; name: string }>(
            `SELECT id, name FROM suppliers WHERE active = 1 AND name LIKE ?1 LIMIT 5`,
            [term],
          ),
          query<{ id: string; sale_number: number; total: number; created_at: string }>(
            `SELECT id, sale_number, total, created_at FROM sales WHERE CAST(sale_number AS TEXT) LIKE ?1 OR id LIKE ?1 ORDER BY created_at DESC LIMIT 5`,
            [term],
          ),
          activeModule === "dawa"
            ? query<{ id: string; rx_number: number; patient_name: string }>(
                `SELECT id, rx_number, patient_name FROM prescriptions WHERE patient_name LIKE ?1 OR CAST(rx_number AS TEXT) LIKE ?1 ORDER BY created_at DESC LIMIT 5`,
                [term],
              )
            : Promise.resolve([] as Array<{ id: string; rx_number: number; patient_name: string }>),
        ]);

        const items: ResultItem[] = [
          ...products.map((p) => ({
            type: "result" as const,
            group: "Products",
            name: p.name,
            subtitle: p.sku || "",
            to: `/inventory?product=${p.id}`,
            icon: Package,
          })),
          ...customers.map((c) => ({
            type: "result" as const,
            group: "Customers",
            name: c.name,
            subtitle: c.phone || "",
            to: `/patients/${c.id}`,
            icon: User,
          })),
          ...suppliers.map((s) => ({
            type: "result" as const,
            group: "Suppliers",
            name: s.name,
            subtitle: "",
            to: `/suppliers`,
            icon: Truck,
          })),
          ...sales.map((s) => ({
            type: "result" as const,
            group: "Sales",
            name: `Sale #${s.sale_number}`,
            subtitle: `KES ${s.total.toFixed(0)} · ${new Date(s.created_at).toLocaleDateString()}`,
            to: `/sales?id=${s.id}`,
            icon: Receipt,
          })),
          ...prescriptions.map((rx) => ({
            type: "result" as const,
            group: "Prescriptions",
            name: `Rx #${rx.rx_number} — ${rx.patient_name}`,
            subtitle: "",
            to: `/pharmacy?rx=${rx.id}`,
            icon: Pill,
          })),
        ];
        setResults(items);
      } catch (e) {
        console.error("Command palette search failed", e);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  const trigger = (name: string, to: string) => {
    navigate(to);
    onOpenChange(false);
    // Track recent
    try {
      const r: string[] = JSON.parse(localStorage.getItem("omnix-cmd-recent") || "[]");
      const updated = [name, ...r.filter((x) => x !== name)].slice(0, 5);
      localStorage.setItem("omnix-cmd-recent", JSON.stringify(updated));
    } catch {}
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, ResultItem[]> = {};
    for (const r of results) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    }
    return groups;
  }, [results]);

  if (!open) return null;

  const showSearch = search.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="relative z-50 w-full max-w-[640px] rounded-lg border border-border bg-popover shadow-2xl"
        onKeyDown={(e) => { if (e.key === "Escape") onOpenChange(false); }}
        shouldFilter={!showSearch}
      >
        <div className="flex items-center border-b border-border px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search products, customers, sales, or jump to anything…"
            className="flex h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mr-2" />}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        <Command.List className="max-h-[420px] overflow-auto p-1.5">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            {searching ? "Searching..." : "No results found."}
          </Command.Empty>

          {/* Live entity search results */}
          {showSearch && Object.entries(groupedResults).map(([group, items]) => (
            <Command.Group key={group} heading={group} className="mb-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5">{group}</div>
              {items.map((r) => (
                <Command.Item
                  key={r.to + r.name}
                  value={`${group}-${r.name}-${r.subtitle}`}
                  onSelect={() => trigger(r.name, r.to)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                >
                  <r.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{r.name}</span>
                  {r.subtitle && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.subtitle}</span>
                  )}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </Command.Item>
              ))}
            </Command.Group>
          ))}

          {/* Recents */}
          {!showSearch && recentItems.length > 0 && (
            <Command.Group heading="Recent">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5">Recent</div>
              {recentItems.map((name) => {
                const found = [...pages, ...actions].find((p) => p.name === name);
                if (!found) return null;
                return (
                  <Command.Item
                    key={`recent-${name}`}
                    value={`recent-${name}`}
                    onSelect={() => trigger(name, found.to)}
                    className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <found.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{name}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

          {/* Quick actions */}
          <Command.Group heading="Quick Actions">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5">Quick Actions</div>
            {actions.map((a) => (
              <Command.Item
                key={a.to + a.name}
                value={`action-${a.name}-${a.hint}`}
                onSelect={() => trigger(a.name, a.to)}
                className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <a.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.hint}</span>
              </Command.Item>
            ))}
          </Command.Group>

          {/* Pages */}
          <Command.Group heading="Pages">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5">Pages</div>
            {filterByActiveModule(pages, activeModule)
              .filter((page) => {
                const owner = getFeatureModule(page.to);
                return !owner || isModuleEntitled(owner);
              })
              .map((page) => (
              <Command.Item
                key={page.to}
                value={`${page.name} ${page.keywords || ""}`}
                onSelect={() => trigger(page.name, page.to)}
                className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <page.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{page.name}</span>
                {page.hint && <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">{page.hint}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="border border-border rounded px-1 py-0.5 font-mono">↵</kbd> select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-border rounded px-1 py-0.5 font-mono">↑↓</kbd> navigate
            </span>
          </div>
          <span>Search across all data</span>
        </div>
      </Command>
    </div>
  );
}

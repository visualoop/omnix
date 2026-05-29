import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Minus, Plus, Trash2, Pause, Tag, Pill, ShoppingCart, Sparkles,
  RotateCcw, Banknote, Smartphone, Receipt, Percent,
  X, AlertCircle, TrendingUp, Clock, Package, Zap,
  Calculator, Lock, Unlock, FileText, Heart, Monitor,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { useActiveBranch } from "@/stores/active-branch";
import { useActiveModule } from "@/stores/active-module";
import { getProducts, getCategories, type Product, type Category } from "@/services/inventory";
import { getUomByBarcode } from "@/services/retail";
import { toast } from "sonner";
import {
  getTodaySalesSummary, getPopularProducts, getLowStockProducts, getProductsForCategory,
  type TodaySalesSummary, type PopularProduct,
} from "@/services/pos-helpers";
import { getOpenShift, type CashShift } from "@/services/accounting";
import { PaymentModal } from "@/components/pos/payment-modal";
import { InteractionAlerts } from "@/components/pos/interaction-alerts";
import { HeldSalesDialog } from "@/components/pos/held-sales";
import { DiscountDialog } from "@/components/pos/discount-dialog";
import { CustomerPicker } from "@/components/pos/customer-picker";
import { AllergyAlertBanner } from "@/components/pos/allergy-alert-banner";
import { VariantPickerDialog } from "@/components/pos/variant-picker";
import { SubstitutionsDialog } from "@/components/pos/substitutions-dialog";
import { OpenShiftDialog, CloseShiftDialog, PettyCashDialog } from "@/components/pos/cash-dialogs";
import { TipDialog } from "@/components/pos/tip-dialog";
import { openCustomerDisplay } from "@/lib/customer-display";
import { countHeldSales } from "@/services/held-sales";
import { categoryColor, stockColor } from "@/lib/category-colors";
import { useNavigate } from "react-router-dom";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Module-aware accent palette so Dawa feels different from Retail. */
function useModuleAccent() {
  const m = useActiveModule((s) => s.active);
  if (m === "dawa") return {
    pay: "bg-teal-600 hover:bg-teal-700",
    accentText: "text-teal-700",
    accentBg: "bg-teal-50",
    accentRing: "ring-teal-200",
    headerGradient: "from-teal-600 via-emerald-600 to-cyan-600",
    isPharmacy: true,
    isRetail: false,
  };
  if (m === "retail") return {
    pay: "bg-orange-600 hover:bg-orange-700",
    accentText: "text-orange-700",
    accentBg: "bg-orange-50",
    accentRing: "ring-orange-200",
    headerGradient: "from-orange-600 via-amber-500 to-rose-500",
    isPharmacy: false,
    isRetail: true,
  };
  return {
    pay: "bg-amber-600 hover:bg-amber-700",
    accentText: "text-amber-700",
    accentBg: "bg-amber-50",
    accentRing: "ring-amber-200",
    headerGradient: "from-amber-600 via-yellow-500 to-orange-500",
    isPharmacy: false,
    isRetail: false,
  };
}

export function POSPage() {
  const navigate = useNavigate();
  const accent = useModuleAccent();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [popular, setPopular] = useState<PopularProduct[]>([]);
  const [byCategory, setByCategory] = useState<PopularProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState<TodaySalesSummary | null>(null);
  const [shift, setShift] = useState<CashShift | null>(null);
  const [lowStock, setLowStock] = useState<Array<{ id: string; name: string; stock_qty: number; reorder_level: number }>>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [subFor, setSubFor] = useState<Product | null>(null);
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [pendingVariantPick, setPendingVariantPick] = useState<Product | null>(null);
  const [now, setNow] = useState(new Date());
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [pettyCashDialog, setPettyCashDialog] = useState(false);
  const [tipDialog, setTipDialog] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { items, addItem, removeItem, updateQty, clear, subtotal, taxTotal, grandTotal, discount, discountType, cartDiscountAmount } = useCartStore();
  const customerId = useCartStore((s) => s.customerId);
  const tip = useCartStore((s) => s.tip);
  const user = useAuthStore((s) => s.user);
  const branch = useActiveBranch((s) => s.active);
  const activeModule = useActiveModule((s) => s.active);

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Load context data
  useEffect(() => {
    Promise.all([
      getCategories(),
      getPopularProducts(24),
      getLowStockProducts(8),
      user?.id ? getOpenShift(user.id) : Promise.resolve(null),
      getTodaySalesSummary(),
    ]).then(([cats, pop, low, sh, today]) => {
      setCategories(cats);
      setPopular(pop);
      setLowStock(low);
      setShift(sh);
      setTodayStats(today);
    });
  }, [user?.id]);

  // Refresh today's stats whenever a sale completes (payOpen closes)
  useEffect(() => {
    if (!payOpen) {
      getTodaySalesSummary().then(setTodayStats);
      getLowStockProducts(8).then(setLowStock);
    }
  }, [payOpen]);

  useEffect(() => { countHeldSales().then(setHeldCount); }, [heldOpen, payOpen]);

  // Search products — handles barcode scans for products, variants, and pack/carton barcodes
  useEffect(() => {
    if (search.length === 0) {
      setResults([]);
      return;
    }

    let cancelled = false;
    (async () => {
      // 1) Try carton/pack barcode first (auto-adds with correct qty)
      const uomMatch = await getUomByBarcode(search);
      if (cancelled) return;
      if (uomMatch) {
        // Add product with correct quantity for this pack
        addItem({
          id: uomMatch.product_id,
          name: `${uomMatch.product_name} — ${uomMatch.uom.name}`,
          selling_price: uomMatch.uom.selling_price ?? (uomMatch.base_selling_price * uomMatch.uom.quantity_per),
          tax_rate: 0, // pack price already includes tax
        });
        // For pack pricing, multiply qty
        const packQty = uomMatch.uom.quantity_per;
        if (packQty > 1) {
          // Update the just-added line to reflect the pack quantity
          const lastItem = useCartStore.getState().items[useCartStore.getState().items.length - 1];
          if (lastItem) updateQty(lastItem.id, packQty);
        }
        toast.success(`Added: ${uomMatch.uom.name} (${packQty} units)`);
        setSearch("");
        searchRef.current?.focus();
        return;
      }

      // 2) Fall back to regular product search
      const products = await getProducts(search);
      if (!cancelled) setResults(products);
    })().catch(console.error);

    return () => { cancelled = true; };
  }, [search]);

  // Category filter products
  useEffect(() => {
    if (activeCategoryId === "popular") {
      // Already in popular; clear category filter view
      setByCategory([]);
    } else if (activeCategoryId !== null) {
      getProductsForCategory(activeCategoryId).then(setByCategory);
    } else {
      setByCategory([]);
    }
  }, [activeCategoryId]);

  const handleAddProduct = (p: Product | PopularProduct) => {
    setPendingVariantPick(p as Product);
    setSearch("");
    searchRef.current?.focus();
  };

  // Apply quantity multiplier when a product is added
  useEffect(() => {
    if (qtyMultiplier > 1 && items.length > 0) {
      const lastItem = items[items.length - 1];
      // Only apply once per item add — check if quantity is exactly 1
      if (lastItem.quantity === 1) {
        updateQty(lastItem.id, qtyMultiplier);
        setQtyMultiplier(1); // reset
      }
    }
  }, [items.length]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't interfere when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.key === "F1") { e.preventDefault(); clear(); searchRef.current?.focus(); }
    if (e.key === "F2") { e.preventDefault(); setHeldOpen(true); }
    if (e.key === "F3") { e.preventDefault(); setDiscountOpen(true); }
    if (e.key === "F4") { e.preventDefault(); if (items.length > 0) setPayOpen(true); }
    if (e.key === "Escape") { e.preventDefault(); setSearch(""); searchRef.current?.focus(); }
  }, [items.length, clear]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const displayed: Array<Product | PopularProduct> = search
    ? results
    : activeCategoryId !== null && activeCategoryId !== "popular"
      ? byCategory
      : popular;

  return (
    <div className="flex flex-col h-[calc(100vh-96px)] -m-6 bg-muted/30">
      {/* ─── TOP STATUS BAR ─────────────────────────────────────────── */}
      <div className={`bg-gradient-to-r ${accent.headerGradient} text-white flex-shrink-0`}>
        <div className="px-4 py-2 flex items-center gap-4 text-xs">
          {/* Brand */}
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-4 w-4" />
            <span>POS</span>
            <span className="text-white/60">·</span>
            <span className="text-white/90 font-normal">
              {activeModule === "dawa" ? "Pharmacy" : activeModule === "retail" ? "Retail" : "Standard"}
            </span>
          </div>

          {/* Today's stats */}
          <div className="flex items-center gap-4 text-white/95 ml-2">
            <Stat icon={Receipt} label="Today" value={todayStats ? `${todayStats.count} sales` : "—"} />
            <Stat icon={TrendingUp} label="Revenue" value={todayStats ? KES(todayStats.revenue) : "—"} />
            <Stat icon={Banknote} label="Cash" value={todayStats ? KES(todayStats.cash) : "—"} />
            <Stat icon={Smartphone} label="M-Pesa" value={todayStats ? KES(todayStats.mpesa) : "—"} />
          </div>

          {/* Right: shift, branch, user, time */}
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            {shift ? (
              <button
                onClick={() => setCloseShiftDialog(true)}
                className="flex items-center gap-1 bg-accent/50 hover:bg-accent px-2 py-1 rounded transition cursor-pointer"
                title="Click to close shift / end of day"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Shift open · {KES(shift.opening_balance)}
              </button>
            ) : (
              <button
                onClick={() => setOpenShiftDialog(true)}
                className="flex items-center gap-1 bg-rose-500/30 hover:bg-rose-500/50 px-2 py-1 rounded transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                No shift · Open now
              </button>
            )}
            {branch && (
              <span className="text-white/80">
                <Package className="inline h-3 w-3 mr-1" />
                {branch.name}
              </span>
            )}
            <span className="text-white/80">{user?.full_name}</span>
            <span className="font-mono">
              <Clock className="inline h-3 w-3 mr-1" />
              {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>
        </div>

        {/* Quick action toolbar */}
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          {!shift ? (
            <ActionPill icon={Unlock} label="Open Shift" onClick={() => setOpenShiftDialog(true)} variant="success" />
          ) : (
            <ActionPill icon={Lock} label="Close Day" onClick={() => setCloseShiftDialog(true)} />
          )}
          <ActionPill icon={Pause} label="Park" hotkey="F2" badge={heldCount} onClick={() => setHeldOpen(true)} />
          <ActionPill icon={RotateCcw} label="Returns" onClick={() => navigate("/returns")} />
          <ActionPill icon={Percent} label="Discount" hotkey="F3" onClick={() => setDiscountOpen(true)} disabled={items.length === 0} />
          <ActionPill icon={Banknote} label="Petty Cash" onClick={() => setPettyCashDialog(true)} disabled={!shift} />
          <ActionPill icon={Heart} label="Tip" onClick={() => setTipDialog(true)} disabled={items.length === 0} value={tip > 0 ? `KES ${tip.toFixed(0)}` : undefined} />
          <ActionPill icon={Monitor} label="Customer Display" onClick={() => openCustomerDisplay().catch(console.error)} />
          <ActionPill icon={FileText} label="Z-Report" onClick={() => navigate("/reports/zreport")} />
          <ActionPill icon={Calculator} label="Qty ×N"
            value={qtyMultiplier > 1 ? `×${qtyMultiplier}` : undefined}
            onClick={() => {
              const next = window.prompt("Quantity multiplier (1-99). Next item added will use this quantity.");
              const n = parseInt(next || "1");
              if (n > 0 && n <= 99) setQtyMultiplier(n);
            }}
          />
          <div className="flex-1" />
          <ActionPill icon={Trash2} label="Clear" hotkey="F1" onClick={clear} disabled={items.length === 0} variant="danger" />
        </div>
      </div>

      {/* ─── MAIN GRID ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left rail: Categories */}
        <div className="w-[140px] border-r border-border bg-background flex flex-col flex-shrink-0">
          <CategoryRail
            categories={categories}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
        </div>

        {/* Center: Search + product grid */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Search bar */}
          <div className="p-3 border-b border-border bg-background flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search name, SKU, or scan barcode..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="bg-muted px-1.5 py-0.5 rounded">Esc</kbd> clear
            </span>
          </div>

          {/* Status row */}
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-3">
              {search ? (
                <span className="font-medium">
                  {results.length} match{results.length !== 1 ? "es" : ""} for "{search}"
                </span>
              ) : activeCategoryId !== null && activeCategoryId !== "popular" ? (
                <span className="font-medium">
                  {byCategory.length} in {categories.find((c) => c.id === activeCategoryId)?.name || "category"}
                </span>
              ) : (
                <span className="font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-600" /> Popular last 30 days
                </span>
              )}
              <span className="text-muted-foreground">{displayed.length} shown</span>
            </div>
            {lowStock.length > 0 && (
              <button
                onClick={() => setShowLowStock(!showLowStock)}
                className="flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {lowStock.length} low stock — click to view
              </button>
            )}
          </div>

          {/* Low stock expanded panel */}
          {showLowStock && lowStock.length > 0 && (
            <div className="bg-rose-50 border-b border-rose-200 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-rose-800">Items below reorder level — restock or order</span>
                <button onClick={() => setShowLowStock(false)} className="text-rose-700 hover:text-rose-900">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {lowStock.map((p) => (
                  <div key={p.id} className="bg-background border border-rose-200 rounded p-1.5 text-[11px]">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-rose-700 font-mono tabular-nums">
                      {p.stock_qty} / {p.reorder_level} reorder
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/purchase-orders/new")}
                className="text-xs text-rose-800 underline mt-1.5"
              >
                Create purchase order →
              </button>
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1 overflow-auto p-2">
            {displayed.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {search ? `No products found for "${search}"` : "No products to show"}
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                {displayed.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={() => handleAddProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart panel */}
        <div className="w-[340px] flex flex-col bg-background border-l border-border flex-shrink-0">
          <CartPanel
            accent={accent}
            items={items}
            customerId={customerId}
            heldCount={heldCount}
            shift={shift}
            qtyMultiplier={qtyMultiplier}
            tip={tip}
            subtotal={subtotal()}
            taxTotal={taxTotal()}
            grandTotal={grandTotal()}
            discount={discount}
            discountType={discountType}
            cartDiscountAmount={cartDiscountAmount()}
            onRemoveItem={removeItem}
            onUpdateQty={updateQty}
            onSubFor={setSubFor}
            onPark={() => setHeldOpen(true)}
            onDiscount={() => setDiscountOpen(true)}
            onTip={() => setTipDialog(true)}
            onPay={() => setPayOpen(true)}
            onClear={clear}
          />
        </div>
      </div>

      {/* ─── DIALOGS ────────────────────────────────────────────────── */}
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
      <HeldSalesDialog open={heldOpen} onClose={() => setHeldOpen(false)} />
      <DiscountDialog open={discountOpen} onClose={() => setDiscountOpen(false)} />
      <SubstitutionsDialog open={!!subFor} product={subFor} onClose={() => setSubFor(null)} />
      <OpenShiftDialog
        open={openShiftDialog}
        onClose={() => setOpenShiftDialog(false)}
        onOpened={async () => {
          setOpenShiftDialog(false);
          if (user?.id) setShift(await getOpenShift(user.id));
        }}
      />
      <CloseShiftDialog
        open={closeShiftDialog}
        onClose={() => setCloseShiftDialog(false)}
        onClosed={async () => {
          setCloseShiftDialog(false);
          if (user?.id) setShift(await getOpenShift(user.id));
        }}
      />
      <PettyCashDialog
        open={pettyCashDialog}
        onClose={() => setPettyCashDialog(false)}
        onSaved={() => setPettyCashDialog(false)}
      />
      <TipDialog
        open={tipDialog}
        onClose={() => setTipDialog(false)}
      />
      <VariantPickerDialog
        product={pendingVariantPick}
        onClose={() => setPendingVariantPick(null)}
        onPick={(p, variant) => {
          if (variant) {
            addItem({
              id: variant.id,
              name: `${p.name} — ${variant.variant_name}`,
              selling_price: variant.selling_price ?? p.selling_price,
              tax_rate: p.tax_rate,
            });
          } else {
            addItem({ id: p.id, name: p.name, selling_price: p.selling_price, tax_rate: p.tax_rate });
          }
          setPendingVariantPick(null);
        }}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Stat({ icon: Icon, label, value }: { icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-white/70" />
      <span className="text-white/70">{label}:</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function ActionPill({
  icon: Icon, label, hotkey, badge, value, onClick, disabled, variant = "default",
}: {
  icon: typeof Pause;
  label: string;
  hotkey?: string;
  badge?: number;
  value?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "success";
}) {
  const variantClass =
    variant === "danger" ? "bg-destructive/10 hover:bg-destructive/20 text-destructive" :
    variant === "success" ? "bg-emerald-400/30 hover:bg-emerald-400/50 text-white ring-1 ring-emerald-300/40" :
    "bg-white/15 hover:bg-white/25 text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        ${variantClass}
      `}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {value && <span className="font-mono bg-white/25 px-1.5 rounded">{value}</span>}
      {hotkey && <kbd className="text-[9px] opacity-70">{hotkey}</kbd>}
      {badge !== undefined && badge > 0 && (
        <span className="bg-white text-foreground rounded-full text-[9px] h-4 min-w-[16px] px-1 flex items-center justify-center font-semibold">
          {badge}
        </span>
      )}
    </button>
  );
}

function CategoryRail({ categories, activeId, onSelect }: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex-1 overflow-auto py-1">
      <CategoryButton
        active={activeId === null}
        label="Popular"
        icon={Sparkles}
        color={{ fg: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" }}
        onClick={() => onSelect(null)}
      />
      <div className="border-t border-border my-1" />
      {categories.map((c) => {
        const color = categoryColor(c.id);
        return (
          <CategoryButton
            key={c.id}
            active={activeId === c.id}
            label={c.name}
            color={color}
            onClick={() => onSelect(c.id)}
          />
        );
      })}
    </div>
  );
}

function CategoryButton({ active, label, icon: Icon, color, onClick }: {
  active: boolean;
  label: string;
  icon?: typeof Sparkles;
  color: { fg: string; bg: string; border: string; dot: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 text-[12px] transition border-l-2 ${
        active
          ? `${color.bg} ${color.fg} border-l-current font-semibold`
          : "border-l-transparent hover:bg-stone-50 text-foreground"
      }`}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      ) : (
        <span className={`h-2 w-2 rounded-full ${color.dot} flex-shrink-0`} />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ProductCard({ product, onClick }: {
  product: Product | PopularProduct;
  onClick: () => void;
}) {
  const stock = (product as any).stock_qty || 0;
  const reorder = (product as any).reorder_level || 0;
  const categoryId = (product as any).category_id || null;
  const oos = stock <= 0;
  const sc = stockColor(stock, reorder);
  const cc = categoryColor(categoryId);

  return (
    <button
      onClick={onClick}
      disabled={oos}
      className={`text-left p-2 rounded-md border bg-white transition group relative ${
        oos
          ? "opacity-50 cursor-not-allowed border-rose-200"
          : `${cc.border} hover:bg-stone-50 hover:border-current ${cc.fg} hover:shadow-sm active:scale-[0.98]`
      }`}
    >
      {/* Category dot top-left */}
      <span className={`absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${cc.dot}`} />

      {/* Stock badge top-right */}
      <span className={`absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded ${sc.bg} ${sc.text} font-mono font-semibold uppercase tracking-wider`}>
        {stock}
      </span>

      <div className="mt-3 mb-1.5">
        <div className="text-[12px] font-medium text-foreground line-clamp-2 leading-tight">
          {product.name}
        </div>
      </div>
      <div className="flex justify-between items-end">
        <span className={`text-[9px] uppercase tracking-wider ${cc.fg}`}>
          {(product as any).category_name || "—"}
        </span>
        <span className="font-mono font-bold text-sm">
          {product.selling_price.toFixed(0)}
        </span>
      </div>
    </button>
  );
}

function CartPanel({
  accent, items, customerId, heldCount, shift, qtyMultiplier, tip,
  subtotal, taxTotal, grandTotal, discount, discountType, cartDiscountAmount,
  onRemoveItem, onUpdateQty, onSubFor,
  onPark, onDiscount, onTip, onPay,
}: any) {
  return (
    <>
      {/* Cart header */}
      <div className="px-3 py-2 border-b border-border bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-stone-600" />
          <h2 className="text-sm font-semibold">Cart</h2>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-4 text-[10px]">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {qtyMultiplier > 1 && (
            <Badge className="h-4 text-[10px] bg-violet-600 hover:bg-violet-600">×{qtyMultiplier}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onPark} className="text-xs h-6">
          <Pause className="h-3 w-3 mr-1" /> Park
          {heldCount > 0 && <span className="ml-1 bg-stone-700 text-white rounded-full text-[9px] px-1.5 py-px font-semibold">{heldCount}</span>}
        </Button>
      </div>

      {/* Customer */}
      <div className="px-3 py-2 border-b border-border">
        <CustomerPicker />
      </div>

      {/* Alerts (pharmacy-specific — only in dawa module) */}
      {accent.isPharmacy && (
        <div className="px-3 pt-2 space-y-1.5">
          <InteractionAlerts />
          <AllergyAlertBanner customerId={customerId} productIds={items.map((i: any) => i.product_id)} />
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Cart is empty</p>
            <p className="text-[10px] mt-1">Search or click a product to add</p>
          </div>
        ) : (
          <div>
            {items.map((item: any, idx: number) => (
              <CartLine
                key={item.id}
                idx={idx + 1}
                item={item}
                showSubstitute={accent.isPharmacy}
                onRemove={() => onRemoveItem(item.id)}
                onQty={(q: number) => onUpdateQty(item.id, q)}
                onSub={() => onSubFor({ id: item.id, name: item.name, selling_price: item.unit_price, tax_rate: item.tax_rate })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-border px-3 py-2 space-y-1 bg-stone-50">
        <Row label="Subtotal" value={subtotal.toFixed(2)} />
        {discount > 0 && (
          <Row
            label={`Discount${discountType === "percent" ? ` (${discount}%)` : ""}`}
            value={`-${cartDiscountAmount.toFixed(2)}`}
            color="text-emerald-700"
          />
        )}
        {taxTotal > 0 && <Row label="Tax" value={taxTotal.toFixed(2)} />}
        {tip > 0 && (
          <button
            onClick={onTip}
            className="flex justify-between text-xs text-rose-700 w-full hover:bg-rose-50 rounded px-1 -mx-1"
          >
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
              Tip
            </span>
            <span className="font-mono tabular-nums">+{tip.toFixed(2)}</span>
          </button>
        )}
        <div className={`flex justify-between text-base font-bold pt-1.5 border-t border-stone-300 ${accent.accentText}`}>
          <span>Total</span>
          <span className="font-mono tabular-nums">{KES(grandTotal)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-border space-y-1.5 bg-white">
        <Button
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={onDiscount}
          disabled={items.length === 0}
        >
          <Tag className="h-3 w-3 mr-1.5" />
          {discount > 0
            ? `Discount: ${discountType === "percent" ? discount + "%" : "KES " + discount}`
            : "Add Discount"}
          <kbd className="text-[9px] opacity-60 ml-auto">F3</kbd>
        </Button>
        <Button
          className={`w-full h-12 text-base font-bold text-white ${accent.pay} shadow-md`}
          disabled={items.length === 0 || !shift}
          onClick={onPay}
        >
          <Zap className="h-4 w-4 mr-1.5" />
          Pay {grandTotal > 0 && KES(grandTotal)}
          <kbd className="text-[10px] opacity-80 ml-auto">F4</kbd>
        </Button>
        {!shift && items.length > 0 && (
          <p className="text-[10px] text-rose-600 text-center">Open a cash shift before completing sales</p>
        )}
      </div>
    </>
  );
}

function CartLine({ idx, item, onRemove, onQty, onSub, showSubstitute }: {
  idx: number;
  item: any;
  onRemove: () => void;
  onQty: (q: number) => void;
  onSub: () => void;
  showSubstitute?: boolean;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-stone-100 hover:bg-stone-50 transition group">
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] text-stone-400 font-mono pt-0.5 select-none">{idx}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="text-[12px] font-medium leading-tight pr-2 line-clamp-2">{item.name}</div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              {showSubstitute && (
                <button
                  onClick={onSub}
                  className="text-stone-400 hover:text-violet-600 p-0.5"
                  title="Find substitute"
                >
                  <Pill className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={onRemove}
                className="text-stone-400 hover:text-rose-600 p-0.5"
                title="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onQty(item.quantity - 1)}
                className="h-5 w-5 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="text-[12px] font-mono font-semibold w-8 text-center tabular-nums">
                {item.quantity}
              </span>
              <button
                onClick={() => onQty(item.quantity + 1)}
                className="h-5 w-5 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
              <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                @ {item.unit_price.toFixed(0)}
              </span>
            </div>
            <span className="text-[12px] font-mono font-bold tabular-nums">
              {(item.unit_price * item.quantity).toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color = "" }: { label: string; value: string; color?: string }) {
  return (
    <div className={`flex justify-between text-xs ${color}`}>
      <span className={color ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowCounterClockwise as RotateCcw,
  Calculator as Calculator,
  CaretDoubleLeft as ChevronsLeft,
  Clock,
  DeviceMobile as Smartphone,
  FileText,
  Heart,
  Lightning as Zap,
  Lock,
  LockOpen as Unlock,
  MagnifyingGlass as Search,
  Minus as Minus,
  Money as Banknote,
  Monitor,
  Package,
  Pause,
  Percent,
  Pill,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkle as Sparkles,
  Tag,
  Trash as Trash2,
  TrendUp as TrendingUp,
  WarningCircle as AlertCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/stores/auth";
import { useActiveBranch } from "@/stores/active-branch";
import { useActiveModule } from "@/stores/active-module";
import { useScanner } from "@/hooks/use-scanner";
import { getProducts, getCategories, type Product, type Category } from "@/services/inventory";
import { getUomByBarcode } from "@/services/retail";
import { toast } from "sonner";
import {
  getTodaySalesSummary, getPopularProducts, getLowStockProducts, getProductsForCategory,
  type TodaySalesSummary, type PopularProduct,
} from "@/services/pos-helpers";
import { getOpenShift, type CashShift } from "@/services/accounting";
import { PaymentModal } from "@/components/pos/payment-modal";
import { SaveQuoteSheet } from "@/components/pos/save-quote-sheet";
import { InteractionAlerts } from "@/components/pos/interaction-alerts";
import { HeldSalesDialog } from "@/components/pos/held-sales";
import { ReturnDialog } from "@/components/pos/return-dialog";
import { DiscountDialog } from "@/components/pos/discount-dialog";
import { CustomerPicker } from "@/components/pos/customer-picker";
import { AllergyAlertBanner } from "@/components/pos/allergy-alert-banner";
import { VariantPickerDialog } from "@/components/pos/variant-picker";
import { UnitPickerDialog } from "@/components/pos/unit-picker";
import { listEquipmentProducts, type EquipmentUnit } from "@/services/equipment";
import { moduleTracksSerials } from "@/lib/capabilities";
import { SubstitutionsDialog } from "@/components/pos/substitutions-dialog";
import { QtyMultiplierDialog } from "@/components/pos/qty-multiplier-dialog";
import { OpenShiftDialog, CloseShiftDialog, PettyCashDialog } from "@/components/pos/cash-dialogs";
import { TipDialog } from "@/components/pos/tip-dialog";
import { PromoDialog } from "@/components/pos/promo-dialog";
import { openCustomerDisplay } from "@/lib/customer-display";
import { countHeldSales } from "@/services/held-sales";
import { categoryColor } from "@/lib/category-colors";
import { VARIANT_ACCENT } from "@/lib/variant";
import { useNavigate, useSearchParams } from "react-router-dom";
import { money as KES } from "@/lib/money";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";
import { intlLocale } from "@/lib/intl";


/** Module-aware accent palette so Dawa feels different from Retail. */
function useModuleAccent() {
  const m = useActiveModule((s) => s.active);
  if (m === "dawa") return {
    pay: "bg-emerald-700 hover:bg-emerald-800",
    accentText: "text-emerald-700 dark:text-emerald-400",
    accentBg: "bg-emerald-500/10",
    accentRing: "ring-emerald-500/30",
    headerBg: "bg-emerald-700",
    isPharmacy: true,
    isRetail: false,
  };
  if (m === "retail") return {
    pay: "bg-amber-700 hover:bg-amber-800",
    accentText: "text-amber-700 dark:text-amber-400",
    accentBg: "bg-amber-500/10",
    accentRing: "ring-amber-500/30",
    headerBg: "bg-amber-700",
    isPharmacy: false,
    isRetail: true,
  };
  if (m === "hardware") return {
    pay: "bg-blue-700 hover:bg-blue-800",
    accentText: "text-blue-700 dark:text-blue-400",
    accentBg: "bg-blue-500/10",
    accentRing: "ring-blue-500/30",
    headerBg: "bg-blue-700",
    isPharmacy: false,
    isRetail: false,
  };
  if (m === "hospitality") return {
    pay: "bg-red-700 hover:bg-red-800",
    accentText: "text-red-700 dark:text-red-400",
    accentBg: "bg-red-500/10",
    accentRing: "ring-red-500/30",
    headerBg: "bg-red-700",
    isPharmacy: false,
    isRetail: false,
  };
  if (m === "salon") return {
    pay: "bg-pink-600 hover:bg-pink-700",
    accentText: "text-pink-700 dark:text-pink-400",
    accentBg: "bg-pink-500/10",
    accentRing: "ring-pink-500/30",
    headerBg: "bg-pink-600",
    isPharmacy: false,
    isRetail: false,
  };
  return {
    pay: "bg-primary hover:bg-primary/90",
    accentText: "text-primary",
    accentBg: "bg-accent/10",
    accentRing: "ring-accent",
    headerBg: "bg-primary",
    isPharmacy: false,
    isRetail: false,
  };
}

export function POSSalePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accent = useModuleAccent();
  const countryCode = useCountry((s) => s.code);
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
  const [returnOpen, setReturnOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [subFor, setSubFor] = useState<Product | null>(null);
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [qtyMultiplierOpen, setQtyMultiplierOpen] = useState(false);
  const [pendingVariantPick, setPendingVariantPick] = useState<Product | null>(null);
  const [equipTrackedIds, setEquipTrackedIds] = useState<Set<string>>(new Set());
  const [unitPickerFor, setUnitPickerFor] = useState<Product | null>(null);
  const [now, setNow] = useState(new Date());
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [pettyCashDialog, setPettyCashDialog] = useState(false);
  const [tipDialog, setTipDialog] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    items,
    addItemWithQuantity,
    removeItem,
    updateQty,
    clear,
    subtotal,
    taxTotal,
    grandTotal,
    discount,
    discountType,
    cartDiscountAmount,
    customerId,
    tip,
    serviceChargeAmount,
    sourceType,
    sourceLabel,
    quoteMode,
    setQuoteMode,
    taxMode,
    setTaxMode,
  } = useCartStore(useShallow((s) => ({
    items: s.items,
    addItemWithQuantity: s.addItemWithQuantity,
    removeItem: s.removeItem,
    updateQty: s.updateQty,
    clear: s.clear,
    subtotal: s.subtotal,
    taxTotal: s.taxTotal,
    grandTotal: s.grandTotal,
    discount: s.discount,
    discountType: s.discountType,
    cartDiscountAmount: s.cartDiscountAmount,
    customerId: s.customerId,
    tip: s.tip,
    serviceChargeAmount: s.serviceChargeAmount,
    sourceType: s.sourceType,
    sourceLabel: s.sourceLabel,
    quoteMode: s.quoteMode,
    setQuoteMode: s.setQuoteMode,
    taxMode: s.taxMode,
    setTaxMode: s.setTaxMode,
  })));
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
      import("@/services/tax").then((m) => m.getTaxSettings()),
    ]).then(([cats, pop, low, sh, today, taxSettings]) => {
      setCategories(cats);
      setPopular(pop);
      setLowStock(low);
      setShift(sh);
      setTodayStats(today);
      useCartStore.getState().setTaxMode(taxSettings.mode);
    });
  }, [user?.id]);

  // Sync ?mode=quote from URL with the cart-store quote flag. Land-on
  // and page-refresh both flip the flag; toggling in the ribbon also
  // updates the URL so a shared link would reproduce the mode.
  useEffect(() => {
    const wantsQuote = searchParams.get("mode") === "quote";
    if (wantsQuote !== quoteMode) setQuoteMode(wantsQuote);
  }, [searchParams, quoteMode, setQuoteMode]);

  const [saveQuoteOpen, setSaveQuoteOpen] = useState(false);
  // Refresh today's stats whenever a sale completes (payOpen closes)
  useEffect(() => {
    if (!payOpen) {
      getTodaySalesSummary().then(setTodayStats);
      getLowStockProducts(8).then(setLowStock);
    }
  }, [payOpen]);

  useEffect(() => { countHeldSales().then(setHeldCount); }, [heldOpen, payOpen]);

  // Which products are serial-tracked equipment — so adds route through
  // the unit picker. Loaded once; only relevant in the hardware module.
  useEffect(() => {
    if (!moduleTracksSerials(activeModule)) { setEquipTrackedIds(new Set()); return; }
    listEquipmentProducts().then((ps) => setEquipTrackedIds(new Set(ps.map((p) => p.id)))).catch(() => {});
  }, [activeModule]);

  // Customer price-list resolution (RT-3): when the attached customer changes,
  // re-resolve each cart line's unit price from their assigned price list.
  // Retail/Dawa only — hardware runs its own contractor pricing path.
  useEffect(() => {
    if (activeModule !== "retail") return;
    let cancelled = false;
    (async () => {
      const cart = useCartStore.getState();
      if (cart.items.length === 0) return;
      const { resolvePrice } = await import("@/services/retail");
      for (const line of cart.items) {
        if (line.menu_item_id) continue;
        const resolved = await resolvePrice({
          product_id: line.product_id,
          variant_id: line.variant_id ?? undefined,
          quantity: line.quantity,
          customer_id: cart.customerId ?? undefined,
        });
        if (cancelled) return;
        if (resolved && Math.abs(resolved.price - line.unit_price) > 0.001) {
          useCartStore.getState().setLinePrice(line.id, resolved.price);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [customerId, activeModule]);

  // Stock-cap toast — fires when cart.addItem refused to add past stock.
  useEffect(() => {
    function onBlocked(e: Event) {
      const detail = (e as CustomEvent<{ name: string; stockQty: number; currentQty: number }>).detail;
      if (!detail) return;
      if (detail.stockQty <= 0) {
        toast.error(`${detail.name} is out of stock.`);
      } else {
        toast.error(`${detail.name} — only ${detail.stockQty} in stock. Cart already has ${detail.currentQty}.`);
      }
    }
    window.addEventListener("omnix:cart-stock-blocked", onBlocked);
    return () => window.removeEventListener("omnix:cart-stock-blocked", onBlocked);
  }, []);

  // Global barcode scanner — works even when the search input isn't focused.
  // The hook ignores keystrokes typed into INPUT/TEXTAREA, so normal typing
  // still flows into the search field as before.
  useScanner((payload) => {
    setSearch(payload);
    // Auto-focus the search input after a scan so the user can keep working.
    requestAnimationFrame(() => searchRef.current?.focus());
  });

  // Search products — handles barcode scans for products, variants, and pack/carton barcodes
  useEffect(() => {
    if (search.length === 0) {
      setResults([]);
      return;
    }

    let cancelled = false;
    (async () => {
      // 1) Try carton/pack barcode first (auto-adds with correct qty).
      //    If the retail migration hasn't run on this install, product_uoms
      //    won't exist and this query throws — we swallow it and fall
      //    through to regular product search instead of leaving the user
      //    with a permanently-empty results list.
      let uomMatch: Awaited<ReturnType<typeof getUomByBarcode>> = null;
      try {
        uomMatch = await getUomByBarcode(search);
      } catch (e) {
        // product_uoms table missing on this install (non-retail) — silently
        // skip pack-barcode probing, search by name/sku/barcode below.
        console.debug("[search] uom probe skipped:", e);
      }
      if (cancelled) return;
      if (uomMatch) {
        const packQty = Math.max(1, uomMatch.uom.quantity_per || 1);
        const packPrice = uomMatch.uom.selling_price ?? (uomMatch.base_selling_price * packQty);
        // RT-21: a carton scan adds packQty base units — refuse if the base
        // stock can't cover a full pack (prevents pack-level oversell that the
        // per-line stock cap would only catch after the fact).
        if (packQty > uomMatch.product_stock_qty) {
          toast.error(`Not enough stock for a full ${uomMatch.uom.name} (${packQty} units) — only ${uomMatch.product_stock_qty} on hand`);
          setSearch("");
          searchRef.current?.focus();
          return;
        }
        const { checkPharmacyAdd } = await import("@/services/pharmacy-gate");
        const gate = await checkPharmacyAdd({
          productId: uomMatch.product_id,
          productName: uomMatch.product_name,
          sourceType: useCartStore.getState().sourceType,
          activeModule,
        });
        if (!gate.ok) {
          toast.error(gate.reason || "Cannot sell this item without a prescription");
          setSearch("");
          searchRef.current?.focus();
          return;
        }
        addItemWithQuantity({
          id: uomMatch.product_id,
          name: `${uomMatch.product_name} - ${uomMatch.uom.name}`,
          selling_price: packPrice / packQty,
          tax_rate: 0,
          stock_qty: uomMatch.product_stock_qty,
        }, packQty);
        toast.success(`Added: ${uomMatch.uom.name} (${packQty} units)`);
        setSearch("");
        searchRef.current?.focus();
        return;
      }

      // 2) Regular product search by name / SKU / barcode.
      try {
        const products = await getProducts(search);
        if (cancelled) return;
        setResults(products);
        // Barcode-scan auto-add: if the search term is an exact barcode
        // match on a single product, treat it as a scan and add straight
        // to the cart. This is what a cashier expects when they scan a
        // regular product — no need to also tap the tile. We only fire
        // this for exact-string matches so typing part of a name doesn't
        // accidentally add the wrong SKU.
        const exactMatch = products.find(
          (p) => p.barcode && p.barcode === search,
        );
        if (exactMatch) {
          setPendingVariantPick(exactMatch as Product);
          setSearch("");
          searchRef.current?.focus();
        }
      } catch (e) {
        // Surface the failure so the cashier sees something instead of an
        // empty grid that looks like 'no products match'.
        console.error("[search] getProducts failed:", e);
        if (!cancelled) {
          setResults([]);
          toast.error("Search failed — try again", { id: "search-failed" });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [search, addItemWithQuantity]);

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

  const displayedRaw: Array<Product | PopularProduct> = search
    ? results
    : activeCategoryId !== null && activeCategoryId !== "popular"
      ? byCategory
      : popular;

  // Live stock — refreshed every 2s for products on screen + cart items.
  // Replaces the stale stock_qty captured at fetch time so concurrent
  // tills (LAN sync) and the operator's own edits both reflect quickly.
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const productIds = Array.from(new Set([
      ...displayedRaw.map((p) => p.id),
      ...items.map((i) => i.product_id),
    ]));
    if (productIds.length === 0) return;
    const refresh = async () => {
      try {
        const m = await import("@/services/stock-refresh");
        const fresh = await m.getStockMap(productIds);
        if (!cancelled) setStockMap(fresh);
      } catch {
        // ignore — UI keeps the last-known stock until next tick
      }
    };
    refresh();
    const tick = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(tick); };
    // displayedRaw + items react to length changes; deeper diffs would
    // refetch too aggressively. The 2s tick covers the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedRaw.length, items.length, search, activeCategoryId]);

  // Overlay the live stock map onto the displayed cards.
  const displayed = displayedRaw.map((p) => ({
    ...p,
    stock_qty: stockMap.get(p.id) ?? (p as { stock_qty?: number }).stock_qty ?? 0,
  })) as Array<Product | PopularProduct>;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-muted/30">
      {/* Quote mode ribbon — makes the mode unmissable and lets the
          operator back out to normal POS or straight to the quotations list. */}
      {quoteMode ? (
        <div className="flex items-center gap-3 px-5 py-1.5 text-[12px] bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Quotation mode
          </span>
          <span className="text-amber-900/70 dark:text-amber-200/70">
            nothing will be sold — you'll save a quote instead
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                setQuoteMode(false);
                setSearchParams((p) => { p.delete("mode"); return p; });
              }}
              className="rounded-md px-2 py-0.5 hover:bg-amber-500/20 transition-colors font-medium"
            >
              Exit
            </button>
            <button
              onClick={() => navigate("/hardware/quotations")}
              className="rounded-md px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
            >
              All quotes →
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── TOP STATUS BAR ─────────────────────────────────────────── */}
      <div className="bg-card text-foreground border-b border-border flex-shrink-0">
        <div className="px-5 py-3 flex items-center gap-6 text-xs">
          {/* Exit POS — back to dashboard. The fullscreen mode hides the
              sidebar; without this affordance the cashier has no obvious
              way out except keyboard shortcuts. */}
          <button
            onClick={() => navigate("/")}
            title="Exit POS · back to dashboard"
            className="flex items-center gap-1.5 -ml-2 px-2 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Exit</span>
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 font-semibold pr-1 border-r border-border">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-[13px]">POS</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-foreground/80 font-normal">
              {activeModule === "dawa" ? pharmacyTerm(countryCode) : activeModule === "retail" ? "Retail" : "Standard"}
            </span>
          </div>

          {/* Today's takings — one calm cluster, hairline-separated. */}
          <div className="flex items-stretch gap-4 rounded-lg bg-muted/40 px-3.5 py-1.5 text-foreground">
            <Stat icon={Receipt} label="Today" value={todayStats ? `${todayStats.count} sales` : "—"} />
            <span className="w-px self-stretch bg-border" />
            <Stat icon={TrendingUp} label="Revenue" value={todayStats ? KES(todayStats.revenue) : "—"} />
            <span className="w-px self-stretch bg-border" />
            <Stat icon={Banknote} label="Cash" value={todayStats ? KES(todayStats.cash) : "—"} />
            <span className="w-px self-stretch bg-border" />
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
                Shift open · {KES(shift.opening_balance)}
              </button>
            ) : (
              <button
                onClick={() => setOpenShiftDialog(true)}
                className="flex items-center gap-1 bg-rose-500/30 hover:bg-rose-500/50 px-2 py-1 rounded transition"
              >
                No shift · Open now
              </button>
            )}
            {branch && (
              <span className="text-muted-foreground">
                <Package className="inline h-3 w-3 mr-1" />
                {branch.name}
              </span>
            )}
            <span className="text-muted-foreground">{user?.full_name}</span>
            <span className="font-mono">
              <Clock className="inline h-3 w-3 mr-1" />
              {now.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>
        </div>

        {/* Quick action toolbar */}
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          {/* Shift */}
          {!shift ? (
            <ActionPill icon={Unlock} label="Open Shift" onClick={() => setOpenShiftDialog(true)} variant="success" />
          ) : (
            <ActionPill icon={Lock} label="Close Day" onClick={() => setCloseShiftDialog(true)} />
          )}
          <ToolbarDivider />
          {/* Current sale */}
          <ActionPill icon={Pause} label="Park" hotkey="F2" badge={heldCount} onClick={() => setHeldOpen(true)} />
          <ActionPill icon={Percent} label="Discount" hotkey="F3" onClick={() => setDiscountOpen(true)} disabled={items.length === 0} />
          <ActionPill icon={Tag} label="Promo" onClick={() => setPromoOpen(true)} disabled={items.length === 0} />
          <ActionPill icon={Heart} label="Tip" onClick={() => setTipDialog(true)} disabled={items.length === 0} value={tip > 0 ? KES(tip) : undefined} />
          <ActionPill icon={Calculator} label="Qty ×N"
            value={qtyMultiplier > 1 ? `×${qtyMultiplier}` : undefined}
            onClick={() => setQtyMultiplierOpen(true)}
          />
          <ToolbarDivider />
          {/* Tools */}
          <ActionPill icon={RotateCcw} label="Returns" onClick={() => setReturnOpen(true)} />
          <ActionPill icon={Banknote} label="Petty Cash" onClick={() => setPettyCashDialog(true)} disabled={!shift} />
          <ActionPill icon={Monitor} label="Customer Display" onClick={() => openCustomerDisplay().catch(console.error)} />
          <ActionPill icon={FileText} label="Z-Report" onClick={() => navigate("/reports/zreport")} />
          <div className="flex-1" />
          <ActionPill icon={Trash2} label="Clear" hotkey="F1" onClick={clear} disabled={items.length === 0} variant="danger" />
        </div>
      </div>

      {/* ─── MAIN GRID ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left rail: Categories */}
        <div className="w-[140px] border-r border-border bg-background flex flex-col flex-shrink-0">
          <CategoryRail
            categories={categories}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
        </div>

        {/* Center: Search + product grid */}
        <div
          data-osk-container
          className="flex-1 flex flex-col min-w-0 bg-background"
          style={{ paddingBottom: "var(--osk-height, 0)" }}
        >
          {/* Search bar — icon sits in its own left slot (not floating on
              top of the input). Native flex layout: [icon | input | clear].
              The wrapper owns the border + focus ring so the inner input
              stays borderless and the icon never overlays text. */}
          <div className="px-4 py-3 border-b border-border bg-background flex items-center gap-3">
            <div className="group flex flex-1 items-center gap-2.5 h-10 rounded-md border border-input bg-background pl-3 pr-1.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                placeholder="Search name, SKU, or scan barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  // ESC clears the search text (the global handler bails
                  // on inputs to avoid stealing typing, so we handle it
                  // locally here). Cashiers hit ESC after a mis-scan to
                  // start fresh — must be instant, no dialog.
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setSearch("")
                  }
                }}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-medium placeholder:text-muted-foreground"
                autoFocus
              />
              {search ? (
                <button
                  onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="size-7 grid place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0"
                  title="Clear search (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 text-[10px] text-muted-foreground select-none shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Scanner ready
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground select-none">
              <kbd className="bg-muted border border-border/60 px-1.5 py-0.5 rounded font-mono text-[10px]">Esc</kbd>
              <span className="ml-1">clear</span>
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
            serviceChargeAmount={serviceChargeAmount}
            sourceType={sourceType}
            sourceLabel={sourceLabel}
            subtotal={subtotal()}
            taxTotal={taxTotal()}
            grandTotal={grandTotal()}
            discount={discount}
            discountType={discountType}
            cartDiscountAmount={cartDiscountAmount()}
            taxMode={taxMode}
            setTaxMode={setTaxMode}
            onRemoveItem={removeItem}
            onUpdateQty={updateQty}
            onSubFor={setSubFor}
            onPark={() => setHeldOpen(true)}
            onDiscount={() => setDiscountOpen(true)}
            onTip={() => setTipDialog(true)}
            onPay={() => (quoteMode ? setSaveQuoteOpen(true) : setPayOpen(true))}
            quoteMode={quoteMode}
            onClear={clear}
          />
        </div>
      </div>

      {/* ─── DIALOGS ────────────────────────────────────────────────── */}
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
      <SaveQuoteSheet open={saveQuoteOpen} onClose={() => setSaveQuoteOpen(false)} />
      <HeldSalesDialog open={heldOpen} onClose={() => setHeldOpen(false)} />
      <ReturnDialog open={returnOpen} onClose={() => setReturnOpen(false)} />
      <DiscountDialog open={discountOpen} onClose={() => setDiscountOpen(false)} />
      <PromoDialog open={promoOpen} onClose={() => setPromoOpen(false)} onApply={(amount, type, promo) => {
        useCartStore.getState().setDiscount(amount, type, promo ? { id: promo.id, label: promo.name } : null);
      }} />
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
        onPick={async (p, variant) => {
          // Read freshest stock from live polling map; fall back to
          // whatever came in at click-time. Concurrent tills can no
          // longer oversell — Layer 2 (UI cap with live data).
          const liveProductStock = stockMap.get(p.id) ?? p.stock_qty;

          // Pharmacy gate: refuse POM / controlled adds without an
          // attached prescription. Applies inside the Dawa module only.
          const { checkPharmacyAdd } = await import("@/services/pharmacy-gate");
          const gate = await checkPharmacyAdd({
            productId: p.id,
            productName: p.name,
            sourceType: useCartStore.getState().sourceType,
            activeModule,
          });
          if (!gate.ok) {
            toast.error(gate.reason || "Cannot sell this item without a prescription");
            setPendingVariantPick(null);
            return;
          }

          // Serial-tracked equipment: route to the unit picker instead of a
          // plain add, so the cashier chooses which physical unit is sold.
          if (!variant && equipTrackedIds.has(p.id)) {
            setUnitPickerFor(p);
            setPendingVariantPick(null);
            return;
          }

          if (variant) {
            addItemWithQuantity({
              id: p.id,                                      // PARENT product id (so completeSale can deduct variant stock by joining via the line.variant_id below)
              variant_id: variant.id,                        // discriminator — picks up the right product_variants row at sale time
              name: `${p.name} - ${variant.variant_name}`,
              selling_price: variant.selling_price ?? p.selling_price,
              tax_rate: p.tax_rate,
              stock_qty: variant.stock_qty,
              variant_label: variant.variant_name,
              category_id: (p as any).category_id ?? null,
            }, qtyMultiplier);
          } else {
            addItemWithQuantity({ id: p.id, name: p.name, selling_price: p.selling_price, tax_rate: p.tax_rate, stock_qty: liveProductStock, category_id: (p as any).category_id ?? null }, qtyMultiplier);
          }
          setQtyMultiplier(1);
          setPendingVariantPick(null);
        }}
      />
      <UnitPickerDialog
        open={!!unitPickerFor}
        productId={unitPickerFor?.id ?? null}
        productName={unitPickerFor?.name ?? ""}
        onClose={() => setUnitPickerFor(null)}
        onPick={(unit: EquipmentUnit) => {
          const p = unitPickerFor;
          if (p) {
            addItemWithQuantity({
              id: p.id,
              name: p.name,
              selling_price: p.selling_price,
              tax_rate: p.tax_rate,
              category_id: (p as any).category_id ?? null,
              equipment_unit_id: unit.id,
              serial: unit.serial_number,
            }, 1);
          }
          setUnitPickerFor(null);
        }}
      />
      <QtyMultiplierDialog
        open={qtyMultiplierOpen}
        onClose={() => setQtyMultiplierOpen(false)}
        currentValue={qtyMultiplier}
        onSet={(n) => {
          setQtyMultiplier(n);
          setQtyMultiplierOpen(false);
        }}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Stat({ icon: Icon, label, value }: { icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0">
      <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
      <span className="font-mono text-[12.5px] font-semibold tabular-nums leading-tight">
        {value}
      </span>
    </div>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px self-center bg-border" aria-hidden />;
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
    variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white ring-1 ring-white/25" :
    variant === "success" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
    "bg-muted hover:bg-muted/70 text-foreground";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium transition-all active:scale-[0.97]
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${variantClass}
      `}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {value && <span className="font-mono bg-white/25 px-1.5 py-0.5 rounded text-[11px] tabular-nums">{value}</span>}
      {hotkey && <kbd className="text-[10px] opacity-70 font-mono ml-0.5">{hotkey}</kbd>}
      {badge !== undefined && badge > 0 && (
        <span className="bg-card text-foreground rounded-full text-[10px] h-4 min-w-[18px] px-1 flex items-center justify-center font-semibold">
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
        color={{ fg: "text-accent-foreground", bg: "bg-accent/10", border: "border-accent", dot: "bg-accent" }}
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
      className={`group w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-[13px] transition-all border-l-[3px] ${
        active
          ? `${color.bg} ${color.fg} border-l-current font-semibold shadow-sm`
          : "border-l-transparent hover:bg-accent/40 text-foreground/80 hover:text-foreground"
      }`}
    >
      {Icon ? (
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`} />
      ) : (
        <span className={`h-2.5 w-2.5 rounded-full ${color.dot} flex-shrink-0 ${active ? "ring-2 ring-current/30" : ""}`} />
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
  const buyingPrice = (product as any).buying_price as number | undefined;
  const imagePath = (product as any).image_path as string | null | undefined;
  const categoryName = (product as any).category_name as string | undefined;
  const sellingPrice = product.selling_price;
  const oos = stock <= 0;
  const lowStock = !oos && stock <= reorder;

  // Margin — only computable if we have a positive buying price.
  const hasMargin =
    typeof buyingPrice === "number" && buyingPrice > 0 && sellingPrice > buyingPrice;
  const marginPct = hasMargin ? ((sellingPrice - (buyingPrice as number)) / sellingPrice) * 100 : 0;

  // Stock chip tone. Editorial palette only — no sky/cyan/lilac.
  const stockTone = oos
    ? "bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30"
    : lowStock
      ? "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
      : "bg-foreground/[0.06] text-foreground/70";

  return (
    <button
      onClick={onClick}
      disabled={oos}
      // Editorial card shape: paper-cream surface in light mode, deep stone
      // in dark — never near-black. Hairline border in the module accent,
      // intensifying on hover. Image (or accent-tinted glyph) sits at top;
      // type stack underneath. No category palette, no sky blues.
      style={{
        background: `linear-gradient(180deg, color-mix(in oklab, ${VARIANT_ACCENT} 6%, var(--background) 94%), var(--background))`,
        borderColor: `color-mix(in oklab, ${VARIANT_ACCENT} 22%, transparent)`,
      }}
      className={
        "group relative flex flex-col text-left overflow-hidden rounded-xl border " +
        "transition-all duration-150 antialiased " +
        (oos
          ? "opacity-50 cursor-not-allowed"
          : "hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.99] cursor-pointer")
      }
    >
      {/* Strengthen the border on hover via inline CSS so we can drive it
          from the variant accent without leaking a CSS custom property
          to global scope. */}
      <style>{`.group:hover { box-shadow: 0 1px 0 0 ${VARIANT_ACCENT}33 inset, 0 8px 20px -8px ${VARIANT_ACCENT}33; }`}</style>

      {/* ── Image / glyph block (top ~55% of card height) ─────────── */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePath}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              // Hide so the placeholder block shows through behind it.
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {/* Themed placeholder — sits underneath the image. If image fails
            to load it shows through. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 grid place-items-center"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${VARIANT_ACCENT} 12%, transparent), color-mix(in oklab, ${VARIANT_ACCENT} 4%, transparent))`,
          }}
        >
          <Package
            className="size-12 opacity-30"
            strokeWidth={1.25}
            style={{ color: VARIANT_ACCENT }}
          />
        </div>

        {/* Stock chip — top-right, on top of the image. Margin chip swaps
            in on hover when we have a positive buying price. */}
        <span
          className={
            "absolute top-2 right-2 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums tracking-wider " +
            stockTone +
            (hasMargin && !oos ? " group-hover:opacity-0" : "")
          }
        >
          {oos ? "OUT" : lowStock ? `${stock} LOW` : `${stock}`}
        </span>
        {hasMargin && !oos ? (
          <span
            className="absolute top-2 right-2 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums tracking-wider bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
            title={`Margin ${marginPct.toFixed(0)}% (cost ${(buyingPrice ?? 0).toFixed(0)})`}
          >
            +{marginPct.toFixed(0)}%
          </span>
        ) : null}
      </div>

      {/* ── Type stack (bottom of card) ───────────────────────────── */}
      <div className="flex flex-col gap-1 px-3 pt-2.5 pb-2.5">
        {/* Mono category eyebrow — falls back to "uncategorised" so the
            slot never collapses. */}
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80 truncate">
          {categoryName || "Uncategorised"}
        </span>

        {/* Product name — primary readable surface. 2-line clamp. */}
        <span className="text-[13.5px] font-semibold text-foreground leading-[1.25] tracking-[-0.005em] line-clamp-2">
          {product.name}
        </span>

        {/* Price + small accent rule below for visual cadence */}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span
            aria-hidden
            className="h-[2px] flex-1 rounded-full"
            style={{ background: `${VARIANT_ACCENT}40` }}
          />
          <span className="font-mono font-bold text-[16px] tabular-nums leading-none text-foreground shrink-0">
            {product.selling_price.toFixed(0)}
          </span>
        </div>
      </div>
    </button>
  );
}

function CartPanel({
  accent, items, customerId, heldCount, shift, qtyMultiplier, tip, serviceChargeAmount, sourceType, sourceLabel,
  subtotal, taxTotal, grandTotal, discount, discountType, cartDiscountAmount,
  taxMode, setTaxMode,
  onRemoveItem, onUpdateQty, onSubFor,
  onPark, onDiscount, onTip, onPay,
  quoteMode,
}: any) {
  return (
    <>
      {/* Cart header */}
      <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
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
          {heldCount > 0 && <span className="ml-1 bg-muted-foreground/20 text-white rounded-full text-[9px] px-1.5 py-px font-semibold">{heldCount}</span>}
        </Button>
      </div>

      {sourceLabel && (
        (() => {
          type Banner = { bg: string; label: string; text: string };
          const map: Record<string, Banner> = {
            prescription: { bg: "bg-teal-500/5", label: "Pharmacy Dispense", text: "text-teal-700 dark:text-teal-400" },
            hospitality_order: { bg: "bg-rose-500/5", label: "Hospitality checkout", text: "text-rose-700 dark:text-rose-400" },
            layby: { bg: "bg-amber-500/5", label: "Layby Checkout", text: "text-amber-700 dark:text-amber-400" },
            special_order: { bg: "bg-amber-500/5", label: "Special Order", text: "text-amber-700 dark:text-amber-400" },
            folio: { bg: "bg-indigo-500/5", label: "Folio Settlement", text: "text-indigo-700 dark:text-indigo-400" },
          };
          const banner = map[sourceType ?? ""] ?? { bg: "bg-rose-500/5", label: "Source Checkout", text: "text-rose-700 dark:text-rose-400" };
          return (
            <div className={`px-3 py-2 border-b border-border text-xs ${banner.bg}`}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{banner.label}</div>
              <div className={`font-medium truncate ${banner.text}`}>{sourceLabel}</div>
            </div>
          );
        })()
      )}

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
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-border px-4 py-3 space-y-1.5 bg-muted/30">
        {/* Tax-mode segmented control. Cashier flips between
            inclusive (price already has tax) / exclusive (tax added on top)
            / off (no tax) per sale. The store action recomputes taxTotal +
            grandTotal immediately. */}
        <div className="flex items-center justify-between gap-2 -mt-0.5 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tax</span>
          <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-background">
            {(["off", "inclusive", "exclusive"] as const).map((mode) => {
              const active = taxMode === mode;
              const label = mode === "off" ? "Off" : mode === "inclusive" ? "Incl" : "Excl";
              return (
                <button
                  key={mode}
                  onClick={() => setTaxMode(mode)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-[5px] transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Row label="Subtotal" value={subtotal.toFixed(2)} />
        {discount > 0 && (
          <Row
            label={`Discount${discountType === "percent" ? ` (${discount}%)` : ""}`}
            value={`-${cartDiscountAmount.toFixed(2)}`}
            color="text-emerald-700 dark:text-emerald-400"
          />
        )}
        {taxTotal > 0 && <Row label="Tax" value={taxTotal.toFixed(2)} />}
        {serviceChargeAmount > 0 && (
          <Row label="Service charge" value={`+${serviceChargeAmount.toFixed(2)}`} color="text-rose-700 dark:text-rose-400" />
        )}
        {tip > 0 && (
          <button
            onClick={onTip}
            className="flex justify-between text-xs text-rose-700 dark:text-rose-400 w-full hover:bg-rose-500/10 rounded px-1.5 -mx-1.5 py-0.5 transition"
          >
            <span className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
              Tip
            </span>
            <span className="font-mono tabular-nums">+{tip.toFixed(2)}</span>
          </button>
        )}
        <div className={`flex justify-between items-baseline pt-2 border-t border-border/60`}>
          <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Total</span>
          <span className={`font-mono tabular-nums text-[22px] font-semibold leading-none ${accent.accentText}`}>
            {KES(grandTotal)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border space-y-2 bg-background">
        <Button
          variant="outline"
          className="w-full h-9 text-xs justify-start"
          onClick={onDiscount}
          disabled={items.length === 0}
        >
          <Tag className="h-3.5 w-3.5 mr-2" />
          {discount > 0
            ? `Discount: ${discountType === "percent" ? discount + "%" : KES(discount)}`
            : "Add discount"}
          <kbd className="text-[10px] opacity-60 ml-auto font-mono">F3</kbd>
        </Button>
        <Button
          className={`w-full h-14 text-[16px] font-semibold text-white ${accent.pay} shadow-lg shadow-${accent.shadow}/20 transition-all hover:scale-[1.01] active:scale-[0.99]`}
          disabled={items.length === 0 || !shift}
          onClick={onPay}
        >
          <Zap className="h-5 w-5 mr-2" />
          {quoteMode ? "Save quote" : "Pay"} {grandTotal > 0 && KES(grandTotal)}
          <kbd className="text-[11px] opacity-80 ml-auto font-mono">F4</kbd>
        </Button>
        {!shift && items.length > 0 && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 text-center font-medium">
            Open a cash shift before completing sales
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Cart line — emil-design-eng + frontend-design redesign.
 *
 * What changed from the v0.5.2 polish:
 *   - Index badge dropped. Each line gets a 3px coloured accent strip
 *     on the left edge, hue-stable per category. Visual rhythm comes
 *     from those stripes, not from numbering.
 *   - Product avatar: a 36px rounded square, category-tinted, with the
 *     first letter of the name in display serif. Real product
 *     photography would be better but most Kenyan SMEs don't have it;
 *     a lettermark is a graceful fallback that still feels intentional.
 *   - Qty stepper: 36×36 buttons (was 28). Big enough for a fingertip
 *     on touchscreens; not so big it dominates the row visually.
 *   - Line total: 17px, monospaced, semibold. Per-unit is 11px under it.
 *   - Remove button: visible at 35% opacity by default → 100% on hover.
 *     Always discoverable, never noisy.
 *   - Entrance: motion/react slide-in 6px from right + fade in 220ms.
 *     Exit: fade-out 160ms via AnimatePresence in the parent list.
 */
function CartLine({ idx: _idx, item, onRemove, onQty, onSub, showSubstitute }: {
  idx: number;
  item: any;
  onRemove: () => void;
  onQty: (q: number) => void;
  onSub: () => void;
  showSubstitute?: boolean;
}) {
  const lineTotal = Math.max(0, item.unit_price * item.quantity - (item.discount ?? 0));
  const cc = categoryColor(item.category_id);
  const initial = (item.name || "?").trim().charAt(0).toUpperCase();
  const [qtyEditOpen, setQtyEditOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex items-start gap-2.5 px-3 py-2 border-b border-border/40 transition-colors hover:bg-muted/30"
    >
      {/* Category accent strip — 3px left edge */}
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${cc.dot}`}
      />

      {/* Product avatar */}
      <div
        className={`size-7 shrink-0 rounded-md ${cc.bg} ${cc.fg} grid place-items-center select-none`}
        aria-hidden
      >
        <span style={{ fontFamily: "var(--font-display)" }} className="text-[13px] font-medium leading-none">
          {initial}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Name + remove */}
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13px] font-medium leading-[1.25] text-foreground line-clamp-1">
            {item.name}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
            {showSubstitute && (
              <button
                onClick={onSub}
                className="size-6 grid place-items-center rounded-md text-muted-foreground hover:bg-violet-500/10 hover:text-violet-600 transition active:scale-95"
                title="Find substitute"
              >
                <Pill className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onRemove}
              className="size-6 grid place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition active:scale-95"
              title="Remove from cart"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tag row — discount + tax + variant */}
        {(item.discount > 0 || item.tax_rate > 0 || item.variant_label) && (
          <div className="flex items-center gap-1.5 mt-1">
            {item.variant_label && (
              <span className="inline-flex items-center rounded-sm bg-foreground/[0.04] px-1.5 py-px text-[10px] font-medium text-foreground/70">
                {item.variant_label}
              </span>
            )}
            {item.discount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                −{item.discount.toFixed(0)}
              </span>
            )}
            {item.tax_rate > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {item.tax_rate}%
              </span>
            )}
          </div>
        )}

        {/* Qty stepper + line total */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="inline-flex items-center rounded-md border border-border bg-background overflow-hidden">
            <button
              onClick={() => onQty(item.quantity - 1)}
              className="size-9 grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setQtyEditOpen(true)}
              className="px-2 min-w-[2.75rem] h-9 text-center font-mono text-[14px] font-semibold tabular-nums hover:bg-muted transition"
              aria-label="Type quantity"
              title="Tap to type quantity"
            >
              {item.quantity}
            </button>
            <button
              onClick={() => onQty(item.quantity + 1)}
              className="size-9 grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-right">
            <div className="font-mono text-[17px] font-semibold tabular-nums leading-none text-foreground">
              {lineTotal.toFixed(0)}
            </div>
            <div className="font-mono text-[11px] tabular-nums text-muted-foreground mt-1">
              {item.quantity} × {item.unit_price.toFixed(0)}
            </div>
          </div>
        </div>
      </div>
      <QtyMultiplierDialog
        open={qtyEditOpen}
        onClose={() => setQtyEditOpen(false)}
        currentValue={item.quantity}
        onSet={(n) => { onQty(n); setQtyEditOpen(false); }}
        title="Edit quantity"
        description="Set this line's quantity (1–99)."
      />
    </motion.div>
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

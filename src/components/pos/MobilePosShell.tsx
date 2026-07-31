import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CloudSlash, Package, WifiHigh as Wifi, WifiSlash } from "@phosphor-icons/react";
import { CartSheet } from "@/components/pos/CartSheet";
import { CartSummaryBar } from "@/components/pos/CartSummaryBar";
import { MobilePaymentFlow } from "@/components/pos/MobilePaymentFlow";
import { MobileProductBrowser } from "@/components/pos/MobileProductBrowser";
import { MobileQuantitySheet } from "@/components/pos/MobileQuantitySheet";
import { MobileSearchHeader } from "@/components/pos/MobileSearchHeader";
import type { MobileCartItem, MobilePosAccent, MobilePosCategory, MobilePosProduct } from "@/components/pos/mobile-pos-types";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";
import { getConnectionStatus, type ConnectionStatus } from "@/services/network";

interface MobilePosShellProps {
  formFactor: Exclude<PosFormFactor, "desktop">;
  moduleLabel: string;
  branchName: string;
  accent: MobilePosAccent;
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  products: MobilePosProduct[];
  categories: MobilePosCategory[];
  activeCategoryId: string | null;
  items: MobileCartItem[];
  customerId: string | null;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  discountAmount: number;
  tip: number;
  serviceChargeAmount: number;
  taxMode: "off" | "inclusive" | "exclusive";
  shiftOpen: boolean;
  quoteMode: boolean;
  heldCount: number;
  sourceLabel: string | null;
  paymentOpen: boolean;
  onExit: () => void;
  onSearchChange: (value: string) => void;
  onScanRequest?: () => void;
  onSelectCategory: (id: string | null) => void;
  onAddProduct: (product: MobilePosProduct) => void;
  onUpdateQty: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onSetTaxMode: (mode: "off" | "inclusive" | "exclusive") => void;
  onPark: () => void;
  onReturns: () => void;
  onDiscount: () => void;
  onTip: () => void;
  onClear: () => void;
  onOpenShift: () => void;
  onShiftAction: () => void;
  onCheckout: () => void;
}

export function MobilePosShell({
  formFactor,
  moduleLabel,
  branchName,
  accent,
  search,
  searchRef,
  products,
  categories,
  activeCategoryId,
  items,
  customerId,
  subtotal,
  taxTotal,
  grandTotal,
  discountAmount,
  tip,
  serviceChargeAmount,
  taxMode,
  shiftOpen,
  quoteMode,
  heldCount,
  sourceLabel,
  paymentOpen,
  onExit,
  onSearchChange,
  onScanRequest,
  onSelectCategory,
  onAddProduct,
  onUpdateQty,
  onRemoveItem,
  onSetTaxMode,
  onPark,
  onReturns,
  onDiscount,
  onTip,
  onClear,
  onOpenShift,
  onShiftAction,
  onCheckout,
}: MobilePosShellProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentFlowOpen, setPaymentFlowOpen] = useState(false);
  const [quantityItem, setQuantityItem] = useState<MobileCartItem | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus | null | undefined>(undefined);
  const [browserOnline, setBrowserOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const quantityButtonRef = useRef<HTMLElement>(null);
  const paymentWasOpen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getConnectionStatus()
        .then((status) => { if (!cancelled) setConnection(status); })
        .catch(() => { if (!cancelled) setConnection(null); });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const update = () => setBrowserOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (paymentWasOpen.current && !paymentOpen) {
      requestAnimationFrame(() => cartButtonRef.current?.focus());
    }
    paymentWasOpen.current = paymentOpen;
  }, [paymentOpen]);

  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const connectionOffline = connection != null && connection.mode !== "standalone" && !connection.online;
  const branchSyncLabel = connection === undefined
    ? "Checking branch sync…"
    : connection === null
      ? "Sync status unavailable · sales stay local"
      : connection.mode === "client"
        ? connection.online ? "Branch sync online" : "Branch sync offline · sales stay local"
        : connection.mode === "master"
          ? connection.online ? "Branch hub ready" : "Branch hub stopped · sales stay local"
          : "Local sales ready";
  const syncLabel = browserOnline ? branchSyncLabel : `${branchSyncLabel} · internet offline`;
  const statusProblem = connection === null || !browserOnline || connectionOffline;

  const beginCheckout = () => {
    setCartOpen(false);
    if (quoteMode) onCheckout();
    else setPaymentFlowOpen(true);
  };

  return (
    <div
      className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-background [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-background"
      data-pos-form-factor={formFactor}
    >
      <header
        className="shrink-0 border-b border-border bg-background px-3 pb-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex min-h-12 items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="grid size-11 shrink-0 place-items-center rounded-md active:scale-[0.97] motion-reduce:transform-none"
            aria-label="Exit point of sale"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-foreground text-background"><Package className="size-4" /></span>
              <p className="truncate text-sm font-bold">{moduleLabel} POS</p>
              {quoteMode ? <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">QUOTE</span> : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{branchName}</p>
          </div>
          <button
            type="button"
            onClick={onShiftAction}
            aria-label={shiftOpen ? "Close current cash shift" : "Open cash shift"}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 text-xs font-semibold active:scale-[0.985] motion-reduce:transform-none ${shiftOpen ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}
          >
            {shiftOpen ? "Close shift" : "Open shift"}
          </button>
        </div>
        <div className={`mt-1 flex min-h-6 items-start gap-2 px-1 text-[11px] ${statusProblem ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`} aria-live="polite">
          {!browserOnline ? <CloudSlash className="mt-0.5 size-4 shrink-0" /> : connection === null || connectionOffline ? <WifiSlash className="mt-0.5 size-4 shrink-0" /> : <Wifi className="mt-0.5 size-4 shrink-0" />}
          <span className="line-clamp-2">{syncLabel}</span>
        </div>
      </header>

      <MobileSearchHeader value={search} inputRef={searchRef} onChange={onSearchChange} onScanRequest={onScanRequest} />

      {formFactor === "tablet" ? (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(320px,40%)] overflow-hidden">
          <MobileProductBrowser
            formFactor={formFactor}
            products={products}
            categories={categories}
            activeCategoryId={activeCategoryId}
            search={search}
            onSelectCategory={onSelectCategory}
            onAddProduct={onAddProduct}
          />
          <CartSheet
            open
            embedded
            accent={accent}
            items={items}
            customerId={customerId}
            subtotal={subtotal}
            taxTotal={taxTotal}
            grandTotal={grandTotal}
            discountAmount={discountAmount}
            tip={tip}
            serviceChargeAmount={serviceChargeAmount}
            taxMode={taxMode}
            shiftOpen={shiftOpen}
            quoteMode={quoteMode}
            heldCount={heldCount}
            sourceLabel={sourceLabel}
            onOpenChange={setCartOpen}
            onUpdateQty={onUpdateQty}
            onRemoveItem={onRemoveItem}
            onEditQuantity={(item, trigger) => {
              quantityButtonRef.current = trigger;
              setQuantityItem(item);
            }}
            onSetTaxMode={onSetTaxMode}
            onPark={onPark}
            onReturns={onReturns}
            onDiscount={onDiscount}
            onTip={onTip}
            onClear={onClear}
            onOpenShift={onOpenShift}
            onCheckout={beginCheckout}
          />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MobileProductBrowser
            formFactor={formFactor}
            products={products}
            categories={categories}
            activeCategoryId={activeCategoryId}
            search={search}
            onSelectCategory={onSelectCategory}
            onAddProduct={onAddProduct}
          />
          <CartSummaryBar
            buttonRef={cartButtonRef}
            itemCount={items.length}
            unitCount={unitCount}
            total={grandTotal}
            onOpen={() => setCartOpen(true)}
          />
          <CartSheet
            open={cartOpen}
            accent={accent}
            items={items}
            customerId={customerId}
            subtotal={subtotal}
            taxTotal={taxTotal}
            grandTotal={grandTotal}
            discountAmount={discountAmount}
            tip={tip}
            serviceChargeAmount={serviceChargeAmount}
            taxMode={taxMode}
            shiftOpen={shiftOpen}
            quoteMode={quoteMode}
            heldCount={heldCount}
            sourceLabel={sourceLabel}
            returnFocusRef={cartButtonRef}
            onOpenChange={setCartOpen}
            onUpdateQty={onUpdateQty}
            onRemoveItem={onRemoveItem}
            onEditQuantity={(item, trigger) => {
              quantityButtonRef.current = trigger;
              setQuantityItem(item);
            }}
            onSetTaxMode={onSetTaxMode}
            onPark={onPark}
            onReturns={onReturns}
            onDiscount={onDiscount}
            onTip={onTip}
            onClear={onClear}
            onOpenShift={onOpenShift}
            onCheckout={beginCheckout}
          />
        </main>
      )}

      <MobileQuantitySheet
        open={quantityItem !== null}
        item={quantityItem}
        returnFocusRef={quantityButtonRef}
        onOpenChange={(next) => { if (!next) setQuantityItem(null); }}
        onConfirm={(quantity) => {
          if (quantityItem) onUpdateQty(quantityItem.id, quantity);
        }}
      />
      <MobilePaymentFlow
        open={paymentFlowOpen}
        itemCount={items.length}
        unitCount={unitCount}
        total={grandTotal}
        branchName={branchName}
        syncLabel={syncLabel}
        shiftOpen={shiftOpen}
        returnFocusRef={cartButtonRef}
        onOpenChange={setPaymentFlowOpen}
        onContinueToAuthoritativePayment={onCheckout}
      />
    </div>
  );
}

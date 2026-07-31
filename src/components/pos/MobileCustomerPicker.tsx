import { useRef, useState, type RefObject } from "react";
import { MagnifyingGlass as Search, User, UserPlus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QuickAddCustomerDialog } from "@/components/pos/quick-add-customer";
import { useCustomerSelection } from "@/components/pos/use-customer-selection";

interface MobileCustomerPickerProps {
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileCustomerPicker({ triggerRef }: MobileCustomerPickerProps) {
  const localTriggerRef = useRef<HTMLButtonElement>(null);
  const effectiveTriggerRef = triggerRef ?? localTriggerRef;
  const [open, setOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const {
    activeCustomer,
    search,
    results: allResults,
    setSearch,
    selectCustomer,
    clearCustomer,
  } = useCustomerSelection(open);
  const results = allResults.slice(0, 50);
  const resultCount = allResults.length;

  const close = () => {
    setOpen(false);
    setSearch("");
    requestAnimationFrame(() => effectiveTriggerRef.current?.focus());
  };

  return (
    <>
      <div className="flex min-h-12 w-full items-center rounded-md border border-border bg-background">
        <button
          ref={effectiveTriggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-left active:scale-[0.985] motion-reduce:transform-none"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
            <User className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</span>
            <span className="block truncate text-sm font-semibold">{activeCustomer?.name ?? "Walk-in customer"}</span>
          </span>
          {!activeCustomer ? <span className="text-xs font-medium text-muted-foreground">Change</span> : null}
        </button>
        {activeCustomer ? (
          <button
            type="button"
            onClick={() => clearCustomer()}
            className="mr-1 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground"
            aria-label={`Remove ${activeCustomer.name} from sale`}
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="!inset-0 !h-[100dvh] !max-h-none !w-full !max-w-none !rounded-none !bg-background !backdrop-blur-none motion-reduce:!transition-none [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2"
        >
          <SheetHeader className="pt-[max(1rem,env(safe-area-inset-top))]">
            <SheetTitle>Select customer</SheetTitle>
            <SheetDescription>Search by name, phone, or email. Walk-in remains available.</SheetDescription>
          </SheetHeader>
          <label className="mt-3 flex min-h-12 items-center gap-2 rounded-md border border-input px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="size-5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search customers</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, or email"
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => {
                clearCustomer();
                close();
              }}
              className="flex min-h-14 w-full items-center gap-3 border-b border-border px-2 text-left active:bg-muted"
            >
              <span className="grid size-10 place-items-center rounded-md bg-muted"><User className="size-5" /></span>
              <span className="font-semibold">Walk-in customer</span>
            </button>
            {results.length === 0 ? (
              <div className="grid min-h-48 place-items-center px-6 text-center">
                <div>
                  <p className="text-sm font-semibold">No customers found</p>
                  <p className="mt-1 text-xs text-muted-foreground">Create the customer, then return them to this sale.</p>
                  <Button
                    className="mt-4 h-12"
                    onClick={() => {
                      close();
                      setQuickAddOpen(true);
                    }}
                  >
                    <UserPlus className="mr-2 size-5" /> Add customer
                  </Button>
                </div>
              </div>
            ) : (
              results.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    selectCustomer(customer);
                    close();
                  }}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-border px-2 text-left active:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted font-semibold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{customer.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{customer.phone || customer.email || "No contact saved"}</span>
                  </span>
                  {customer.balance > 0 ? (
                    <span className="font-mono text-xs text-amber-700">owes {customer.balance.toFixed(0)}</span>
                  ) : null}
                </button>
              ))
            )}
            {resultCount > results.length ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Showing 50 of {resultCount}. Refine the search.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Button variant="outline" className="h-12" onClick={close}>Cancel</Button>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => {
                close();
                setQuickAddOpen(true);
              }}
            >
              <UserPlus className="mr-2 size-5" /> New customer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <QuickAddCustomerDialog
        open={quickAddOpen}
        formFactor="phone"
        onClose={() => {
          setQuickAddOpen(false);
          requestAnimationFrame(() => effectiveTriggerRef.current?.focus());
        }}
        onCreated={(customer) => {
          selectCustomer(customer);
          setQuickAddOpen(false);
          requestAnimationFrame(() => effectiveTriggerRef.current?.focus());
        }}
      />
    </>
  );
}

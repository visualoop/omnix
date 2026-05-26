import { useEffect, useState } from "react";
import { User, UserPlus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart";
import { listCustomers, getCustomer, type Customer } from "@/services/erp";
import { QuickAddCustomerDialog } from "@/components/pos/quick-add-customer";

export function CustomerPicker() {
  const { customerId, setCustomer } = useCartStore();
  const [open, setOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (customerId) {
      getCustomer(customerId).then((c) => setActiveCustomer(c));
    } else {
      setActiveCustomer(null);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) listCustomers(search).then(setResults);
  }, [open, search]);

  const select = (c: Customer) => {
    setCustomer(c.id);
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 justify-start text-xs"
        onClick={() => setOpen(true)}
      >
        <User className="h-3.5 w-3.5 mr-1.5" />
        <span className="truncate max-w-[150px]">
          {activeCustomer ? activeCustomer.name : "Walk-in customer"}
        </span>
        {activeCustomer && (
          <span
            className="ml-auto -mr-1 h-5 w-5 hover:bg-accent rounded inline-flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setCustomer(null);
            }}
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-semibold">Select Customer</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, email..."
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No customers found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => select(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent/50"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {(c.phone || c.email) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {c.phone || c.email}
                              </p>
                            )}
                          </div>
                        </div>
                        {c.balance > 0 && (
                          <span className="text-xs text-amber-700 font-mono">
                            owes {c.balance.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setQuickAddOpen(true); }}
                className="w-full"
                size="sm"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add New Customer
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuickAddCustomerDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(c) => setCustomer(c.id)}
      />
    </>
  );
}

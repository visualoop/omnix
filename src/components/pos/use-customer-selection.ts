import { useEffect, useState } from "react";
import { getCustomer, listCustomers, type Customer } from "@/services/erp";
import { useCartStore } from "@/stores/cart";

interface CustomerSelectionState {
  customerId: string | null;
  activeCustomer: Customer | null;
  search: string;
  results: Customer[];
  setSearch: (value: string) => void;
  selectCustomer: (customer: Customer) => void;
  clearCustomer: () => void;
}

/** Shared customer-selection data for desktop and adaptive POS presentations. */
export function useCustomerSelection(open: boolean): CustomerSelectionState {
  const customerId = useCartStore((state) => state.customerId);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setActiveCustomer(null);
      return;
    }

    getCustomer(customerId)
      .then((customer) => {
        if (!cancelled) setActiveCustomer(customer);
      })
      .catch(() => {
        if (!cancelled) setActiveCustomer(null);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    listCustomers(search)
      .then((customers) => {
        if (!cancelled) setResults(customers);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, search]);

  return {
    customerId,
    activeCustomer,
    search,
    results,
    setSearch,
    selectCustomer: (customer) => setCustomer(customer.id),
    clearCustomer: () => setCustomer(null),
  };
}

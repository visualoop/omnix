import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CircleNotch as Loader2,
  FileText,
  MagnifyingGlass as Search,
  Plus,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getProducts, type Product } from "@/services/inventory";
import { listCustomers } from "@/services/erp";
import { createInvoice, createQuotation } from "@/services/invoicing";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface LineItem {
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
}

interface Props {
  type: "invoice" | "quotation";
}

export function NewDocumentPage({ type }: Props) {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [customer, setCustomer] = useState({
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    customer_tax_pin: "",
  });
  const [issueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (type === "invoice" ? 30 : 14));
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<LineItem[]>([]);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    type === "invoice"
      ? "Payment due within 30 days. Late payments incur 1.5% monthly interest."
      : "This quotation is valid for 14 days from issue date.",
  );
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (productSearch) getProducts(productSearch).then(setProducts);
    else setProducts([]);
  }, [productSearch]);

  const searchCustomers = async (q: string) => {
    if (!q.trim()) { setCustomerSuggestions([]); return; }
    const results = await listCustomers(q);
    setCustomerSuggestions(results.slice(0, 5));
  };

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price - i.discount_amount), 0);
  const taxAmount = items.reduce((s, i) => s + (i.quantity * i.unit_price - i.discount_amount) * i.tax_rate / 100, 0);
  const total = subtotal + taxAmount - headerDiscount;

  const addProduct = (p: Product) => {
    setItems([...items, {
      product_id: p.id,
      description: p.name,
      quantity: 1,
      unit: p.unit || "pcs",
      unit_price: p.selling_price,
      tax_rate: p.tax_rate || 0,
      discount_amount: 0,
    }]);
    setProductSearch("");
  };

  const addBlankLine = () => {
    setItems([...items, {
      product_id: null,
      description: "",
      quantity: 1,
      unit: "pcs",
      unit_price: 0,
      tax_rate: 0,
      discount_amount: 0,
    }]);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async () => {
    if (!userId) return;
    if (!customer.customer_name) { toast.error("Customer name required"); return; }
    if (items.length === 0) { toast.error("Add at least one line item"); return; }
    if (items.some((i) => !i.description || i.quantity <= 0)) {
      toast.error("Each line needs a description and qty > 0"); return;
    }

    setSubmitting(true);
    try {
      const data = {
        customer_id: customer.customer_id || undefined,
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone || undefined,
        customer_email: customer.customer_email || undefined,
        customer_address: customer.customer_address || undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        user_id: userId,
        items: items.map((it) => ({
          product_id: it.product_id || undefined,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          tax_rate: it.tax_rate,
          discount_amount: it.discount_amount,
        })),
        discount_amount: headerDiscount,
      };

      let id: string;
      if (type === "invoice") {
        id = await createInvoice({
          ...data,
          customer_tax_pin: customer.customer_tax_pin || undefined,
          due_date: dueDate,
        });
        toast.success("Invoice created");
        navigate(`/invoicing/invoice/${id}`);
      } else {
        id = await createQuotation({
          ...data,
          valid_until: dueDate,
        });
        toast.success("Quotation created");
        navigate(`/invoicing/quotation/${id}`);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/invoicing")} className="mb-2 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          New {type === "invoice" ? "Invoice" : "Quotation"}
        </h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold text-sm">Customer</h2>
          <div className="relative">
            <Input
              value={customer.customer_name}
              onChange={(e) => {
                setCustomer({ ...customer, customer_name: e.target.value, customer_id: "" });
                searchCustomers(e.target.value);
              }}
              placeholder="Customer name (or search existing)"
            />
            {customerSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomer({
                        customer_id: c.id,
                        customer_name: c.name,
                        customer_phone: c.phone || "",
                        customer_email: c.email || "",
                        customer_address: c.address || "",
                        customer_tax_pin: c.tax_pin || "",
                      });
                      setCustomerSuggestions([]);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {c.name} {c.phone && <span className="text-muted-foreground">— {c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={customer.customer_phone}
              onChange={(e) => setCustomer({ ...customer, customer_phone: e.target.value })}
              placeholder="Phone"
            />
            <Input
              value={customer.customer_email}
              onChange={(e) => setCustomer({ ...customer, customer_email: e.target.value })}
              placeholder="Email"
            />
          </div>
          <Input
            value={customer.customer_address}
            onChange={(e) => setCustomer({ ...customer, customer_address: e.target.value })}
            placeholder="Address"
          />
          {type === "invoice" && (
            <Input
              value={customer.customer_tax_pin}
              onChange={(e) => setCustomer({ ...customer, customer_tax_pin: e.target.value })}
              placeholder="KRA PIN (for B2B tax invoice)"
              className="font-mono"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">Line Items</h2>
            <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search to add a product..."
              className="pl-8"
            />
            {productSearch && products.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                {products.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground tabular-nums">KES {p.selling_price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center text-xs text-muted-foreground">
              No items yet. Search above or click below for a custom line.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-right px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16">Qty</th>
                  <th className="text-right px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Unit Price</th>
                  <th className="text-right px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16">Tax %</th>
                  <th className="text-right px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="px-1 py-1">
                      <Input
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="h-7"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={it.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={it.tax_rate}
                        onChange={(e) => updateItem(idx, { tax_rate: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums font-mono pt-2">
                      {((it.quantity * it.unit_price - it.discount_amount) * (1 + it.tax_rate / 100)).toFixed(2)}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <Button variant="ghost" size="icon-xs" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Button variant="outline" size="sm" onClick={addBlankLine} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add custom line
          </Button>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono tabular-nums">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono tabular-nums">{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-muted-foreground">Header discount</span>
              <Input
                type="number"
                value={headerDiscount}
                onChange={(e) => setHeaderDiscount(parseFloat(e.target.value) || 0)}
                className="h-7 w-24 text-right tabular-nums"
              />
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-border pt-2">
              <span>Total</span>
              <span className="font-mono tabular-nums">KES {total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold text-sm">Details</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Issue date</label>
              <Input value={issueDate} disabled />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {type === "invoice" ? "Due date" : "Valid until"}
              </label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
              placeholder="Optional notes for the customer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Terms & Conditions</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/invoicing")}>Cancel</Button>
        <Button onClick={save} disabled={submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Create {type === "invoice" ? "Invoice" : "Quotation"}
        </Button>
      </div>
    </div>
  );
}

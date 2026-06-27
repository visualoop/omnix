import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleNotch as Loader2,
  Lightning as Zap,
  Plus,
  Tag,
  Trash as Trash2,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createProduct, getCategories, type Category } from "@/services/inventory";
import { listBrands, type BrandWithStats } from "@/services/retail";
import { execute } from "@/lib/db";
import { useEffect } from "react";
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  category_id: string;
  brand_id: string;
  buying_price: string;
  selling_price: string;
  stock: string;
  unit: string;
  status: "pending" | "saving" | "saved" | "error";
  error?: string;
}

const blank = (): Row => ({
  id: crypto.randomUUID(),
  name: "",
  category_id: "",
  brand_id: "",
  buying_price: "",
  selling_price: "",
  stock: "",
  unit: "pcs",
  status: "pending",
});

export function QuickAddProductsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 8 }, blank));
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [defaultMarkupPct, setDefaultMarkupPct] = useState(30);

  useEffect(() => {
    getCategories().then(setCategories);
    listBrands(false).then(setBrands);
  }, []);

  const validRows = useMemo(
    () => rows.filter((r) => r.name.trim() && parseFloat(r.selling_price) > 0),
    [rows],
  );

  const update = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((rs) => [...rs, blank()]);
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const clear = () => setRows(Array.from({ length: 8 }, blank));

  // Auto-calculate selling price from buying price + markup when buying changes
  const applyMarkup = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    const buying = parseFloat(r.buying_price);
    if (!isNaN(buying) && buying > 0) {
      const selling = (buying * (1 + defaultMarkupPct / 100)).toFixed(0);
      update(id, { selling_price: selling });
    }
  };

  const saveAll = async () => {
    if (validRows.length === 0) {
      toast.error("Add at least one product with name and selling price");
      return;
    }
    setSubmitting(true);
    let saved = 0;
    let failed = 0;

    for (const row of validRows) {
      update(row.id, { status: "saving", error: undefined });
      try {
        const id = await createProduct({
          name: row.name.trim(),
          category_id: row.category_id || undefined,
          unit: row.unit || "pcs",
          buying_price: parseFloat(row.buying_price) || 0,
          selling_price: parseFloat(row.selling_price),
          initial_stock: parseFloat(row.stock) || 0,
          reorder_level: 5,
        });
        if (row.brand_id) {
          await execute(`UPDATE products SET brand_id = ?2 WHERE id = ?1`, [id, row.brand_id]);
        }
        update(row.id, { status: "saved" });
        saved++;
      } catch (e) {
        update(row.id, { status: "error", error: String(e).slice(0, 80) });
        failed++;
      }
    }

    if (failed === 0) {
      toast.success(`Saved ${saved} product${saved !== 1 ? "s" : ""}`);
      setTimeout(() => navigate("/inventory"), 1200);
    } else {
      toast.error(`Saved ${saved}, failed ${failed}. Fix errors and retry.`);
    }
    setSubmitting(false);
  };

  // Paste handler: parse tab/comma-separated rows from clipboard
  const onPaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !text.includes("\n")) return; // single cell paste, let it through
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const newRows = lines.map((line) => {
      const cells = line.split(/\t|,/).map((c) => c.trim());
      return {
        ...blank(),
        name: cells[0] || "",
        buying_price: cells[1] || "",
        selling_price: cells[2] || "",
        stock: cells[3] || "",
      };
    });
    setRows(newRows);
    toast.success(`Pasted ${newRows.length} rows`);
  };

  return (
    <div className="space-y-5" onPaste={onPaste}>
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} className="mb-2 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Inventory
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" /> Quick Add Products
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Type or paste a list of products. One row per product. Tab between fields. Paste from Excel/spreadsheet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={clear} disabled={submitting}>Clear</Button>
            <Button onClick={saveAll} disabled={submitting || validRows.length === 0} className="min-w-[140px]">
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
              ) : (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Save {validRows.length} Product{validRows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Markup helper */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 text-xs">
          <Tag className="h-4 w-4 text-amber-600" />
          <span className="text-muted-foreground">
            Default markup:
          </span>
          <Input
            type="number"
            value={defaultMarkupPct}
            onChange={(e) => setDefaultMarkupPct(parseFloat(e.target.value) || 0)}
            className="h-7 w-20"
          />
          <span className="text-muted-foreground">%</span>
          <span className="text-muted-foreground ml-auto">
            Tab through fields. Click <b>↻</b> on any row to apply markup.
          </span>
        </CardContent>
      </Card>

      {/* Bulk grid */}
      <div className="border border-border rounded-md overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-8">#</th>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Product Name *</th>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-32">Category</th>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-32">Brand</th>
              <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Buy</th>
              <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Sell *</th>
              <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-20">Stock</th>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-16">Unit</th>
              <th className="text-center px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const buying = parseFloat(r.buying_price) || 0;
              const selling = parseFloat(r.selling_price) || 0;
              const margin = buying > 0 ? ((selling - buying) / buying) * 100 : 0;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-stone-100 ${
                    r.status === "saved" ? "bg-emerald-50" :
                    r.status === "error" ? "bg-rose-50" :
                    r.status === "saving" ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="px-2 py-1 text-[10px] font-mono text-stone-400 text-center">{i + 1}</td>
                  <td className="px-1 py-1">
                    <Input
                      value={r.name}
                      onChange={(e) => update(r.id, { name: e.target.value })}
                      placeholder="e.g., Sugar 1kg"
                      className="h-7 text-[12px]"
                      disabled={r.status === "saved"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Select value={r.category_id} onValueChange={(v) => update(r.id, { category_id: String(v) })} disabled={r.status === "saved"}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>
                      
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent></Select>
                  </td>
                  <td className="px-1 py-1">
                    <Select value={r.brand_id} onValueChange={(v) => update(r.id, { brand_id: String(v) })} disabled={r.status === "saved"}>
                      <SelectTrigger>
                        <SelectValue placeholder="—">
                          {r.brand_id ? (brands.find((b) => b.id === r.brand_id)?.name ?? "—") : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-0.5">
                      <Input
                        type="number"
                        value={r.buying_price}
                        onChange={(e) => update(r.id, { buying_price: e.target.value })}
                        placeholder="0"
                        className="h-7 text-[12px] text-right tabular-nums"
                        disabled={r.status === "saved"}
                      />
                      <button
                        type="button"
                        onClick={() => applyMarkup(r.id)}
                        disabled={!r.buying_price || r.status === "saved"}
                        title={`Apply ${defaultMarkupPct}% markup`}
                        className="text-amber-600 hover:text-amber-800 disabled:opacity-30 text-xs px-0.5"
                      >
                        ↻
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      value={r.selling_price}
                      onChange={(e) => update(r.id, { selling_price: e.target.value })}
                      placeholder="0"
                      className="h-7 text-[12px] text-right tabular-nums"
                      disabled={r.status === "saved"}
                    />
                    {margin > 0 && (
                      <div className={`text-[9px] text-right pr-1 ${margin > 20 ? "text-emerald-600" : "text-amber-600"}`}>
                        +{margin.toFixed(0)}%
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      value={r.stock}
                      onChange={(e) => update(r.id, { stock: e.target.value })}
                      placeholder="0"
                      className="h-7 text-[12px] text-right tabular-nums"
                      disabled={r.status === "saved"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={r.unit}
                      onChange={(e) => update(r.id, { unit: e.target.value })}
                      className="h-7 text-[11px]"
                      disabled={r.status === "saved"}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    {r.status === "saved" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                    ) : r.status === "error" ? (
                      <span title={r.error}>
                        <AlertCircle className="h-3.5 w-3.5 text-rose-600 mx-auto" />
                      </span>
                    ) : r.status === "saving" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 mx-auto" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => remove(r.id)}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-border p-2 bg-muted/40">
          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            <Plus className="h-3 w-3 mr-1" /> Add Row
          </Button>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p><b>Tip:</b> Paste from Excel — copy a name + buy + sell + stock columns. Rows split by line, fields by tab.</p>
        <p><b>Tip:</b> The ↻ button applies the default markup % to derive selling price from buying price.</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  Download,
  Package,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { getStockValuation, getReorderList, getDeadStock, getStockMovementsByDay, type StockMovementByDay } from "@/services/reports";
import { exportToCSV } from "@/lib/export";
import { renderReorderListPdf, renderDeadStockPdf } from "@/services/reports-pdf";
import { loadBrandHeader, downloadBytes } from "@/services/pdf-brand";
import { ComparisonBar } from "@/components/charts";

export function InventoryReportsPage() {
  const [valuation, setValuation] = useState<{ at_cost: number; at_retail: number; total_items: number } | null>(null);
  const [reorder, setReorder] = useState<Array<{ id: string; name: string; current_stock: number; reorder_level: number; deficit: number }>>([]);
  const [dead, setDead] = useState<Array<{ id: string; name: string; current_stock: number; last_sale: string | null }>>([]);
  const [movements, setMovements] = useState<StockMovementByDay[]>([]);
  const [tab, setTab] = useState<"valuation" | "movements" | "reorder" | "dead">("valuation");

  useEffect(() => {
    Promise.all([
      getStockValuation(),
      getReorderList(),
      getDeadStock(60),
      getStockMovementsByDay(30),
    ]).then(([v, r, d, m]) => {
      setValuation(v);
      setReorder(r);
      setDead(d);
      setMovements(m);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Inventory Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "valuation", label: "Valuation" },
          { id: "movements", label: "Stock Movements" },
          { id: "reorder", label: `Reorder List (${reorder.length})` },
          { id: "dead", label: `Dead Stock (${dead.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "valuation" && valuation && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <ValueCard label="At Cost" value={valuation.at_cost} />
            <ValueCard label="At Retail" value={valuation.at_retail} highlight />
            <ValueCard label="Potential Profit" value={valuation.at_retail - valuation.at_cost} tone="success" />
          </div>
          <div className="border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Total stock items: <span className="font-mono font-medium text-foreground">{valuation.total_items}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Margin: <span className="font-mono font-medium text-foreground">
                {valuation.at_cost > 0 ? (((valuation.at_retail - valuation.at_cost) / valuation.at_cost) * 100).toFixed(1) : "0"}%
              </span>
            </p>
          </div>
        </div>
      )}

      {tab === "movements" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Stock movements over the last 30 days</p>
          {movements.length === 0 ? (
            <EmptyState icon={Package} text="No stock movements yet" />
          ) : (
            <div className="border border-border rounded-lg p-4">
              <ComparisonBar
                data={movements}
                xKey="date"
                series={[
                  { key: "purchases", name: "Purchases", color: "#10b981" },
                  { key: "sales", name: "Sales", color: "#3b82f6" },
                  { key: "adjustments", name: "Adjustments", color: "#f59e0b" },
                ]}
                height={300}
              />
            </div>
          )}
        </div>
      )}

      {tab === "reorder" && (
        <div className="space-y-3">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const brand = await loadBrandHeader();
                const bytes = renderReorderListPdf({
                  brand,
                  rows: reorder.map((r) => ({
                    productName: r.name,
                    onHand: r.current_stock,
                    reorderLevel: r.reorder_level,
                    suggestedOrder: Math.max(r.deficit, 1),
                  })),
                });
                downloadBytes(bytes, "reorder-list");
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportToCSV("reorder-list", reorder)}>
              CSV
            </Button>
          </div>
          {reorder.length === 0 ? (
            <EmptyState icon={Package} text="All stock above reorder levels" />
          ) : (
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Product</th>
                  <th className="text-right px-4 py-2.5 font-medium">Current</th>
                  <th className="text-right px-4 py-2.5 font-medium">Reorder At</th>
                  <th className="text-right px-4 py-2.5 font-medium">Suggest Order</th>
                </tr>
              </thead>
              <tbody>
                {reorder.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.current_stock}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.reorder_level}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-600">{Math.max(r.deficit, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "dead" && (
        <div className="space-y-3">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const brand = await loadBrandHeader();
                const bytes = renderDeadStockPdf({
                  brand,
                  daysSinceSold: 60,
                  rows: dead.map((d) => ({
                    productName: d.name,
                    onHand: d.current_stock,
                    valueAtCost: 0,
                    lastSold: d.last_sale,
                  })),
                });
                downloadBytes(bytes, "dead-stock");
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportToCSV("dead-stock", dead)}>
              CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Items not sold in 60+ days but still in stock.</p>
          {dead.length === 0 ? (
            <EmptyState icon={Package} text="No dead stock" />
          ) : (
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Product</th>
                  <th className="text-right px-4 py-2.5 font-medium">Stock</th>
                  <th className="text-left px-4 py-2.5 font-medium">Last Sale</th>
                </tr>
              </thead>
              <tbody>
                {dead.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-2">{d.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{d.current_stock}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{d.last_sale || "Never sold"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ValueCard({ label, value, highlight, tone = "default" }: { label: string; value: number; highlight?: boolean; tone?: "default" | "success" }) {
  return (
    <div className={`border rounded-lg p-4 ${highlight ? "border-primary/50 bg-primary/5" : tone === "success" ? "border-green-500/50 bg-green-500/5" : "border-border"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-2xl font-semibold mt-1 font-mono">
        <span className="text-xs text-muted-foreground mr-1">KES</span>
        {value.toFixed(0)}
      </p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

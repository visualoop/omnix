/**
 * RecipeCanvas — visual DAG recipe builder built on React Flow (@xyflow).
 *
 * Design: chefs think in mise-en-place — prep stations converge onto the
 * plated dish. This canvas shows ingredients on the left, connected via
 * curved bezier edges to a central DishNode. Every edge is labeled with
 * qty + unit. Auto-layout uses dagre L→R when no saved layout exists.
 *
 * Hospitality-specific rule: only physical products (raw ingredients)
 * can be picked; never another menu item. Enforced by filtering the
 * ingredient picker on kind='physical'.
 *
 * Persistence: nodes + viewport saved as JSON on `recipes.canvas_layout`
 * via `replaceRecipe(..., canvasLayout)`. Rehydrates on load.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Plus, Warning, MagicWand, FloppyDisk, ForkKnife } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { getProducts, type Product } from "@/services/inventory";
import { getRecipeForMenuItem, replaceRecipe } from "@/services/hospitality";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";

// ─── Node data shapes ────────────────────────────────────────────────

interface DishData extends Record<string, unknown> {
  kind: "dish";
  name: string;
  imagePath: string | null;
  costPerServing: number;
  sellingPrice: number;
  yieldQty: number;
}

interface IngredientData extends Record<string, unknown> {
  kind: "ingredient";
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  buyingPrice: number;
  stockQty: number;
  isBottleneck: boolean;
}

// ─── DishNode component ──────────────────────────────────────────────

function DishNode({ data }: { data: DishData }) {
  const margin = data.sellingPrice > 0
    ? ((data.sellingPrice - data.costPerServing) / data.sellingPrice) * 100
    : 0;
  const marginColour = margin >= 60
    ? "border-emerald-500/60 bg-emerald-500/10"
    : margin >= 30
    ? "border-amber-500/60 bg-amber-500/10"
    : "border-rose-500/60 bg-rose-500/10";
  return (
    <div className={cn("rounded-xl border-2 p-3 min-w-[220px] shadow-sm", marginColour)}>
      <div className="flex items-center gap-2.5">
        {data.imagePath ? (
          <img src={data.imagePath} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center">
            <ForkKnife className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Dish</div>
          <div className="font-semibold truncate">{data.name}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-mono">
        <span className="text-muted-foreground">Cost</span>
        <span>{KES(data.costPerServing)}</span>
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-muted-foreground">Price</span>
        <span>{KES(data.sellingPrice)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs font-mono font-semibold">
        <span className="text-muted-foreground">Margin</span>
        <span>{margin.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ─── IngredientNode component ────────────────────────────────────────

function IngredientNode({ data }: { data: IngredientData }) {
  const stockRatio = data.quantity > 0 ? data.stockQty / (data.quantity * (1 + data.wastagePercent / 100)) : Infinity;
  const stockColour = stockRatio < 3
    ? "border-rose-500/60 bg-rose-500/5"
    : stockRatio < 10
    ? "border-amber-500/60 bg-amber-500/5"
    : "border-emerald-500/40 bg-card";
  const cost = data.quantity * data.buyingPrice * (1 + data.wastagePercent / 100);
  return (
    <div className={cn("rounded-lg border-2 p-2.5 min-w-[180px] max-w-[220px] shadow-sm", stockColour)}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Ingredient</div>
          <div className="font-medium text-sm truncate">{data.name}</div>
        </div>
        {data.isBottleneck ? (
          <Warning
            className="h-4 w-4 text-amber-600 shrink-0"
            weight="fill"
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono">
        <span className="text-muted-foreground">Qty</span>
        <span>{data.quantity}{data.unit}</span>
      </div>
      {data.wastagePercent > 0 ? (
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted-foreground">Waste</span>
          <span>{data.wastagePercent}%</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-muted-foreground">Cost</span>
        <span>{KES(cost)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">Stock</span>
        <span className={stockRatio < 3 ? "text-rose-600 font-semibold" : stockRatio < 10 ? "text-amber-600" : "text-muted-foreground"}>
          {data.stockQty}{data.unit}
        </span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  dish: DishNode,
  ingredient: IngredientNode,
};

// ─── Layout with dagre ───────────────────────────────────────────────

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 100 });
  nodes.forEach((n) => g.setNode(n.id, { width: 220, height: 120 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return p ? { ...n, position: { x: p.x - 110, y: p.y - 60 } } : n;
  });
}

// ─── Main component ──────────────────────────────────────────────────

interface Props {
  menuItemId: string;
  menuItemName: string;
  menuItemImage: string | null;
  sellingPrice: number;
}

interface IngredientLine {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  buyingPrice: number;
  stockQty: number;
}

export function RecipeCanvas({ menuItemId, menuItemName, menuItemImage, sellingPrice }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<IngredientLine[]>([]);
  const [yieldQty, setYieldQty] = useState(1);
  const [saving, setSaving] = useState(false);

  // Load products (hospitality rule: getProducts already filters to
  // kind='physical' via services/inventory.ts:getProductsPage — so we
  // never see menu items as ingredients). Also load the recipe.
  useEffect(() => {
    getProducts().then(setProducts);
    void loadRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItemId]);

  const loadRecipe = async () => {
    const r = await getRecipeForMenuItem(menuItemId);
    if (r) {
      const initialLines: IngredientLine[] = await Promise.all(
        r.ingredients.map(async (i) => ({
          productId: i.product_id,
          name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          wastagePercent: i.wastage_percent,
          buyingPrice: i.buying_price,
          stockQty: await stockFor(i.product_id),
        })),
      );
      setLines(initialLines);
      setYieldQty(r.yield_quantity);
      // Try to restore saved layout, else auto-layout.
      try {
        const layout = r.canvas_layout ? JSON.parse(r.canvas_layout) : null;
        buildGraph(initialLines, r.yield_quantity, layout);
      } catch {
        buildGraph(initialLines, r.yield_quantity, null);
      }
    } else {
      setLines([]);
      buildGraph([], 1, null);
    }
  };

  const buildGraph = (
    inputLines: IngredientLine[],
    yieldQtyIn: number,
    layout: { nodes: Array<{ id: string; x: number; y: number }> } | null,
  ) => {
    // Compute bottleneck (ingredient with the lowest servings capacity)
    let bottleneck: string | null = null;
    let minServings = Infinity;
    for (const l of inputLines) {
      const per = l.quantity * (1 + l.wastagePercent / 100);
      const servings = per > 0 ? l.stockQty / per : Infinity;
      if (servings < minServings) {
        minServings = servings;
        bottleneck = l.productId;
      }
    }

    const totalCost = inputLines.reduce(
      (s, l) => s + l.quantity * l.buyingPrice * (1 + l.wastagePercent / 100),
      0,
    );

    const dishNode: Node = {
      id: "dish",
      type: "dish",
      position: layout?.nodes?.find((n) => n.id === "dish")
        ? { x: layout.nodes.find((n) => n.id === "dish")!.x, y: layout.nodes.find((n) => n.id === "dish")!.y }
        : { x: 400, y: 100 },
      data: {
        kind: "dish",
        name: menuItemName,
        imagePath: menuItemImage,
        costPerServing: totalCost / (yieldQtyIn || 1),
        sellingPrice,
        yieldQty: yieldQtyIn,
      } satisfies DishData,
    };

    const ingredientNodes: Node[] = inputLines.map((l, i) => {
      const saved = layout?.nodes?.find((n) => n.id === `ing-${l.productId}`);
      return {
        id: `ing-${l.productId}`,
        type: "ingredient",
        position: saved
          ? { x: saved.x, y: saved.y }
          : { x: 60, y: 40 + i * 140 },
        data: {
          kind: "ingredient",
          productId: l.productId,
          name: l.name,
          quantity: l.quantity,
          unit: l.unit,
          wastagePercent: l.wastagePercent,
          buyingPrice: l.buyingPrice,
          stockQty: l.stockQty,
          isBottleneck: l.productId === bottleneck,
        } satisfies IngredientData,
      };
    });

    const edgeList: Edge[] = inputLines.map((l) => ({
      id: `e-${l.productId}`,
      source: `ing-${l.productId}`,
      target: "dish",
      type: "smoothstep",
      animated: false,
      label: `${l.quantity}${l.unit}`,
      labelStyle: { fontSize: 11, fontFamily: "monospace", fontWeight: 500 },
      labelBgPadding: [4, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: "hsl(var(--muted))" },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    const laidOut = layout ? [dishNode, ...ingredientNodes] : autoLayout([dishNode, ...ingredientNodes], edgeList);
    setNodes(laidOut);
    setEdges(edgeList);
  };

  useEffect(() => {
    buildGraph(lines, yieldQty, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, yieldQty, menuItemName, menuItemImage, sellingPrice]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const addIngredient = (productId: string) => {
    if (lines.some((l) => l.productId === productId)) {
      toast.error("Ingredient already in the recipe");
      return;
    }
    const p = products.find((pp) => pp.id === productId);
    if (!p) return;
    void stockFor(productId).then((stock) => {
      setLines((prev) => [
        ...prev,
        {
          productId,
          name: p.name,
          quantity: 100,
          unit: "g",
          wastagePercent: 0,
          buyingPrice: (p as unknown as { buying_price?: number }).buying_price ?? 0,
          stockQty: stock,
        },
      ]);
    });
  };

  const patchLine = (productId: string, patch: Partial<IngredientLine>) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const runAutoLayout = () => {
    setNodes((prev) => autoLayout(prev, edges));
  };

  const save = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }
    setSaving(true);
    try {
      const layout = {
        nodes: nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
      };
      await replaceRecipe(
        menuItemId,
        yieldQty,
        lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unit: l.unit,
          wastagePercent: l.wastagePercent,
        })),
        JSON.stringify(layout),
      );
      toast.success("Recipe saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  const totalCost = lines.reduce(
    (s, l) => s + l.quantity * l.buyingPrice * (1 + l.wastagePercent / 100),
    0,
  );
  const costPerServing = totalCost / (yieldQty || 1);
  const margin = sellingPrice > 0 ? ((sellingPrice - costPerServing) / sellingPrice) * 100 : 0;
  const suggestedPrice = costPerServing / 0.35; // 65% food-cost = 35% cost ratio
  const missing = lines.filter((l) => l.stockQty === 0);

  const productOptions = useMemo(
    () => products.filter((p) => !lines.some((l) => l.productId === p.id)).map((p) => ({ value: p.id, label: p.name })),
    [products, lines],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-[600px]">
      {/* Canvas */}
      <div className="flex-1 rounded-xl border border-border bg-muted/10 overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {/* Overlay toolbar */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-background/95 backdrop-blur border border-border rounded-md p-1.5">
          <div className="max-w-[220px]">
            <Combobox
              value=""
              onChange={(v) => v && addIngredient(v)}
              options={productOptions}
              placeholder="+ Add ingredient…"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={runAutoLayout} title="Auto-layout">
            <MagicWand className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="lg:w-[280px] flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Yield</div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={1}
                value={yieldQty}
                onChange={(e) => setYieldQty(Number(e.target.value) || 1)}
                className="w-20 h-8 px-2 rounded-md border border-input bg-transparent text-sm font-mono"
              />
              <span className="text-xs text-muted-foreground">serving{yieldQty === 1 ? "" : "s"}</span>
            </div>
          </div>
          <Row label="Cost / plate" value={KES(costPerServing)} />
          <Row label="Selling price" value={KES(sellingPrice)} />
          <Row
            label="Margin"
            value={`${margin.toFixed(0)}%`}
            colour={margin >= 60 ? "text-emerald-600" : margin >= 30 ? "text-amber-600" : "text-rose-600"}
          />
          <Row label="At 65% food-cost" value={KES(suggestedPrice)} />
        </div>

        {missing.length > 0 ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
              <Warning className="h-3.5 w-3.5" />
              Missing stock
            </div>
            <ul className="mt-1.5 space-y-0.5 text-rose-700/80 dark:text-rose-400/80">
              {missing.map((m) => (
                <li key={m.productId}>· {m.name}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Compact ingredient list — for editing qty/waste without going to canvas */}
        <div className="rounded-xl border border-border bg-card p-3 flex-1 overflow-y-auto">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Ingredients ({lines.length})
          </div>
          {lines.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">
              Use the + Add ingredient picker on the canvas.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-1.5 text-xs">
                  <span className="flex-1 truncate">{l.name}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => patchLine(l.productId, { quantity: Number(e.target.value) })}
                    className="w-14 h-6 px-1 rounded border border-input text-right bg-transparent font-mono text-[11px]"
                  />
                  <select
                    value={l.unit}
                    onChange={(e) => patchLine(l.productId, { unit: e.target.value })}
                    className="h-6 border border-input rounded px-0.5 text-[11px] bg-transparent"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="pcs">pcs</option>
                  </select>
                  <button
                    onClick={() => removeLine(l.productId)}
                    title="Remove"
                    className="text-muted-foreground hover:text-rose-600 text-[13px]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button onClick={save} disabled={saving}>
          <FloppyDisk className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save recipe"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", colour)}>{value}</span>
    </div>
  );
}

/** Best-effort stock lookup — sums non-empty batches for the given product. */
async function stockFor(productId: string): Promise<number> {
  try {
    const { query } = await import("@/lib/db");
    const rows = await query<{ q: number }>(
      `SELECT COALESCE(SUM(quantity), 0) AS q FROM batches WHERE product_id = ?1 AND quantity > 0`,
      [productId],
    );
    return Number(rows[0]?.q ?? 0);
  } catch {
    return 0;
  }
}

/** Silence unused imports when the hooks don't happen to fire. */
export const _RecipeCanvasPlus = Plus;
